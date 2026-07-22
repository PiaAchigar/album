import type { MiddlewareHandler } from 'hono'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getIP } from '../lib/ip.js'
import { logger } from '../lib/logger.js'

interface RateLimitEntry {
  count: number
  windowStart: number
}

const RATE_LIMIT_MESSAGE = 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.'

function createInMemoryRateLimiter(
  maxRequests: number,
  windowMs: number,
  label: string,
): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>()

  // Prune old entries every 5 minutes to avoid memory leak
  const pruneInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > windowMs) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)
  // Don't keep the Node process alive solely for this cleanup timer
  pruneInterval.unref?.()

  return async (c, next) => {
    const ip = getIP(c)

    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(ip, { count: 1, windowStart: now })
      return next()
    }

    if (entry.count >= maxRequests) {
      logger.warn({ ip, label }, 'Rate limit excedido')
      return c.json({ error: RATE_LIMIT_MESSAGE }, 429)
    }

    entry.count += 1
    return next()
  }
}

function createUpstashRateLimiter(
  maxRequests: number,
  windowMs: number,
  url: string,
  token: string,
  label: string,
): MiddlewareHandler {
  const redis = new Redis({ url, token })
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs / 1000} s`),
  })

  return async (c, next) => {
    const ip = getIP(c)

    try {
      const { success } = await limiter.limit(ip)

      if (!success) {
        logger.warn({ ip, label }, 'Rate limit excedido')
        return c.json({ error: RATE_LIMIT_MESSAGE }, 429)
      }
    } catch (error) {
      // Fail open: an Upstash outage/misconfiguration should not take down
      // guest registration/upload during a live event. Log it so the
      // failure is visible in server logs, then let the request through.
      console.error(
        `[rate-limit] Upstash limiter "${label}" failed, failing open`,
        error,
      )
    }

    return next()
  }
}

// Persistent (Upstash Redis) when UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN are configured — survives restarts and is shared
// across API instances. Falls back to the in-memory limiter (single
// instance, resets on restart) otherwise, e.g. local dev.
function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  label: string,
): MiddlewareHandler {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    return createUpstashRateLimiter(maxRequests, windowMs, url, token, label)
  }

  return createInMemoryRateLimiter(maxRequests, windowMs, label)
}

// 10 requests per minute for registration
export const registroRateLimitMiddleware = createRateLimiter(10, 60_000, 'registro')

// 30 requests per minute for upload endpoints
export const uploadRateLimitMiddleware = createRateLimiter(30, 60_000, 'upload')
