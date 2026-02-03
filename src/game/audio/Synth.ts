export class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private enabled = true
  private volume = 0.65

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.master) this.master.gain.value = this.volume
  }

  async ensure() {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(this.ctx.destination)
  }

  async unlock() {
    await this.ensure()
    if (!this.ctx) return
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  async click(pitch = 720, dur = 0.045) {
    if (!this.enabled) return
    await this.ensure()
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(pitch, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.01)
  }

  async boom(pitch = 140, dur = 0.12) {
    if (!this.enabled) return
    await this.ensure()
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(pitch, t0)
    osc.frequency.exponentialRampToValueAtTime(60, t0 + dur)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }
}

