# Ball3D Pinball — Spec (v0)

## 已确认的产品方向（更新）

- 平台：桌面 + 移动网页
- 模式：刷分 Arcade（不做强制闯关）
- 桌台：1 张（做精致/手感优先）
- 主题：2 套（Neon / Dark Minimal），可实时切换
- 排行榜：匿名同步（MVP，不做强防作弊）
- 部署：Vercel（API + 静态资源），本地可用 `vercel dev`

## 版权与致敬边界

- 本项目为“军工科幻风致敬版”：实现经典弹球桌常见组件与机制，但布局/命名/贴图均为原创。
- 桌面贴图由程序生成（CanvasTexture），避免使用原作截图/资源。

## 技术栈

- 渲染：Three.js
- 物理：Rapier3D（WASM）
- 后期：postprocessing（Bloom/Vignette/SMAA）
- 音频：WebAudio（轻量合成音效）
- UI：原生 DOM/CSS（轻量、移动端友好）
- 排行榜：Vercel Serverless Functions + Upstash Redis（可选；未配置时自动降级本地榜）

## 当前实现包含的核心玩法

- 发射：按住 Space 蓄力、松开发射（移动端 Launch 按钮）
- 翻板：左右翻板（键盘 A/D 或 ←/→；移动端 Left/Right 按钮）
- 目标：命中目标点亮；全部点亮触发奖励并提升倍率
- 保险：落入 drain 触发掉球；3 球结束 Game Over
- 反馈：霓虹灯、Bloom、火花粒子、音效提示

## 计分/倍率（可调）

- Bumper：`base=120`，按倍率累加，同时轻微提升倍率
- Target：`base=250`，首次点亮计分
- All Targets Lit：`base=1500` + 倍率 + 倍率上限提升（当前上限 8）

## 排行榜 API

- `GET /api/leaderboard?limit=20`
- `POST /api/score { name, score }`
- 速率限制：按 IP 简易限流（可关/可调）

## 验收标准（v0）

1) 可运行：`npm run dev` 可直接进入主菜单并开始游戏
2) 可玩：从发射到翻板、击中目标、掉球、Game Over 全链路可完成
3) 稳定：连续游玩 10 分钟不崩溃、不出现明显穿模（CCD 已开）
4) 体验：主题切换不闪退；移动端按钮可用（横屏建议）
5) 部署：Vercel 部署成功；配置 Upstash 后在线排行榜可读写

## 手动测试清单（建议每次改动后过一遍）

- 桌面：键盘翻板、Space 蓄力释放、目标点亮/奖励、掉球与重生
- 移动：触控按钮响应、不会卡住（pointer capture / cancel）
- 主题：Neon/Dark 来回切换，Bloom 强度符合预期
- 排行榜：无 env 时降级本地；有 env 时可提交并刷新榜单
