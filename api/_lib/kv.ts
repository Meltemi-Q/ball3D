import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const url = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim()
const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim()

export const kv =
  url && token
    ? new Redis({
        url,
        token,
      })
    : null

export const ratelimit = (() => {
  if (kv === null) return null
  try {
    return new Ratelimit({
      redis: kv,
      limiter: Ratelimit.fixedWindow(12, '10s'),
      analytics: true,
    })
  } catch (e) {
    console.error('ratelimit init failed', e)
    return null
  }
})()
