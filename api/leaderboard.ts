const KEY = 'ball3d:lb:table1:v1'

export default async function handler(req: any, res: any) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit
  const limit = Math.max(1, Math.min(50, Number(limitRaw ?? 20) || 20))

  let kv: any = null
  try {
    const mod = await import('./_lib/kv.js')
    kv = mod.kv
  } catch (e) {
    console.error('kv import failed', e)
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'Server init failed.', detail: msg.slice(0, 180) })
  }

  if (!kv) return res.status(503).json({ error: 'Leaderboard not configured.' })

  try {
    const entries = await kv.zrange(KEY, 0, limit - 1, {
      rev: true,
      withScores: true,
    })
    const items: Array<{ name: string; score: number }> = []
    if (Array.isArray(entries)) {
      for (let i = 0; i < entries.length; i += 2) {
        const name = String(entries[i] ?? '').trim()
        const score = Math.floor(Number(entries[i + 1] ?? 0))
        if (!Number.isFinite(score) || score <= 0) continue
        items.push({ name: name || 'Anonymous', score })
      }
    }
    return res.status(200).json({ items })
  } catch (e) {
    console.error('leaderboard failed', e)
    return res.status(502).json({ error: 'Upstash request failed.' })
  }
}
