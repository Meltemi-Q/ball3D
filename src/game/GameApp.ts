import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { InputManager } from './input/InputManager'
import type { ColliderMeta } from './physics/ObjectTags'
import { buildCadetTable, setDropDown, setTargetLit } from './physics/TableCadet'
import { Renderer3D } from './render/Renderer3D'
import { Sparks } from './render/Sparks'
import { computeFitDistance } from './render/fitCamera'
import type { ThemeId } from './Theme'
import { THEMES } from './Theme'
import { Synth } from './audio/Synth'
import { EventBus } from './util/EventBus'

type GameEvents = {
  hud: { score: number; multiplier: number; balls: number; launchCharge: number }
  state: { phase: GamePhase }
}

export type GamePhase = 'menu' | 'playing' | 'gameover'
export type ViewMode = 'full' | 'follow'

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

  private table!: ReturnType<typeof buildCadetTable>
  private ballBody!: RAPIER.RigidBody
  private ballCollider!: RAPIER.Collider
  private ballMesh!: THREE.Mesh

  private theme: ThemeId = 'neon'
  private phase: GamePhase = 'menu'
  private viewMode: ViewMode = 'full'
  private camZoom = 1

  private camBaseTarget = new THREE.Vector3(0, 0.25, 0)
  private camDir = new THREE.Vector3(0, 1, 1)
  private camDistance = 0
  private camTarget = new THREE.Vector3(0, 0.25, 0)

  private score = 0
  private multiplier = 1
  private combo = 0
  private balls = 3
  private inLane = true
  private bonus = 0
  private laneLastHit = new Map<string, number>()
  private kickoutLocked = false
  private kickoutUntil = 0
  private pendingKickoutEject = false
  private dropResetAt = 0
  private spinnerPrevYaw = 0
  private spinnerArc = 0

  private plungerZ = 0
  private plungerSpeed = 0
  private plungerMode: 'idle' | 'pull' | 'fire' | 'return' = 'idle'
  private plungerFireMinZ = 0

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

  getViewMode() {
    return this.viewMode
  }

  getCameraZoom() {
    return this.camZoom
  }

  setTheme(theme: ThemeId) {
    this.theme = theme
    this.renderer.setTheme(THEMES[theme])
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode
    this.updateCamera(true, 0)
  }

  setCameraZoom(zoom: number) {
    this.camZoom = clamp(zoom, 0.85, 1.15)
    this.updateCamera(true, 0)
  }

  async init() {
    if (!this.rapierReady) {
      await RAPIER.init()
      this.rapierReady = true
    }

    // 2.5D pinball: gravity only along Z (table tilt). Y is locked for moving bodies.
    this.world = new RAPIER.World({ x: 0, y: 0, z: 10.5 })
    this.eventQueue = new RAPIER.EventQueue(true)

    this.table = buildCadetTable(this.world, this.renderer.scene, this.colliderMeta)
    this.createBall()

    this.camDir.set(0, 1.08, 0.86).normalize()
    this.camTarget.copy(this.camBaseTarget)
    this.updateCamera(true, 0)

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
    this.combo = 0
    this.balls = 3
    this.bonus = 0
    this.resetTargets()
    this.resetDrops(true)
    this.spawnBall(true)
    this.setPhase('playing')
    this.spinnerPrevYaw = 0
    this.spinnerArc = 0
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
    this.updateCamera(true, 0)
  }

  private loop = (t: number) => {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000)
    this.lastTime = t

    this.input.tick()
    this.step(dt, t)
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
    // Prevent hops/rail-jumps: keep simulation effectively on the XZ plane.
    this.ballBody.setEnabledTranslations(true, false, true, true)
    this.ballBody.setEnabledRotations(false, true, false, true)
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
    this.kickoutLocked = false
    this.pendingKickoutEject = false

    if (this.table.plunger) {
      this.plungerMode = 'idle'
      this.plungerSpeed = 0
      this.plungerZ = this.table.plunger.zRest
      this.plungerFireMinZ = this.table.plunger.zRest
      this.table.plunger.body.setTranslation(
        { x: this.table.plunger.x, y: this.table.plunger.y, z: this.plungerZ },
        true,
      )
    }
  }

  private step(dt: number, nowMs: number) {
    if (this.phase !== 'playing') return

    const st = this.input.getState()
    this.driveFlippers(st.leftFlipper, st.rightFlipper)

    const release = this.input.consumeLaunchRelease()
    let fireCharge = 0
    let fireNow = false
    if (this.inLane && release.released) {
      fireCharge = clamp01(release.charge)
      fireNow = true
    }

    this.accumulator += dt
    while (this.accumulator >= this.fixedDt) {
      this.accumulator -= this.fixedDt

      if (this.table.plunger) {
        if (fireNow) {
          this.startPlungerFire(fireCharge)
          fireNow = false
        }
        this.tickPlunger(st, this.fixedDt)
      } else if (this.inLane && fireNow) {
        // Fallback: if a table has no plunger, use the classic impulse launch.
        const t = fireCharge
        const power = 3.25 + 18.5 * (t * t)
        this.ballBody.applyImpulse({ x: 0, y: 0, z: -power }, true)
        void this.audio.click(640 + 260 * t)
        fireNow = false
      }

      this.world.step(this.eventQueue)
      this.handleEvents()
      this.postStep()
    }

    if (this.phase === 'playing') this.tickScripted(nowMs)
  }

  private postStep() {
    const p = this.ballBody.translation()

    if (this.inLane) {
      if (p.z < this.table.laneExitZ) this.inLane = false
      const lane = this.getShooterLaneBounds()
      if (lane && (p.x < lane.xMin || p.x > lane.xMax)) this.inLane = false

      // Safety: if the ball ends up behind the plunger/backstop, reset it.
      if (this.table.plunger && p.z > this.table.plunger.zPullMax + 0.35) {
        this.spawnBall(true)
        return
      }
    }

    const extra = 0.4
    const halfW = this.table.bounds.w / 2 + this.table.bounds.railMargin
    const halfL = this.table.bounds.l / 2 + this.table.bounds.railMargin
    if (Math.abs(p.x) > halfW + extra || p.z < -halfL - extra || p.z > this.table.drainZ + extra) {
      this.onDrain()
      return
    }
  }

  private tickScripted(nowMs: number) {
    this.tickSpinner()

    if (this.pendingKickoutEject && nowMs >= this.kickoutUntil && this.table.kickout) {
      this.pendingKickoutEject = false
      this.kickoutLocked = false
      const dir = this.table.kickout.ejectDir
      const impulse = new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(6.5)
      this.ballBody.setEnabled(true)
      this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
      this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
      this.ballBody.applyImpulse({ x: impulse.x, y: 0.18, z: impulse.z }, true)
      void this.audio.boom(170, 0.12)
      this.sparks.burst(this.table.kickout.position.clone().add(new THREE.Vector3(0, 0.22, 0)), new THREE.Color(0xb44cff), 0.9)
    }

    if (this.dropResetAt !== 0 && nowMs >= this.dropResetAt) {
      this.dropResetAt = 0
      this.resetDrops(false)
      void this.audio.click(780)
    }
  }

  private tickSpinner() {
    if (!this.table.spinner) return
    const q = this.table.spinner.body.rotation()
    const yaw = yawFromQuat(q.x, q.y, q.z, q.w)
    if (this.spinnerPrevYaw === 0) {
      this.spinnerPrevYaw = yaw
      return
    }
    const delta = wrapAngleRad(yaw - this.spinnerPrevYaw)
    this.spinnerPrevYaw = yaw
    this.spinnerArc += Math.abs(delta)
    const full = Math.PI * 2
    if (this.spinnerArc >= full) {
      const spins = Math.floor(this.spinnerArc / full)
      this.spinnerArc -= spins * full
      // Score per spin; no multiplier boost (classic feel).
      this.score += spins * 70 * this.multiplier
      void this.audio.click(740)
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

      if (meta.tag === 'sling') {
        this.addScore(meta.score ?? 180, 0.12)
        const pBall = this.ballBody.translation()
        const pOther = this.world.getCollider(other)?.translation()
        const v = new THREE.Vector3(pBall.x, 0, pBall.z)
        if (pOther) v.sub(new THREE.Vector3(pOther.x, 0, pOther.z))
        if (v.lengthSq() < 1e-6) v.set(Math.random() - 0.5, 0, Math.random() - 0.5)
        v.normalize().multiplyScalar(2.6)
        this.ballBody.applyImpulse({ x: v.x, y: 0.12, z: v.z }, true)
        this.sparks.burst(new THREE.Vector3(pBall.x, pBall.y + 0.12, pBall.z), new THREE.Color(0x7df9ff), 0.55)
        void this.audio.click(560 + Math.random() * 80)
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
            this.combo = 0
            this.addScore(1500, 0.25)
            this.sparks.burst(
              new THREE.Vector3(0, 0.6, -5.1),
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

      if (meta.tag === 'dropTarget' && meta.id) {
        const d = this.table.dropTargets.find((x) => x.colliderHandle === other)
        if (!d || d.down) return
        d.down = true
        setDropDown(d.mesh, true)
        this.addScore(meta.score ?? 500, 0.18)
        void this.audio.click(920)
        if (this.table.dropTargets.every((x) => x.down)) {
          this.addScore(2500, 0.35)
          this.multiplier = Math.min(8, this.multiplier + 1)
          this.combo = 0
          this.dropResetAt = performance.now() + 1800
          void this.audio.boom(190, 0.14)
        }
        return
      }

      if (meta.tag === 'spinner') {
        // Scored via angular travel to feel like a real spinner.
        void this.audio.click(680 + Math.random() * 70)
        return
      }

      if (meta.tag === 'kickout' && this.table.kickout && !this.kickoutLocked) {
        this.kickoutLocked = true
        this.pendingKickoutEject = true
        this.kickoutUntil = performance.now() + 900
        const p = this.table.kickout.position
        this.ballBody.setTranslation({ x: p.x, y: 0.14, z: p.z }, true)
        this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
        this.ballBody.setEnabled(false)
        this.addScore(meta.score ?? 650, 0.22)
        void this.audio.click(600)
        return
      }

      if (meta.tag === 'lane' && meta.id) {
        const now = performance.now()
        const last = this.laneLastHit.get(meta.id) ?? 0
        if (now - last < 350) return
        this.laneLastHit.set(meta.id, now)

        if (meta.id.includes('outlane')) {
          // Missing the flipper: this is effectively a drain.
          this.addScore(meta.score ?? 120, 0)
          this.onDrain()
          return
        }

        this.addScore(meta.score ?? 120, 0.04)
        this.bonus += 1

        const pBall = this.ballBody.translation()
        const pos = new THREE.Vector3(pBall.x, pBall.y + 0.12, pBall.z)
        const col = new THREE.Color(0x7df9ff)
        this.sparks.burst(pos, col, 0.45)
        void this.audio.click(760)
        return
      }
    })
  }

  private addScore(base: number, multiplierBoost: number) {
    this.score += Math.floor(base * this.multiplier)
    this.combo += multiplierBoost
    while (this.combo >= 1) {
      this.combo -= 1
      this.multiplier = Math.min(8, this.multiplier + 1)
    }
  }

  private resetTargets() {
    for (const t of this.table.targets) {
      t.lit = false
      setTargetLit(t.mesh, false)
    }
  }

  private resetDrops(silent: boolean) {
    for (const d of this.table.dropTargets) {
      d.down = false
      setDropDown(d.mesh, false)
    }
    if (!silent) this.sparks.burst(new THREE.Vector3(-0.2, 0.35, -1.1), new THREE.Color(0x9aa7ff), 0.7)
  }

  private onDrain() {
    if (this.phase !== 'playing') return
    if (this.bonus > 0) {
      const bonusScore = this.bonus * 100
      this.score += bonusScore
      this.bonus = 0
    }
    this.balls -= 1
    this.multiplier = 1
    this.combo = 0
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

    if (this.table.spinner) {
      const tp = this.table.spinner.body.translation()
      const rot = this.table.spinner.body.rotation()
      const mesh = this.table.spinner.mesh
      mesh.position.set(tp.x, tp.y, tp.z)
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    }

    if (this.table.plunger) {
      const tp = this.table.plunger.body.translation()
      this.table.plunger.mesh.position.set(tp.x, tp.y, tp.z)
      this.updatePlungerSpringVisual(this.table.plunger.mesh, tp.z)
    }

    this.sparks.tick(dt)

    this.updateCamera(false, dt)
    this.renderer.render()
  }

  private getShooterLaneBounds() {
    if (!this.table.plunger) return null
    const cx = this.table.plunger.x
    // Shooter lane is narrow: clamp to a conservative range so "inLane" doesn't stick.
    return { xMin: cx - 0.72, xMax: cx + 0.72 }
  }

  private isBallInShooterLane(p: { x: number; y: number; z: number }) {
    const lane = this.getShooterLaneBounds()
    if (!lane) return false
    if (p.x < lane.xMin || p.x > lane.xMax) return false
    // Must still be in the lane region along Z (hasn't exited up-table).
    if (p.z < this.table.laneExitZ - 0.08) return false
    // If it somehow drifts too far down-table, treat as invalid.
    if (p.z > this.table.drainZ + 0.4) return false
    return true
  }

  private driveFlippers(leftDown: boolean, rightDown: boolean) {
    const leftTarget = leftDown ? 0.35 : -0.65
    const rightTarget = rightDown ? -0.35 : 0.65
    this.table.flippers.left.joint.configureMotorPosition(leftTarget, 220, 22)
    this.table.flippers.right.joint.configureMotorPosition(rightTarget, 220, 22)
  }

  private startPlungerFire(charge: number) {
    if (!this.table.plunger || !this.inLane) return
    const p = this.ballBody.translation()
    if (!this.isBallInShooterLane(p)) {
      this.inLane = false
      return
    }
    const plunger = this.table.plunger
    const t = clamp01(charge)
    const eased = t * t
    // Ensure we're starting from at least the pulled position for this charge.
    this.plungerZ = Math.max(this.plungerZ, lerp(plunger.zRest, plunger.zPullMax, eased))
    const maxDist = Math.max(1e-6, plunger.zPullMax - plunger.zRest)
    const dist = Math.max(0, this.plungerZ - plunger.zRest)
    const n = Math.max(0, Math.min(1, dist / maxDist))
    this.plungerMode = 'fire'
    this.plungerFireMinZ = plunger.zRest - 0.22 * n
    this.plungerSpeed = 22 + 54 * (n * n)
    void this.audio.click(640 + 260 * n)
  }

  private tickPlunger(st: ReturnType<InputManager['getState']>, dt: number) {
    if (!this.table.plunger) return
    const plunger = this.table.plunger

    if (!this.inLane) {
      this.plungerMode = 'idle'
      this.plungerSpeed = 0
      this.plungerZ = plunger.zRest
      this.plungerFireMinZ = plunger.zRest
      plunger.body.setNextKinematicTranslation({ x: plunger.x, y: plunger.y, z: this.plungerZ })
      return
    }

    if (st.launchPressed) {
      this.plungerMode = 'pull'
      const t = clamp01(st.launchCharge)
      const eased = t * t
      this.plungerZ = lerp(plunger.zRest, plunger.zPullMax, eased)
      this.plungerSpeed = 0
      this.plungerFireMinZ = plunger.zRest
    } else if (this.plungerMode === 'fire') {
      this.plungerZ -= this.plungerSpeed * dt
      this.plungerSpeed *= Math.exp(-dt * 7.5)
      if (this.plungerZ <= this.plungerFireMinZ) {
        this.plungerZ = this.plungerFireMinZ
        this.plungerMode = 'return'
        this.plungerSpeed = 28
      }
    } else if (this.plungerMode === 'return') {
      this.plungerZ += this.plungerSpeed * dt
      this.plungerSpeed *= Math.exp(-dt * 7.0)
      if (this.plungerZ >= plunger.zRest - 0.0015) {
        this.plungerZ = plunger.zRest
        this.plungerMode = 'idle'
        this.plungerSpeed = 0
        this.plungerFireMinZ = plunger.zRest
      }
    } else {
      this.plungerMode = 'idle'
      this.plungerSpeed = 0
      this.plungerZ = plunger.zRest
      this.plungerFireMinZ = plunger.zRest
    }

    const minZ = Math.min(plunger.zRest, this.plungerFireMinZ)
    this.plungerZ = clamp(this.plungerZ, minZ, plunger.zPullMax)
    plunger.body.setNextKinematicTranslation({ x: plunger.x, y: plunger.y, z: this.plungerZ })
  }

  private updatePlungerSpringVisual(mesh: THREE.Object3D, z: number) {
    if (!this.table.plunger) return
    const spring = (mesh.userData as any)?.spring
    const rings = spring?.rings as THREE.Mesh[] | undefined
    if (!rings || rings.length === 0) return
    const minZ = Number(spring?.minZ ?? 0.18)
    const maxZ = Number(spring?.maxZ ?? 0.88)
    const t = (z - this.table.plunger.zRest) / Math.max(1e-6, this.table.plunger.zPullMax - this.table.plunger.zRest)
    const pull = clamp01(t)
    const span = lerp(maxZ - minZ, (maxZ - minZ) * 0.45, pull)
    for (let i = 0; i < rings.length; i++) {
      const u = rings.length === 1 ? 0.5 : i / (rings.length - 1)
      rings[i].position.z = minZ + span * u
    }
  }

  private updateCamera(forceFit: boolean, dt: number) {
    const camera = this.renderer.camera
    if (forceFit || this.camDistance === 0) {
      const aspect = camera.aspect || 1
      let baseSafe = 0.92
      if (aspect >= 1.35) baseSafe = 0.95
      else if (aspect <= 0.85) baseSafe = 0.88
      const safeNdc = clamp(baseSafe * this.camZoom, 0.82, 0.97)

      this.camDistance = computeFitDistance({
        camera,
        target: this.camBaseTarget,
        viewDir: this.camDir,
        bounds: this.table.bounds,
        safeNdc,
        yMin: -0.14,
        yMax: 1.15,
        minDistance: 3.5,
        maxDistance: 60,
      })
    }

    const desired = new THREE.Vector3().copy(this.camBaseTarget)
    if (this.viewMode === 'follow' && this.phase === 'playing') {
      const p = this.ballBody.translation()
      desired.x += clamp(p.x * 0.12, -0.55, 0.55)
      desired.z += clamp(p.z * 0.12, -0.85, 1.15)
    }

    if (dt > 0) {
      const k = 1 - Math.exp(-dt * 6)
      this.camTarget.lerp(desired, k)
    } else {
      this.camTarget.copy(desired)
    }

    camera.position.copy(this.camTarget).addScaledVector(this.camDir, this.camDistance)
    camera.lookAt(this.camTarget)
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function wrapAngleRad(a: number) {
  let x = a
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

function yawFromQuat(x: number, y: number, z: number, w: number) {
  // yaw (Y axis) from quaternion
  const siny = 2 * (w * y + x * z)
  const cosy = 1 - 2 * (y * y + z * z)
  return Math.atan2(siny, cosy)
}
