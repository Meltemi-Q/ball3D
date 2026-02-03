import * as THREE from 'three'

export type DeckTheme = {
  base: string
  grid: string
  accent: string
  accent2: string
  text: string
}

export function createDeckTexture(width = 1024, height = 2048, theme?: Partial<DeckTheme>) {
  const t: DeckTheme = {
    base: theme?.base ?? '#0a0b14',
    grid: theme?.grid ?? 'rgba(140, 160, 255, 0.14)',
    accent: theme?.accent ?? '#7df9ff',
    accent2: theme?.accent2 ?? '#b44cff',
    text: theme?.text ?? 'rgba(245,247,255,0.9)',
  }

  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D ctx unavailable')

  // Background.
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, '#060712')
  bg.addColorStop(0.25, t.base)
  bg.addColorStop(1, '#06060d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Subtle noise.
  const img = ctx.getImageData(0, 0, width, height)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 18) | 0
    img.data[i + 0] = Math.min(255, img.data[i + 0] + n)
    img.data[i + 1] = Math.min(255, img.data[i + 1] + n)
    img.data[i + 2] = Math.min(255, img.data[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)

  // Grid.
  ctx.globalAlpha = 1
  ctx.strokeStyle = t.grid
  ctx.lineWidth = 1
  const step = 64
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
    ctx.stroke()
  }

  // Panels + stripes.
  ctx.globalAlpha = 0.9
  for (let i = 0; i < 10; i++) {
    const px = (Math.random() * width * 0.8 + width * 0.1) | 0
    const py = (Math.random() * height * 0.8 + height * 0.1) | 0
    const pw = (Math.random() * 260 + 180) | 0
    const ph = (Math.random() * 340 + 220) | 0
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
  }

  ctx.globalAlpha = 0.95
  drawStripe(ctx, width, height, t.accent, 0.18)
  drawStripe(ctx, width, height, t.accent2, 0.12)

  // Labels.
  ctx.globalAlpha = 1
  ctx.fillStyle = t.text
  ctx.font = '700 42px ui-sans-serif, system-ui, -apple-system'
  ctx.fillText('CADET OPS', 48, 86)
  ctx.font = '500 24px ui-sans-serif, system-ui, -apple-system'
  ctx.globalAlpha = 0.75
  ctx.fillText('NEURAL PINBALL TRAINING DECK', 48, 118)

  ctx.globalAlpha = 0.72
  ctx.font = '600 22px ui-sans-serif, system-ui, -apple-system'
  ctx.fillText('ROLL LANE', 110, 362)
  ctx.fillText('DROP TARGETS', 96, 742)
  ctx.fillText('SPINNER', 116, 1048)
  ctx.fillText('KICKOUT', 112, 1368)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function drawStripe(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.translate(w * 0.5, h * 0.65)
  ctx.rotate(-0.22)
  ctx.fillRect(-w * 0.6, -42, w * 1.2, 34)
  ctx.globalAlpha = alpha * 0.55
  ctx.fillRect(-w * 0.6, 4, w * 1.2, 18)
  ctx.restore()
}

