import * as THREE from 'three'

export type TableBounds = {
  w: number
  l: number
  railMargin: number
}

export function computeFitDistance(opts: {
  camera: THREE.PerspectiveCamera
  target: THREE.Vector3
  viewDir: THREE.Vector3
  bounds: TableBounds
  safeNdc?: number
  yMin?: number
  yMax?: number
  minDistance?: number
  maxDistance?: number
}) {
  const safe = Math.max(0.5, Math.min(0.995, opts.safeNdc ?? 0.92))
  const hx = opts.bounds.w / 2 + opts.bounds.railMargin
  const hz = opts.bounds.l / 2 + opts.bounds.railMargin
  const yMin = opts.yMin ?? -0.25
  const yMax = opts.yMax ?? 1.25
  const viewDir = opts.viewDir.clone().normalize()

  const corners: THREE.Vector3[] = []
  for (const x of [-hx, hx]) {
    for (const y of [yMin, yMax]) {
      for (const z of [-hz, hz]) corners.push(new THREE.Vector3(x, y, z))
    }
  }

  const tmp = new THREE.Vector3()
  const pos = new THREE.Vector3()
  const minD = Math.max(0.25, opts.minDistance ?? 0.8)
  let hi = Math.max(minD, opts.maxDistance ?? 120)

  const fits = (d: number) => {
    pos.copy(opts.target).addScaledVector(viewDir, d)
    opts.camera.position.copy(pos)
    opts.camera.lookAt(opts.target)
    opts.camera.updateMatrixWorld(true)
    for (const c of corners) {
      tmp.copy(c).project(opts.camera)
      if (!Number.isFinite(tmp.x) || !Number.isFinite(tmp.y) || tmp.z < -1 || tmp.z > 1) return false
      if (Math.abs(tmp.x) > safe || Math.abs(tmp.y) > safe) return false
    }
    return true
  }

  // Ensure upper bound is sufficient.
  let tries = 0
  while (!fits(hi) && tries++ < 18) hi *= 1.35

  let lo = minD
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }

  return hi
}
