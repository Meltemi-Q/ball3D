const KEY = 'ball3d:lb:table1:v1'

function sanitizeName(name: unknown) {
  const raw = String(name ?? '').trim() || 'Anonymous'
  const safe = raw.replace(/[^\p{L}\p{N}_\- ]/gu, '').slice(0, 12)
  return safe || 'Anonymous'
}

export default async function handler(req: any, res: any) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  let kv: any = null
  let ratelimit: any = null
  try {
    const mod = await import('./_lib/kv.js')
    kv = mod.kv
    ratelimit = mod.ratelimit
  } catch (e) {
    console.error('kv import failed', e)
    return res.status(500).send('Server init failed.')
  }

  if (!kv) return res.status(503).send('Leaderboard not configured.')

  if (ratelimit) {
    const ip = (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      .toString()
      .split(',')[0]
      .trim()
    const { success } = await ratelimit.limit(`rl:${ip}`)
    if (!success) return res.status(429).send('Rate limit exceeded.')
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const name = sanitizeName(body?.name)
  const score = Math.floor(Number(body?.score ?? 0))
  if (!Number.isFinite(score) || score <= 0 || score > 2_000_000_000) return res.status(400).send('Invalid score.')

  try {
    await kv.zadd(KEY, { score, member: name })
    await kv.expire(KEY, 60 * 60 * 24 * 365)
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('score submit failed', e)
    return res.status(502).send('Upstash request failed.')
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
