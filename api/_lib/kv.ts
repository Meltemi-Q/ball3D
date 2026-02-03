import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

export const kv =
  url && token
    ? new Redis({
        url,
        token,
      })
    : null

export const ratelimit =
  kv !== null
    ? new Ratelimit({
        redis: kv,
        limiter: Ratelimit.fixedWindow(12, '10 s'),
        analytics: true,
      })
    : null

