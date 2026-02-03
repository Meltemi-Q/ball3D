import './style.css'
import { GameApp } from './game/GameApp'
import { UIController } from './ui/UIController'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('Missing #app root')

root.innerHTML = `
  <div class="app-root theme-neon" id="appRoot">
    <canvas class="game-canvas" id="gameCanvas"></canvas>
    <div class="ui-root" id="uiRoot"></div>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')
const uiRoot = document.querySelector<HTMLDivElement>('#uiRoot')
const appRoot = document.querySelector<HTMLDivElement>('#appRoot')
if (!canvas || !uiRoot || !appRoot) throw new Error('Missing root elements')

const game = new GameApp({ canvas })
const ui = new UIController({ uiRoot, appRoot, game })

await game.init()
ui.init()
