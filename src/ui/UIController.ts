import { GameApp, type ViewMode } from '../game/GameApp'
import type { ThemeId } from '../game/Theme'
import { THEMES } from '../game/Theme'
import { LeaderboardClient } from './leaderboard/LeaderboardClient'

export type UIControllerOptions = {
  uiRoot: HTMLDivElement
  appRoot: HTMLDivElement
  game: GameApp
}

export class UIController {
  private overlayEl!: HTMLDivElement
  private leaderboard = new LeaderboardClient()
  private viewKey = 'ball3d:view:v1'
  private zoomKey = 'ball3d:zoom:v1'

  private options: UIControllerOptions

  constructor(options: UIControllerOptions) {
    this.options = options
  }

  init() {
    this.mount()
    this.bind()
    this.renderTheme()
    this.showMenu()
  }

  private mount() {
    const { uiRoot } = this.options
    uiRoot.innerHTML = `
      <div class="ui-layer" style="display:grid; grid-template-rows:auto 1fr auto; padding:14px; gap:12px;">
        <div id="hud" class="panel" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px;">
          <div style="display:flex; gap:14px; align-items:baseline; flex-wrap:wrap;">
            <div style="font-weight:800; letter-spacing:0.6px;">CADET OPS</div>
            <div class="hud-hint" style="opacity:.7; font-size:13px;">A/D 或 ←/→ 翻板，<span class="kbd">Space</span> 发射（按住蓄力）</div>
          </div>
          <div style="display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; justify-content:flex-end;">
            <div>Score <span id="score" style="font-variant-numeric: tabular-nums; font-weight:800;">0</span></div>
            <div>x<span id="mult" style="font-variant-numeric: tabular-nums; font-weight:700;">1</span></div>
            <div>Balls <span id="balls" style="font-variant-numeric: tabular-nums; font-weight:700;">3</span></div>
            <div class="charge-wrap" style="display:flex; align-items:center; gap:8px;">
              <div style="opacity:.75; font-size:12px;">Charge</div>
              <div class="chargebar"><div id="chargeFill" class="chargefill"></div></div>
            </div>
            <button class="btn" id="btnTheme" title="切换主题">Theme</button>
            <button class="btn" id="btnMenu" title="菜单">Menu</button>
          </div>
        </div>
        <div style="pointer-events:none;"></div>
        <div id="mobile" style="display:none; justify-content:space-between; gap:12px;">
          <button class="btn btn-primary" id="btnLeft" style="flex:1; padding:14px 0;">Left</button>
          <button class="btn btn-primary" id="btnLaunch" style="flex:1; padding:14px 0;">Launch</button>
          <button class="btn btn-primary" id="btnRight" style="flex:1; padding:14px 0;">Right</button>
        </div>
      </div>
      <div id="overlay" class="ui-layer" style="position:absolute; inset:0; display:none; place-items:center; padding:18px;">
        <div id="menu" class="panel" style="width:min(560px, 92vw); padding:16px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-size:18px; font-weight:900; letter-spacing:0.6px;">Cadet Ops Pinball</div>
              <div style="opacity:.75; font-size:13px; margin-top:4px;">军工科幻风致敬版 · 刷分模式（1 张桌台） · 主题可切换 · 匿名排行榜</div>
            </div>
            <button class="btn" id="btnClose">Close</button>
          </div>
          <div style="height:12px;"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-primary" id="btnPlay">Play</button>
            <button class="btn" id="btnRestart">Restart</button>
            <button class="btn" id="btnLeaderboard">Leaderboard</button>
          </div>
          <div style="height:10px;"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="opacity:.75; font-size:13px;">View</div>
            <button class="btn" id="btnViewFull">Full</button>
            <button class="btn" id="btnViewFollow">Follow</button>
          </div>
          <div style="height:10px;"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="opacity:.75; font-size:13px;">Zoom</div>
            <input id="rngZoom" type="range" min="90" max="135" step="1" value="100"
              style="flex:1; min-width:180px; accent-color: var(--accent);" />
            <div id="zoomVal" style="opacity:.8; font-size:12px; width:52px; text-align:right;">100%</div>
          </div>
          <div style="height:14px;"></div>
          <div class="panel" style="padding:12px; border-radius:12px; background:rgba(0,0,0,.18);">
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
              <div style="opacity:.8; font-size:13px;">
                移动端：底部按钮操作（左右翻板/发射）。为避免误触，建议横屏。
              </div>
              <div style="display:flex; gap:10px; align-items:center;">
                <label style="display:flex; gap:8px; align-items:center; font-size:13px; opacity:.9;">
                  <input type="checkbox" id="chkAudio" checked />
                  音效
                </label>
                <button class="btn" id="btnUnlockAudio">解锁音频</button>
              </div>
            </div>
          </div>
          <div id="menuContent" style="margin-top:12px;"></div>
        </div>
      </div>
    `
    this.overlayEl = uiRoot.querySelector<HTMLDivElement>('#overlay')!
  }

  private bind() {
    const { uiRoot, game } = this.options
    const scoreEl = uiRoot.querySelector<HTMLSpanElement>('#score')!
    const multEl = uiRoot.querySelector<HTMLSpanElement>('#mult')!
    const ballsEl = uiRoot.querySelector<HTMLSpanElement>('#balls')!
    const chargeFill = uiRoot.querySelector<HTMLDivElement>('#chargeFill')!

    uiRoot.querySelector<HTMLButtonElement>('#btnMenu')!.addEventListener('click', () => {
      this.showMenu()
    })
    uiRoot.querySelector<HTMLButtonElement>('#btnTheme')!.addEventListener('click', () => {
      const next: ThemeId = game.getTheme() === 'neon' ? 'dark' : 'neon'
      game.setTheme(next)
      this.renderTheme()
      void game.audio.click(next === 'neon' ? 820 : 520)
    })

    const btnViewFull = uiRoot.querySelector<HTMLButtonElement>('#btnViewFull')!
    const btnViewFollow = uiRoot.querySelector<HTMLButtonElement>('#btnViewFollow')!
    const rngZoom = uiRoot.querySelector<HTMLInputElement>('#rngZoom')!
    const zoomVal = uiRoot.querySelector<HTMLDivElement>('#zoomVal')!
    const applyView = (mode: ViewMode) => {
      localStorage.setItem(this.viewKey, mode)
      game.setViewMode(mode)
      btnViewFull.classList.toggle('btn-primary', mode === 'full')
      btnViewFollow.classList.toggle('btn-primary', mode === 'follow')
    }
    const saved = localStorage.getItem(this.viewKey)
    applyView(saved === 'follow' ? 'follow' : 'full')

    const applyZoom = (zoom: number) => {
      const z = Math.max(0.9, Math.min(1.35, zoom))
      game.setCameraZoom(z)
      zoomVal.textContent = `${Math.round(z * 100)}%`
      rngZoom.value = String(Math.round(z * 100))
      localStorage.setItem(this.zoomKey, String(z))
    }
    const savedZoomRaw = localStorage.getItem(this.zoomKey)
    const defaultZoom = window.innerWidth / Math.max(1, window.innerHeight) >= 1.35 ? 1.1 : 1.0
    const savedZoom = savedZoomRaw === null ? defaultZoom : Number(savedZoomRaw)
    applyZoom(Number.isFinite(savedZoom) ? savedZoom : defaultZoom)
    rngZoom.addEventListener('input', () => {
      const v = Number(rngZoom.value) / 100
      applyZoom(v)
    })

    uiRoot.querySelector<HTMLButtonElement>('#btnClose')!.addEventListener('click', () => {
      this.hideMenu()
    })
    uiRoot.querySelector<HTMLButtonElement>('#btnPlay')!.addEventListener('click', () => {
      game.startRun()
      this.hideMenu()
    })
    uiRoot.querySelector<HTMLButtonElement>('#btnRestart')!.addEventListener('click', () => {
      game.restartRun()
      this.hideMenu()
    })
    uiRoot.querySelector<HTMLButtonElement>('#btnLeaderboard')!.addEventListener('click', async () => {
      await this.renderLeaderboard()
    })

    btnViewFull.addEventListener('click', () => applyView('full'))
    btnViewFollow.addEventListener('click', () => applyView('follow'))

    const chkAudio = uiRoot.querySelector<HTMLInputElement>('#chkAudio')!
    chkAudio.addEventListener('change', () => {
      game.audio.setEnabled(chkAudio.checked)
    })

    uiRoot.querySelector<HTMLButtonElement>('#btnUnlockAudio')!.addEventListener('click', async () => {
      await game.audio.unlock()
      void game.audio.click(900)
    })

    game.events.on('hud', ({ score, multiplier, balls, launchCharge }) => {
      scoreEl.textContent = score.toString()
      multEl.textContent = multiplier.toString()
      ballsEl.textContent = balls.toString()
      chargeFill.style.width = `${Math.round(Math.max(0, Math.min(1, launchCharge)) * 100)}%`
    })

    game.events.on('state', ({ phase }) => {
      if (phase === 'menu' || phase === 'gameover') this.showMenu()
    })

    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches
    if (isTouch) {
      const mobile = uiRoot.querySelector<HTMLDivElement>('#mobile')!
      mobile.style.display = 'flex'
      const bindBtn = (id: string, down: () => void, up: () => void) => {
        const el = uiRoot.querySelector<HTMLButtonElement>(id)!
        const onDown = (e: PointerEvent) => {
          el.setPointerCapture(e.pointerId)
          down()
        }
        const onUp = () => up()
        el.addEventListener('pointerdown', onDown)
        el.addEventListener('pointerup', onUp)
        el.addEventListener('pointercancel', onUp)
        el.addEventListener('lostpointercapture', onUp)
      }
      bindBtn('#btnLeft', () => game.input.setLeftFlipper(true), () => game.input.setLeftFlipper(false))
      bindBtn('#btnRight', () => game.input.setRightFlipper(true), () => game.input.setRightFlipper(false))
      bindBtn('#btnLaunch', () => game.input.setLaunch(true), () => game.input.setLaunch(false))
    }
  }

  private renderTheme() {
    const { appRoot, game } = this.options
    for (const t of Object.values(THEMES)) appRoot.classList.remove(t.cssClass)
    appRoot.classList.add(THEMES[game.getTheme()].cssClass)
  }

  private showMenu() {
    this.overlayEl.style.display = 'grid'
  }

  private hideMenu() {
    this.overlayEl.style.display = 'none'
  }

  private async renderLeaderboard() {
    const content = this.options.uiRoot.querySelector<HTMLDivElement>('#menuContent')!
    content.innerHTML = `<div style="opacity:.8; font-size:13px;">Loading leaderboard…</div>`
    const res = await this.leaderboard.getTop({ limit: 20 })
    if (!res.ok) {
      content.innerHTML = `<div style="opacity:.8; font-size:13px;">Leaderboard unavailable. ${escapeHtml(
        res.error,
      )}</div>`
      return
    }
    const items = res.items
      .map(
        (it, idx) => `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.08);">
        <div style="opacity:.85;">#${idx + 1} ${escapeHtml(it.name)}</div>
        <div style="font-variant-numeric: tabular-nums; font-weight:800;">${it.score}</div>
      </div>`,
      )
      .join('')
    content.innerHTML = `
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px;">
        <div style="font-weight:800;">Leaderboard</div>
        <div style="opacity:.7; font-size:12px;">${res.source === 'online' ? 'Online' : 'Local'}</div>
      </div>
      <div style="height:8px;"></div>
      <div class="panel" style="padding:10px; border-radius:12px; background:rgba(0,0,0,.18); max-height:280px; overflow:auto;">
        ${items || `<div style="opacity:.75; font-size:13px;">No scores yet.</div>`}
      </div>
      <div style="height:10px;"></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input id="lbName" placeholder="昵称(匿名)" maxlength="12"
          style="flex:1; min-width:180px; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.22); color:var(--text); outline:none;" />
        <button class="btn btn-primary" id="btnSubmitScore">提交当前分数</button>
      </div>
      <div style="opacity:.7; font-size:12px; margin-top:8px;">提示：匿名榜默认不防作弊（后续可升级回放校验）。</div>
    `
    const btn = content.querySelector<HTMLButtonElement>('#btnSubmitScore')
    btn?.addEventListener('click', async () => {
      const name = (content.querySelector<HTMLInputElement>('#lbName')?.value || 'Anonymous').trim()
      const score = Number(this.options.uiRoot.querySelector('#score')?.textContent || '0') || 0
      btn.disabled = true
      btn.textContent = '提交中…'
      const submit = await this.leaderboard.submit({ name, score })
      btn.disabled = false
      btn.textContent = submit.ok ? '已提交（刷新榜单）' : '提交失败'
      if (!submit.ok) {
        content.insertAdjacentHTML(
          'beforeend',
          `<div style="margin-top:8px; opacity:.8; font-size:12px; color:var(--danger);">${escapeHtml(
            submit.error,
          )}</div>`,
        )
      } else {
        await this.renderLeaderboard()
      }
    })
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
