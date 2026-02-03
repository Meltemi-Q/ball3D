# Verification

## Build / Typecheck

```bash
npm run build
```

Expected:
- `tsc` passes with no errors
- `vite build` outputs `dist/`

## Local Playtest

```bash
npm run dev
```

Expected:
- 页面加载后显示菜单（点击 Play 开始）
- `A/D` 或 `←/→` 控制翻板
- `Space` 按住蓄力、松开发射
- 击中 Targets 会点亮；全部点亮触发奖励并重置
- Ball 掉入 drain 会扣一球；3 球后 Game Over

## Leaderboard (Local + Vercel dev)

1) 配置 `.env`（参考 `.env.example`）
2) 运行：

```bash
npm run vercel:dev
```

Expected:
- 菜单中打开 Leaderboard 能读取在线榜单
- 提交分数成功后刷新榜单可看到记录

Fallback:
- 未配置 Upstash env vars 时，Leaderboard 显示 Local，提交会保存到 localStorage

