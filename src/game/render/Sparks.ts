import * as THREE from 'three'

type Spark = {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  maxLife: number
  color: THREE.Color
}

export class Sparks {
  private sparks: Spark[] = []
  private geometry = new THREE.BufferGeometry()
  private material = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  private points = new THREE.Points(this.geometry, this.material)

  constructor() {
    this.points.frustumCulled = false
  }

  get object3d() {
    return this.points
  }

  burst(center: THREE.Vector3, baseColor: THREE.Color, strength: number) {
    const count = Math.floor(8 + 18 * Math.min(1, strength))
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        (Math.random() * 2 - 1) * 1.0,
        (Math.random() * 0.8 + 0.2) * 1.0,
        (Math.random() * 2 - 1) * 1.0,
      ).normalize()
      const speed = 2.5 + Math.random() * 4.5 + strength * 4
      this.sparks.push({
        pos: center.clone(),
        vel: dir.multiplyScalar(speed),
        life: 0,
        maxLife: 0.22 + Math.random() * 0.24,
        color: baseColor.clone().lerp(new THREE.Color(0xffffff), 0.4 + Math.random() * 0.4),
      })
    }
  }

  tick(dt: number) {
    const gravity = -10
    for (const s of this.sparks) {
      s.life += dt
      s.vel.y += gravity * dt * 0.2
      s.pos.addScaledVector(s.vel, dt)
      s.vel.multiplyScalar(0.98)
    }
    this.sparks = this.sparks.filter((s) => s.life < s.maxLife)
    this.syncBuffers()
  }

  private syncBuffers() {
    const n = this.sparks.length
    const positions = new Float32Array(n * 3)
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const s = this.sparks[i]
      positions[i * 3 + 0] = s.pos.x
      positions[i * 3 + 1] = s.pos.y
      positions[i * 3 + 2] = s.pos.z
      const fade = 1 - s.life / s.maxLife
      colors[i * 3 + 0] = s.color.r * fade
      colors[i * 3 + 1] = s.color.g * fade
      colors[i * 3 + 2] = s.color.b * fade
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry.computeBoundingSphere()
  }
}

