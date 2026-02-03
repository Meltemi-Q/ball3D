import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { InputManager } from './input/InputManager'
import { buildNeonTable, setTargetLit } from './physics/TableNeon'
import type { ColliderMeta } from './physics/ObjectTags'
import { Renderer3D } from './render/Renderer3D'
import { Sparks } from './render/Sparks'
import type { ThemeId } from './Theme'
import { THEMES } from './Theme'
import { Synth } from './audio/Synth'
import { EventBus } from './util/EventBus'

type GameEvents = {
  hud: { score: number; multiplier: number; balls: number; launchCharge: number }
  state: { phase: GamePhase }
}

export type GamePhase = 'menu' | 'playing' | 'gameover'

export type GameAppOptions = {
  canvas: HTMLCanvasElement
}

export class GameApp {
  readonly events = new EventBus<GameEvents>()
  readonly input = new InputManager()
  readonly audio = new Synth()

  private renderer: Renderer3D
  private sparks = new Sparks()

  private rapierReady = false
  private world!: RAPIER.World
  private eventQueue!: RAPIER.EventQueue
  private colliderMeta = new Map<number, ColliderMeta>()

  private table!: ReturnType<typeof buildNeonTable>
  private ballBody!: RAPIER.RigidBody
  private ballCollider!: RAPIER.Collider
  private ballMesh!: THREE.Mesh

  private theme: ThemeId = 'neon'
  private phase: GamePhase = 'menu'

  private score = 0
  private multiplier = 1
  private balls = 3
  private inLane = true

  private raf = 0
  private accumulator = 0
  private lastTime = 0
  private readonly fixedDt = 1 / 120

  constructor(options: GameAppOptions) {
    this.renderer = new Renderer3D(options.canvas)
    this.renderer.scene.add(this.sparks.object3d)
  }

  getPhase() {
    return this.phase
  }

  getTheme() {
    return this.theme
  }

  setTheme(theme: ThemeId) {
    this.theme = theme
    this.renderer.setTheme(THEMES[theme])
  }

  async init() {
    if (!this.rapierReady) {
      await RAPIER.init()
      this.rapierReady = true
    }

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 2.85 })
    this.eventQueue = new RAPIER.EventQueue(true)

    this.table = buildNeonTable(this.world, this.renderer.scene, this.colliderMeta)
    this.createBall()

    this.setTheme(this.theme)

    this.input.attach()
    window.addEventListener('resize', this.onResize, { passive: true })
    this.onResize()

    this.lastTime = performance.now()
    this.setPhase('menu')
    this.emitHud()
    this.loop(this.lastTime)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.input.detach()
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }

  startRun() {
    this.score = 0
    this.multiplier = 1
    this.balls = 3
    this.resetTargets()
    this.spawnBall(true)
    this.setPhase('playing')
    void this.audio.click(820)
  }

  restartRun() {
    this.startRun()
  }

  private setPhase(phase: GamePhase) {
    this.phase = phase
    this.events.emit('state', { phase })
  }

  private emitHud() {
    const st = this.input.getState()
    this.events.emit('hud', {
      score: this.score,
      multiplier: this.multiplier,
      balls: this.balls,
      launchCharge: st.launchCharge,
    })
  }

  private onResize = () => {
    this.renderer.resize()
  }

  private loop = (t: number) => {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000)
    this.lastTime = t

    this.input.tick()
    this.step(dt)
    this.render(dt)
    this.emitHud()

    this.raf = requestAnimationFrame(this.loop)
  }

  private createBall() {
    const r = 0.18
    const ballGeo = new THREE.SphereGeometry(r, 28, 18)
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xbfd2ff,
      roughness: 0.12,
      metalness: 0.92,
      emissive: new THREE.Color(0x14162e),
      emissiveIntensity: 0.35,
    })
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat)
    this.renderer.scene.add(this.ballMesh)

    this.ballBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.table.ballSpawn.x, this.table.ballSpawn.y, this.table.ballSpawn.z)
        .setCcdEnabled(true)
        .setLinearDamping(0.12)
        .setAngularDamping(0.25),
    )
    this.ballCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(r)
        .setRestitution(0.32)
        .setFriction(0.55)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.ballBody,
    )
    this.colliderMeta.set(this.ballCollider.handle, { tag: 'ball', id: 'ball' })
  }

  private spawnBall(forceLane: boolean) {
    const p = this.table.ballSpawn
    this.ballBody.setTranslation({ x: p.x, y: p.y, z: p.z }, true)
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.inLane = forceLane
  }

  private step(dt: number) {
    if (this.phase !== 'playing') return

    const st = this.input.getState()
    this.driveFlippers(st.leftFlipper, st.rightFlipper)

    const release = this.input.consumeLaunchRelease()
    if (this.inLane && release.released) {
      const power = 6.5 + 16.5 * Math.pow(Math.max(0, Math.min(1, release.charge)), 1.2)
      this.ballBody.applyImpulse({ x: 0, y: 0, z: -power }, true)
      void this.audio.click(640 + 240 * release.charge)
    }

    this.accumulator += dt
    while (this.accumulator >= this.fixedDt) {
      this.accumulator -= this.fixedDt
      this.world.step(this.eventQueue)
      this.handleEvents()
      this.postStep()
    }
  }

  private postStep() {
    const p = this.ballBody.translation()

    if (this.inLane && p.z < this.table.laneExitZ) this.inLane = false

    if (p.y < -3 || p.z > this.table.drainZ + 1.2) {
      this.onDrain()
      return
    }
  }

  private handleEvents() {
    const ballHandle = this.ballCollider.handle

    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return

      const other = h1 === ballHandle ? h2 : h2 === ballHandle ? h1 : null
      if (other === null) return

      const meta = this.colliderMeta.get(other)
      if (!meta) return

      if (meta.tag === 'drain') {
        this.onDrain()
        return
      }

      if (meta.tag === 'bumper') {
        this.addScore(meta.score ?? 120, 0.15)
        const bumper = this.table.bumpers.find((b) => {
          const bpos = b.body.translation()
          const p = this.ballBody.translation()
          const dx = bpos.x - p.x
          const dz = bpos.z - p.z
          return dx * dx + dz * dz < 1.2
        })
        const pBall = this.ballBody.translation()
        const impulse = new THREE.Vector3(pBall.x, 0, pBall.z)
        const pOther = this.world.getCollider(other)?.translation()
        if (pOther) impulse.sub(new THREE.Vector3(pOther.x, 0, pOther.z))
        if (impulse.lengthSq() < 1e-6) impulse.set(Math.random() - 0.5, 0, Math.random() - 0.5)
        impulse.normalize().multiplyScalar(2.4)
        this.ballBody.applyImpulse({ x: impulse.x, y: 0.1, z: impulse.z }, true)

        const sparkPos = new THREE.Vector3(pBall.x, pBall.y + 0.1, pBall.z)
        const color = bumper?.color ?? new THREE.Color(0x7df9ff)
        this.sparks.burst(sparkPos, color, 0.8)
        void this.audio.click(520 + Math.random() * 80)
        return
      }

      if (meta.tag === 'target' && meta.id) {
        const t = this.table.targets.find((x) => x.colliderHandle === other)
        if (!t) return
        if (!t.lit) {
          t.lit = true
          setTargetLit(t.mesh, true)
          this.addScore(meta.score ?? 250, 0.08)
          void this.audio.click(840)
          if (this.table.targets.every((x) => x.lit)) {
            this.multiplier = Math.min(8, this.multiplier + 1)
            this.addScore(1500, 0.25)
            this.sparks.burst(
              new THREE.Vector3(0, 0.6, -4.6),
              new THREE.Color(0xb44cff),
              1.0,
            )
            void this.audio.boom(160, 0.14)
            for (const x of this.table.targets) {
              x.lit = false
              setTargetLit(x.mesh, false)
            }
          }
        }
        return
      }
    })
  }

  private addScore(base: number, multiplierBoost: number) {
    this.score += Math.floor(base * this.multiplier)
    this.multiplier = Math.min(8, this.multiplier + multiplierBoost)
  }

  private resetTargets() {
    for (const t of this.table.targets) {
      t.lit = false
      setTargetLit(t.mesh, false)
    }
  }

  private onDrain() {
    if (this.phase !== 'playing') return
    this.balls -= 1
    this.multiplier = Math.max(1, Math.floor(this.multiplier))
    void this.audio.boom(120, 0.16)
    if (this.balls > 0) {
      this.spawnBall(true)
      return
    }
    this.setPhase('gameover')
  }

  private render(dt: number) {
    const p = this.ballBody.translation()
    this.ballMesh.position.set(p.x, p.y, p.z)

    for (const flipper of [this.table.flippers.left.body, this.table.flippers.right.body]) {
      const mesh = (flipper as any).__mesh as THREE.Mesh | undefined
      if (!mesh) continue
      const tp = flipper.translation()
      const rot = flipper.rotation()
      mesh.position.set(tp.x, tp.y, tp.z)
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    }

    this.sparks.tick(dt)

    const camTarget = new THREE.Vector3(p.x * 0.18, 0.3, -1.6)
    this.renderer.camera.lookAt(camTarget)
    this.renderer.render()
  }

  private driveFlippers(leftDown: boolean, rightDown: boolean) {
    const leftTarget = leftDown ? 0.35 : -0.65
    const rightTarget = rightDown ? 0.35 : -0.65
    this.table.flippers.left.joint.configureMotorPosition(leftTarget, 180, 18)
    this.table.flippers.right.joint.configureMotorPosition(rightTarget, 180, 18)
  }
}
