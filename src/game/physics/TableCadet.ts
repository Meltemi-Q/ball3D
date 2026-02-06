import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { ColliderMeta } from './ObjectTags'
import { createDeckTexture } from '../render/DeckTexture'

export type TableBuild = {
  ballSpawn: THREE.Vector3
  laneExitZ: number
  drainZ: number
  bounds: { w: number; l: number; railMargin: number }
  colliderMeta: Map<number, ColliderMeta>
  bumpers: Array<{ body: RAPIER.RigidBody; color: THREE.Color }>
  targets: Array<{ colliderHandle: number; mesh: THREE.Mesh; lit: boolean }>
  dropTargets: Array<{ colliderHandle: number; mesh: THREE.Mesh; down: boolean }>
  spinner: { colliderHandle: number; body: RAPIER.RigidBody; mesh: THREE.Mesh } | null
  kickout: { sensorHandle: number; ejectDir: THREE.Vector3; position: THREE.Vector3 } | null
  plunger: {
    body: RAPIER.RigidBody
    mesh: THREE.Object3D
    zRest: number
    zPullMax: number
    x: number
    y: number
  } | null
  flippers: {
    left: { body: RAPIER.RigidBody; joint: RAPIER.RevoluteImpulseJoint }
    right: { body: RAPIER.RigidBody; joint: RAPIER.RevoluteImpulseJoint }
  }
  staticMeshes: THREE.Object3D[]
}

const metal = (c: number, emissive?: number, ei = 0.35) =>
  new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.28,
    metalness: 0.85,
    emissive: new THREE.Color(emissive ?? 0x0a0b14),
    emissiveIntensity: ei,
  })

const railMat = metal(0x070812, 0x070812, 0.05)
const bumperMat = metal(0x111326, 0x7df9ff, 1.0)
const targetMat = metal(0x0e1022, 0x2a2d55, 0.25)
const targetOnEm = new THREE.Color(0xb44cff)
const dropMat = metal(0x0b0d1f, 0x9aa7ff, 0.35)
const dropDownMat = metal(0x070812, 0x070812, 0.06)
const spinnerMat = metal(0x0b0d1f, 0x7df9ff, 0.45)

export function setTargetLit(mesh: THREE.Mesh, lit: boolean) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  if (!lit) {
    mat.color.setHex(0x0e1022)
    mat.emissive.setHex(0x2a2d55)
    mat.emissiveIntensity = 0.25
    return
  }
  mat.color.setHex(0x11133a)
  mat.emissive.copy(targetOnEm)
  mat.emissiveIntensity = 1.25
}

export function setDropDown(mesh: THREE.Mesh, down: boolean) {
  mesh.material = down ? dropDownMat : dropMat
  mesh.visible = !down
}

export function buildCadetTable(
  world: RAPIER.World,
  scene: THREE.Scene,
  colliderMeta: Map<number, ColliderMeta>,
): TableBuild {
  const staticMeshes: THREE.Object3D[] = []
  const bumpers: Array<{ body: RAPIER.RigidBody; color: THREE.Color }> = []
  const targets: Array<{ colliderHandle: number; mesh: THREE.Mesh; lit: boolean }> = []
  const dropTargets: Array<{ colliderHandle: number; mesh: THREE.Mesh; down: boolean }> = []

  // Coordinates:
  // - X: left(-) to right(+)
  // - Z: up-table(-) to down-table(+)
  const floorSize = { w: 6.4, l: 12.2 }
  const bounds = { w: floorSize.w, l: floorSize.l, railMargin: 0.55 }

  // Shooter lane is on the right side (positive X).
  const ballSpawn = new THREE.Vector3(2.55, 0.18, 5.3)
  const laneExitZ = 2.25
  const drainZ = 5.85

  const table = new THREE.Group()
  scene.add(table)

  // Deck mesh with procedural texture (original artwork; avoids IP assets).
  const deckTex = createDeckTexture(1024, 2048)
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.25,
    map: deckTex,
    emissive: new THREE.Color(0x070812),
    emissiveIntensity: 0.15,
  })
  const floorGeo = new THREE.PlaneGeometry(floorSize.w, floorSize.l, 1, 1)
  floorGeo.rotateX(-Math.PI / 2)
  const floorMesh = new THREE.Mesh(floorGeo, deckMat)
  floorMesh.position.set(0, 0, 0)
  table.add(floorMesh)
  staticMeshes.push(floorMesh)

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const floorCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(floorSize.w / 2, 0.08, floorSize.l / 2)
      .setTranslation(0, -0.08, 0)
      .setFriction(0.92)
      .setRestitution(0.05),
    floorBody,
  )
  colliderMeta.set(floorCol.handle, { tag: 'floor' })

  const wallH = 0.85
  const railT = 0.18
  const railsBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const apronH = 0.32
  const apronY = apronH / 2

  const addWall = (sx: number, sy: number, sz: number, pos: THREE.Vector3, yaw = 0, syVisual?: number) => {
    const visY = syVisual ?? sy
    const geo = new THREE.BoxGeometry(sx * 2, visY * 2, sz * 2)
    const mesh = new THREE.Mesh(geo, railMat)
    mesh.position.copy(pos)
    // For low apron guides, keep the physics height but render a thinner wall so it doesn't occlude flippers.
    if (syVisual !== undefined) mesh.position.y = visY
    mesh.rotation.y = yaw
    table.add(mesh)
    staticMeshes.push(mesh)
    const qy = Math.sin(yaw / 2)
    const qw = Math.cos(yaw / 2)
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(sx, sy, sz)
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: 0, y: qy, z: 0, w: qw })
        .setFriction(0.35)
        .setRestitution(0.22),
      railsBody,
    )
    colliderMeta.set(col.handle, { tag: 'wall' })
    return { mesh, col }
  }

  // Outer rails.
  addWall(railT / 2, wallH / 2, floorSize.l / 2, new THREE.Vector3(-floorSize.w / 2 - railT / 2 + 0.05, wallH / 2, 0))
  addWall(railT / 2, wallH / 2, floorSize.l / 2, new THREE.Vector3(floorSize.w / 2 + railT / 2 - 0.05, wallH / 2, 0))
  addWall(floorSize.w / 2, wallH / 2, railT / 2, new THREE.Vector3(0, wallH / 2, -floorSize.l / 2 + railT / 2))

  // Bottom apron guides (low height so they don't block the flippers visually).
  // Keep the center open: missing the flippers should drain the ball.
  addWall(1.05, apronY, railT / 2, new THREE.Vector3(-2.55, apronY, 5.62), 0.22, 0.045)
  // Right bottom guide is kept farther right to avoid clipping the red flipper swing area.
  addWall(0.52, apronY, railT / 2, new THREE.Vector3(1.95, apronY, 5.58), -0.2, 0.04)
  // Outlane separators (left/right).
  addWall(railT / 2, apronY, 0.95, new THREE.Vector3(-2.25, apronY, 5.55), 0.0, 0.045)
  addWall(railT / 2, apronY, 0.7, new THREE.Vector3(2.18, apronY, 5.52), 0.0, 0.04)

  // Shooter lane divider (inner wall).
  addWall(railT / 2, wallH / 2, 2.55, new THREE.Vector3(1.82, wallH / 2, 3.95), 0, 0.11)
  // Shooter backstop (behind the plunger travel).
  addWall(0.9, wallH / 2, railT / 2, new THREE.Vector3(2.55, wallH / 2, 6.25))
  // Shooter lane bottom-right corner guide: prevents the ball from settling into a dead pocket.
  addWall(0.22, apronY, 0.12, new THREE.Vector3(2.9, apronY, 6.05), Math.PI / 4)

  // Plunger (kinematic): pull (Space/Launch hold) then release to fire.
  let plunger: TableBuild['plunger'] = null
  {
    const x = 2.55
    const y = 0.14
    const zRest = 5.55
    const zPullMax = 6.02

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, zRest),
    )
    body.setEnabledTranslations(true, false, true, true)
    body.setEnabledRotations(false, true, false, true)

    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.58, 0.12, 0.07)
        .setFriction(0.18)
        .setRestitution(0.05),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'wall', id: 'plunger' })

    const g = new THREE.Group()
    g.position.set(x, y, zRest)

    // Wide "face plate" so the ball always stays visibly on top (matches physics collider footprint).
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.22, 0.14), metal(0x0b0d1f, 0x7df9ff, 0.55))
    head.position.set(0, 0.04, 0)
    g.add(head)

    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.05), metal(0x070812, 0x070812, 0.06))
    rod.position.set(0, 0.03, 0.62)
    g.add(rod)

    const spring = new THREE.Group()
    const rings: THREE.Mesh[] = []
    const ringMat = metal(0x0b0d1f, 0xb44cff, 0.35)
    const minZ = 0.18
    const maxZ = 0.88
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 10, 18), ringMat)
      ring.rotation.x = Math.PI / 2
      spring.add(ring)
      rings.push(ring)
    }
    for (let i = 0; i < rings.length; i++) {
      const u = rings.length === 1 ? 0.5 : i / (rings.length - 1)
      rings[i].position.z = minZ + (maxZ - minZ) * u
    }
    spring.position.set(0, 0.03, 0.20)
    g.add(spring)

    g.userData.spring = { rings, minZ, maxZ }

    table.add(g)

    plunger = { body, mesh: g, zRest, zPullMax, x, y }
  }

  // Slingshots (treated as bumpers).
  const slingSize = { x: 0.92, y: 0.18, z: 0.22 }
  const slingGeo = new THREE.BoxGeometry(slingSize.x, slingSize.y, slingSize.z)
  const slingDefs = [
    { id: 'sling:left', pos: new THREE.Vector3(-2.05, 0.14, 4.22), yaw: Math.PI * 0.14, color: 0x7df9ff },
    { id: 'sling:right', pos: new THREE.Vector3(0.95, 0.14, 4.22), yaw: -Math.PI * 0.14, color: 0xb8ff6a },
  ]
  for (const s of slingDefs) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(s.pos.x, s.pos.y, s.pos.z))
    const qy = Math.sin(s.yaw / 2)
    const qw = Math.cos(s.yaw / 2)
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(slingSize.x / 2, slingSize.y / 2, slingSize.z / 2)
        .setRotation({ x: 0, y: qy, z: 0, w: qw })
        .setRestitution(1.18)
        .setFriction(0.06)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'sling', id: s.id, score: 180 })

    const mat = metal(0x0b0d1f, s.color, 0.6)
    const mesh = new THREE.Mesh(slingGeo, mat)
    mesh.position.copy(s.pos)
    mesh.rotation.y = s.yaw
    table.add(mesh)
    staticMeshes.push(mesh)
  }

  // Pop bumpers cluster (upper-mid).
  const bumperGeo = new THREE.CylinderGeometry(0.35, 0.5, 0.32, 24, 1, false)
  const bumperPositions = [
    new THREE.Vector3(-1.55, 0.18, -2.9),
    new THREE.Vector3(0.0, 0.18, -3.75),
    new THREE.Vector3(1.55, 0.18, -2.9),
  ]
  for (let i = 0; i < bumperPositions.length; i++) {
    const pos = bumperPositions[i]
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z))
    const col = world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.16, 0.42)
        .setRestitution(1.06)
        .setFriction(0.08)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'bumper', id: `bumper:${i}`, score: 120 })

    const mesh = new THREE.Mesh(bumperGeo, bumperMat)
    mesh.position.copy(pos)
    mesh.rotation.x = Math.PI / 2
    table.add(mesh)
    staticMeshes.push(mesh)

    const color = new THREE.Color(0x7df9ff).lerp(new THREE.Color(0xb44cff), i / 2)
    bumpers.push({ body, color })

    const light = new THREE.PointLight(color.getHex(), 14, 5.4, 2.1)
    light.position.set(pos.x, pos.y + 0.48, pos.z)
    table.add(light)
  }

  // Roll lanes (top) as targets to light.
  const laneTargetGeo = new THREE.BoxGeometry(0.5, 0.18, 0.14)
  const laneXs = [-1.2, 0, 1.2]
  for (let i = 0; i < laneXs.length; i++) {
    const x = laneXs[i]
    const z = -5.35
    const y = 0.16
    const mesh = new THREE.Mesh(laneTargetGeo, targetMat.clone())
    mesh.position.set(x, y, z)
    table.add(mesh)
    staticMeshes.push(mesh)

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.25, 0.12, 0.08)
        .setTranslation(x, y, z)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'target', id: `lane:${i}`, score: 300 })
    targets.push({ colliderHandle: col.handle, mesh, lit: false })
    setTargetLit(mesh, false)
  }

  // Drop targets bank (mid).
  const dropGeo = new THREE.BoxGeometry(0.36, 0.26, 0.14)
  for (let i = 0; i < 4; i++) {
    const x = -1.2 + i * 0.8
    const z = -1.05
    const y = 0.16
    const mesh = new THREE.Mesh(dropGeo, dropMat)
    mesh.position.set(x, y, z)
    table.add(mesh)
    staticMeshes.push(mesh)

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.18, 0.15, 0.08)
        .setTranslation(x, y, z)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'dropTarget', id: `drop:${i}`, score: 500 })
    dropTargets.push({ colliderHandle: col.handle, mesh, down: false })
    setDropDown(mesh, false)
  }

  // Spinner (dynamic, jointed).
  let spinner: TableBuild['spinner'] = null
  {
    const pivot = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.9, 0.14, 0.2))
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0.9, 0.14, 0.2)
        .setAngularDamping(2.2)
        .setLinearDamping(0.95),
    )
    body.setEnabledTranslations(true, false, true, true)
    body.setEnabledRotations(false, true, false, true)
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.6, 0.1, 0.03)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
        .setFriction(0.1)
        .setRestitution(0.25),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'spinner', id: 'spinner', score: 70 })

    const jointData = RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    world.createImpulseJoint(jointData, pivot, body, true)

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.06), spinnerMat)
    mesh.position.set(0.9, 0.14, 0.2)
    table.add(mesh)
    staticMeshes.push(mesh)
    ;(body as any).__mesh = mesh

    spinner = { colliderHandle: col.handle, body, mesh }
  }

  // Kickout hole (sensor + scripted eject direction).
  let kickout: TableBuild['kickout'] = null
  {
    const pos = new THREE.Vector3(-2.05, 0.16, -0.1)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const sensor = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.28, 0.2, 0.28)
        .setTranslation(pos.x, pos.y, pos.z)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(sensor.handle, { tag: 'kickout', id: 'kickout', score: 650 })

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 24), metal(0x0b0d1f, 0xb44cff, 0.85))
    ring.position.copy(pos)
    ring.rotation.x = Math.PI / 2
    table.add(ring)
    staticMeshes.push(ring)

    const light = new THREE.PointLight(0xb44cff, 10, 4.5, 2.2)
    light.position.set(pos.x, pos.y + 0.55, pos.z)
    table.add(light)

    kickout = { sensorHandle: sensor.handle, ejectDir: new THREE.Vector3(0.85, 0, -0.55).normalize(), position: pos }
  }

  // Drain sensor (center bottom).
  const drainBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const drainCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.32, 0.6, 0.3)
      .setTranslation(0, 0.1, drainZ)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    drainBody,
  )
  colliderMeta.set(drainCol.handle, { tag: 'drain', id: 'drain' })

  // Lanes (inlanes/outlanes + shooter gate).
  {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const laneDefs = [
      { id: 'inlane:left', pos: new THREE.Vector3(-1.15, 0.12, 5.25), hx: 0.28, hz: 0.4, score: 220, color: 0x7df9ff },
      { id: 'inlane:right', pos: new THREE.Vector3(0.95, 0.12, 5.25), hx: 0.28, hz: 0.4, score: 220, color: 0xff3b7b },
      { id: 'outlane:left', pos: new THREE.Vector3(-2.95, 0.12, 5.58), hx: 0.22, hz: 0.58, score: 120, color: 0x9aa7ff },
      { id: 'outlane:right', pos: new THREE.Vector3(2.95, 0.12, 5.58), hx: 0.22, hz: 0.58, score: 120, color: 0x9aa7ff },
      { id: 'shooter:gate', pos: new THREE.Vector3(2.55, 0.12, 2.05), hx: 0.22, hz: 0.22, score: 80, color: 0x7df9ff },
    ] as const

    for (const l of laneDefs) {
      const sensor = world.createCollider(
        RAPIER.ColliderDesc.cuboid(l.hx, 0.2, l.hz)
          .setTranslation(l.pos.x, l.pos.y, l.pos.z)
          .setSensor(true)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body,
      )
      colliderMeta.set(sensor.handle, { tag: 'lane', id: l.id, score: l.score })

      const light = new THREE.PointLight(l.color, 4.0, 2.8, 2.2)
      light.position.set(l.pos.x, l.pos.y + 0.55, l.pos.z)
      table.add(light)
    }
  }

  // Flippers (dynamic, motorized revolute joints).
  const flipperGeo = new THREE.BoxGeometry(1.25, 0.18, 0.34)
  const hingeOffset = 0.55
  const leftPos = new THREE.Vector3(-0.88, 0.14, 5.05)
  const rightPos = new THREE.Vector3(0.79, 0.14, 5.05)

  function createFlipper(
    side: 'left' | 'right',
    pos: THREE.Vector3,
    color: THREE.Color,
  ): { body: RAPIER.RigidBody; joint: RAPIER.RevoluteImpulseJoint } {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b0d1f,
      roughness: 0.25,
      metalness: 0.75,
      emissive: color,
      emissiveIntensity: 0.4,
    })
    const dir = side === 'left' ? 1 : -1
    const anchor = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x - dir * hingeOffset, pos.y, pos.z),
    )
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(0.85)
        .setAngularDamping(3.2),
    )
    body.setEnabledTranslations(true, false, true, true)
    body.setEnabledRotations(false, true, false, true)
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.62, 0.09, 0.17)
        .setRestitution(0.25)
        .setFriction(0.58)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'flipper', id: `flipper:${side}` })

    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: -dir * hingeOffset, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    )
    const joint = world.createImpulseJoint(jointData, anchor, body, true) as RAPIER.RevoluteImpulseJoint
    if (side === 'left') joint.setLimits(-0.65, 0.35)
    else joint.setLimits(-0.35, 0.65)
    joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased)

    const mesh = new THREE.Mesh(flipperGeo, mat)
    mesh.position.copy(pos)
    table.add(mesh)
    staticMeshes.push(mesh)
    ;(body as any).__mesh = mesh

    return { body, joint }
  }

  const left = createFlipper('left', leftPos, new THREE.Color(0x2da8ff))
  const right = createFlipper('right', rightPos, new THREE.Color(0xff3b7b))

  return {
    ballSpawn,
    laneExitZ,
    drainZ,
    bounds,
    colliderMeta,
    bumpers,
    targets,
    dropTargets,
    spinner,
    kickout,
    plunger,
    flippers: { left, right },
    staticMeshes,
  }
}
