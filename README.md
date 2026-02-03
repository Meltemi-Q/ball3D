# Ball3D Pinball (Web)

三维弹球（刷分模式，1 张桌台），技术栈：`Vite + TypeScript + Three.js + Rapier3D + postprocessing`。支持桌面+移动网页、匿名同步排行榜、2 套主题（Neon / Dark Minimal）。

## 本地运行

```bash
npm install
npm run dev
```

键位：
- 左翻板：`A` 或 `←`
- 右翻板：`D` 或 `→`
- 发射：`Space`（按住蓄力，松开发射）

## 排行榜（Vercel + Upstash）

1) 创建 Upstash Redis（REST API）
2) 配置环境变量（本地 `.env` 或 Vercel Project → Settings → Environment Variables）：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

本地带 API 调试（推荐）：
```bash
npm run vercel:dev
```

## 部署到 Vercel

- 直接导入仓库即可（`vercel.json` 已包含 Vite 配置）。
- 未配置 Upstash env vars 时，在线排行榜接口会返回 503，前端会自动降级到本地榜（localStorage）。

