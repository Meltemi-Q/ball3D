export type InputState = {
  leftFlipper: boolean
  rightFlipper: boolean
  launchPressed: boolean
  launchCharge: number
}

export class InputManager {
  private state: InputState = {
    leftFlipper: false,
    rightFlipper: false,
    launchPressed: false,
    launchCharge: 0,
  }

  private launchStartMs: number | null = null
  private readonly maxChargeMs = 1200
  private launchWasDown = false
  private launchReleasedPulse = false

  attach() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  getState(): InputState {
    return { ...this.state }
  }

  consumeLaunchRelease(): { released: boolean; charge: number } {
    const released = this.launchReleasedPulse
    const charge = this.state.launchCharge
    this.launchReleasedPulse = false
    return { released, charge }
  }

  setLeftFlipper(down: boolean) {
    this.state.leftFlipper = down
  }

  setRightFlipper(down: boolean) {
    this.state.rightFlipper = down
  }

  setLaunch(down: boolean) {
    if (down) {
      if (!this.state.launchPressed) this.launchStartMs = performance.now()
      this.state.launchPressed = true
      return
    }
    this.state.launchPressed = false
    this.launchStartMs = null
  }

  tick() {
    this.launchReleasedPulse = false

    if (this.launchWasDown && !this.state.launchPressed) {
      this.launchReleasedPulse = true
    }
    this.launchWasDown = this.state.launchPressed

    if (!this.state.launchPressed || this.launchStartMs === null) {
      this.state.launchCharge = 0
      return
    }
    const elapsed = performance.now() - this.launchStartMs
    const t = Math.max(0, Math.min(1, elapsed / this.maxChargeMs))
    this.state.launchCharge = t
  }

  private onBlur = () => {
    this.state.leftFlipper = false
    this.state.rightFlipper = false
    this.setLaunch(false)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.state.leftFlipper = true
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.state.rightFlipper = true
    if (e.code === 'Space') this.setLaunch(true)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.state.leftFlipper = false
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.state.rightFlipper = false
    if (e.code === 'Space') this.setLaunch(false)
  }
}

