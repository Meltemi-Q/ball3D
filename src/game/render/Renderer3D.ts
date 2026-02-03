import * as THREE from 'three'
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  VignetteEffect,
} from 'postprocessing'
import type { ThemeConfig } from '../Theme'

export class Renderer3D {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly composer: EffectComposer
  private bloom: BloomEffect
  private vignette: VignetteEffect

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x05060b, 0.035)

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200)
    this.camera.position.set(0, 9.5, 12.5)
    this.camera.lookAt(0, 0.3, -1.6)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.bloom = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.15,
      mipmapBlur: true,
    })
    this.vignette = new VignetteEffect({
      eskil: false,
      offset: 0.15,
      darkness: 0.4,
    })
    const smaa = new SMAAEffect()
    const effectPass = new EffectPass(this.camera, this.bloom, this.vignette, smaa)
    effectPass.renderToScreen = true

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(effectPass)

    const ambient = new THREE.AmbientLight(0x4b4f88, 0.45)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xb0d4ff, 0.9)
    key.position.set(6, 10, 6)
    this.scene.add(key)

    const fill = new THREE.PointLight(0xb44cff, 3.2, 25, 2.2)
    fill.position.set(-2.5, 4.2, 1.0)
    this.scene.add(fill)
  }

  setTheme(theme: ThemeConfig) {
    this.renderer.toneMappingExposure = theme.rendererExposure
    this.bloom.intensity = theme.bloomIntensity
    const lm =
      (this.bloom as any)?.luminanceMaterial ??
      (this.bloom as any)?.luminancePass?.material ??
      (this.bloom as any)?.luminancePass?.fullscreenMaterial
    if (lm && typeof lm.threshold === 'number') lm.threshold = theme.bloomLuminanceThreshold
    this.vignette.darkness = theme.vignette
  }

  resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.composer.setSize(w, h)
  }

  render() {
    this.composer.render()
  }

  dispose() {
    this.composer.dispose()
    this.renderer.dispose()
  }
}
