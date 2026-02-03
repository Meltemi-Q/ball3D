import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { ColliderMeta } from './ObjectTags'

export type TableBuild = {
  ballSpawn: THREE.Vector3
  laneExitZ: number
  drainZ: number
  colliderMeta: Map<number, ColliderMeta>
  bumpers: Array<{ body: RAPIER.RigidBody; color: THREE.Color }>
  targets: Array<{ colliderHandle: number; mesh: THREE.Mesh; lit: boolean }>
  flippers: {
    left: { body: RAPIER.RigidBody; joint: RAPIER.RevoluteImpulseJoint }
    right: { body: RAPIER.RigidBody; joint: RAPIER.RevoluteImpulseJoint }
  }
  staticMeshes: THREE.Object3D[]
}

const floorMat = new THREE.MeshStandardMaterial({
  color: 0x0a0b14,
  roughness: 0.35,
  metalness: 0.55,
  emissive: new THREE.Color(0x1b1d2f),
  emissiveIntensity: 0.45,
})

const railMat = new THREE.MeshStandardMaterial({
  color: 0x070812,
  roughness: 0.2,
  metalness: 0.8,
  emissive: new THREE.Color(0x070812),
})

const bumperMat = new THREE.MeshStandardMaterial({
  color: 0x12142a,
  roughness: 0.25,
  metalness: 0.55,
  emissive: new THREE.Color(0x7df9ff),
  emissiveIntensity: 1.0,
})

const targetOffMat = new THREE.MeshStandardMaterial({
  color: 0x0e1022,
  roughness: 0.4,
  metalness: 0.35,
  emissive: new THREE.Color(0x2a2d55),
  emissiveIntensity: 0.25,
})

export function setTargetLit(mesh: THREE.Mesh, lit: boolean) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  if (!lit) {
    mat.color.setHex(0x0e1022)
    mat.emissive.setHex(0x2a2d55)
    mat.emissiveIntensity = 0.25
    return
  }
  mat.color.setHex(0x11133a)
  mat.emissive.setHex(0xb44cff)
  mat.emissiveIntensity = 1.35
}

export function buildNeonTable(
  world: RAPIER.World,
  scene: THREE.Scene,
  colliderMeta: Map<number, ColliderMeta>,
): TableBuild {
  const staticMeshes: THREE.Object3D[] = []
  const bumpers: Array<{ body: RAPIER.RigidBody; color: THREE.Color }> = []
  const targets: Array<{ colliderHandle: number; mesh: THREE.Mesh; lit: boolean }> = []

  const ballSpawn = new THREE.Vector3(2.35, 0.28, 4.9)
  const laneExitZ = 2.2
  const drainZ = 5.25

  const table = new THREE.Group()
  scene.add(table)

  const floorSize = { w: 6.2, l: 10.8 }
  const floorGeo = new THREE.PlaneGeometry(floorSize.w, floorSize.l, 1, 1)
  floorGeo.rotateX(-Math.PI / 2)
  const floorMesh = new THREE.Mesh(floorGeo, floorMat)
  floorMesh.position.set(0, 0, 0)
  table.add(floorMesh)
  staticMeshes.push(floorMesh)

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const floorCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(floorSize.w / 2, 0.08, floorSize.l / 2)
      .setTranslation(0, -0.08, 0)
      .setFriction(0.9)
      .setRestitution(0.05),
    floorBody,
  )
  colliderMeta.set(floorCol.handle, { tag: 'floor' })

  const wallHeight = 0.6
  const railT = 0.18
  const railGeo = new THREE.BoxGeometry(railT, wallHeight, floorSize.l)
  const leftRail = new THREE.Mesh(railGeo, railMat)
  leftRail.position.set(-floorSize.w / 2 - railT / 2 + 0.05, wallHeight / 2, 0)
  const rightRail = new THREE.Mesh(railGeo, railMat)
  rightRail.position.set(floorSize.w / 2 + railT / 2 - 0.05, wallHeight / 2, 0)
  table.add(leftRail, rightRail)
  staticMeshes.push(leftRail, rightRail)

  const railsBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const leftCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(railT / 2, wallHeight / 2, floorSize.l / 2)
      .setTranslation(leftRail.position.x, leftRail.position.y, leftRail.position.z)
      .setFriction(0.35)
      .setRestitution(0.25),
    railsBody,
  )
  colliderMeta.set(leftCol.handle, { tag: 'wall' })
  const rightCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(railT / 2, wallHeight / 2, floorSize.l / 2)
      .setTranslation(rightRail.position.x, rightRail.position.y, rightRail.position.z)
      .setFriction(0.35)
      .setRestitution(0.25),
    railsBody,
  )
  colliderMeta.set(rightCol.handle, { tag: 'wall' })

  const backRailGeo = new THREE.BoxGeometry(floorSize.w, wallHeight, railT)
  const backRail = new THREE.Mesh(backRailGeo, railMat)
  backRail.position.set(0, wallHeight / 2, -floorSize.l / 2 + railT / 2)
  table.add(backRail)
  staticMeshes.push(backRail)
  const backCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(floorSize.w / 2, wallHeight / 2, railT / 2)
      .setTranslation(backRail.position.x, backRail.position.y, backRail.position.z)
      .setFriction(0.35)
      .setRestitution(0.25),
    railsBody,
  )
  colliderMeta.set(backCol.handle, { tag: 'wall' })

  const laneRailZ0 = 5.2
  const laneRailZ1 = 1.6
  const laneRailL = Math.abs(laneRailZ0 - laneRailZ1)
  const laneRailGeo = new THREE.BoxGeometry(railT, wallHeight, laneRailL)
  const laneRail = new THREE.Mesh(laneRailGeo, railMat)
  laneRail.position.set(1.55, wallHeight / 2, (laneRailZ0 + laneRailZ1) / 2)
  table.add(laneRail)
  staticMeshes.push(laneRail)
  const laneCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(railT / 2, wallHeight / 2, laneRailL / 2)
      .setTranslation(laneRail.position.x, laneRail.position.y, laneRail.position.z)
      .setFriction(0.25)
      .setRestitution(0.2),
    railsBody,
  )
  colliderMeta.set(laneCol.handle, { tag: 'wall' })

  const bumperGeo = new THREE.CylinderGeometry(0.35, 0.5, 0.32, 24, 1, false)
  const bumperPositions = [
    new THREE.Vector3(-1.4, 0.18, -2.8),
    new THREE.Vector3(0.0, 0.18, -3.6),
    new THREE.Vector3(1.4, 0.18, -2.8),
  ]
  for (let i = 0; i < bumperPositions.length; i++) {
    const pos = bumperPositions[i]
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z))
    const col = world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.16, 0.42)
        .setRestitution(1.05)
        .setFriction(0.1)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'bumper', id: `bumper:${i}`, score: 120 })

    const mesh = new THREE.Mesh(bumperGeo, bumperMat)
    mesh.position.copy(pos)
    mesh.rotation.x = Math.PI / 2
    table.add(mesh)
    staticMeshes.push(mesh)
    bumpers.push({
      body,
      color: new THREE.Color(0x7df9ff).lerp(new THREE.Color(0xb44cff), i / 2),
    })

    const light = new THREE.PointLight(bumpers[i].color.getHex(), 12, 5.2, 2.1)
    light.position.set(pos.x, pos.y + 0.45, pos.z)
    table.add(light)
  }

  const targetGeo = new THREE.BoxGeometry(0.44, 0.18, 0.14)
  const targetCount = 5
  for (let i = 0; i < targetCount; i++) {
    const x = -1.5 + (i * 3.0) / (targetCount - 1)
    const z = -4.8
    const y = 0.16
    const mesh = new THREE.Mesh(targetGeo, targetOffMat.clone())
    mesh.position.set(x, y, z)
    table.add(mesh)
    staticMeshes.push(mesh)

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.22, 0.12, 0.08)
        .setTranslation(x, y, z)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'target', id: `target:${i}`, score: 250 })
    targets.push({ colliderHandle: col.handle, mesh, lit: false })
    setTargetLit(mesh, false)
  }

  const drainBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const drainCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.3, 0.6, 0.25)
      .setTranslation(0, 0.1, drainZ)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    drainBody,
  )
  colliderMeta.set(drainCol.handle, { tag: 'drain', id: 'drain' })

  const apronGeo = new THREE.BoxGeometry(2.0, wallHeight, railT)
  const apronL = new THREE.Mesh(apronGeo, railMat)
  const apronR = new THREE.Mesh(apronGeo, railMat)
  const apronZ = 5.05
  apronL.position.set(-2.2, wallHeight / 2, apronZ)
  apronR.position.set(2.2, wallHeight / 2, apronZ)
  table.add(apronL, apronR)
  staticMeshes.push(apronL, apronR)

  const apronBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const apronLC = world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.0, wallHeight / 2, railT / 2)
      .setTranslation(apronL.position.x, apronL.position.y, apronL.position.z)
      .setFriction(0.35)
      .setRestitution(0.2),
    apronBody,
  )
  colliderMeta.set(apronLC.handle, { tag: 'wall' })
  const apronRC = world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.0, wallHeight / 2, railT / 2)
      .setTranslation(apronR.position.x, apronR.position.y, apronR.position.z)
      .setFriction(0.35)
      .setRestitution(0.2),
    apronBody,
  )
  colliderMeta.set(apronRC.handle, { tag: 'wall' })

  const flipperGeo = new THREE.BoxGeometry(1.25, 0.18, 0.34)
  const hingeOffset = 0.55
  const leftPos = new THREE.Vector3(-1.05, 0.14, 3.95)
  const rightPos = new THREE.Vector3(1.05, 0.14, 3.95)

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
      emissiveIntensity: 0.45,
    })
    const dir = side === 'left' ? 1 : -1
    const anchor = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x - dir * hingeOffset, pos.y, pos.z),
    )
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(0.8)
        .setAngularDamping(2.8),
    )
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.62, 0.09, 0.17)
        .setRestitution(0.25)
        .setFriction(0.55)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    colliderMeta.set(col.handle, { tag: 'flipper', id: `flipper:${side}` })

    const jointData = RAPIER.JointData.revolute(
      { x: -dir * hingeOffset, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    )
    const joint = world.createImpulseJoint(jointData, anchor, body, true) as RAPIER.RevoluteImpulseJoint
    joint.setLimits(-0.65, 0.35)
    joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased)

    const mesh = new THREE.Mesh(flipperGeo, mat)
    mesh.position.copy(pos)
    table.add(mesh)
    staticMeshes.push(mesh)
    ;(body as any).__mesh = mesh

    const light = new THREE.PointLight(color.getHex(), 6.5, 4.5, 2.0)
    light.position.set(pos.x, pos.y + 0.45, pos.z)
    table.add(light)

    return { body, joint }
  }

  const left = createFlipper('left', leftPos, new THREE.Color(0x7df9ff))
  const right = createFlipper('right', rightPos, new THREE.Color(0xb44cff))

  return {
    ballSpawn,
    laneExitZ,
    drainZ,
    colliderMeta,
    bumpers,
    targets,
    flippers: { left, right },
    staticMeshes,
  }
}
