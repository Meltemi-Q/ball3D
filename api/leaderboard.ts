import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from './_lib/kv'

const KEY = 'ball3d:lb:table1:v1'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit
  const limit = Math.max(1, Math.min(50, Number(limitRaw ?? 20) || 20))

  if (!kv) {
    return res.status(503).json({ error: 'Leaderboard not configured (missing UPSTASH env vars).' })
  }

  try {
    const entries = await kv.zrange<Array<{ member: string; score: number }>>(KEY, 0, limit - 1, {
      rev: true,
      withScores: true,
    })
    const items = entries.map((e) => ({
      name: String(e.member),
      score: Math.floor(Number(e.score) || 0),
    }))
    return res.status(200).json({ items })
  } catch (e) {
    console.error('leaderboard failed', e)
    return res.status(502).json({ error: 'Upstash request failed.' })
  }
}
