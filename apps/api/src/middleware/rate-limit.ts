import type { MiddlewareHandler } from 'hono'

interface RateLimitEntry {
  count: number
  windowStart: number
}

function createRateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
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
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'

    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(ip, { count: 1, windowStart: now })
      return next()
    }

    if (entry.count >= maxRequests) {
      return c.json(
        { error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.' },
        429,
      )
    }

    entry.count += 1
    return next()
  }
}

// 10 requests per minute for registration
export const registroRateLimitMiddleware = createRateLimiter(10, 60_000)

// 30 requests per minute for upload endpoints
export const uploadRateLimitMiddleware = createRateLimiter(30, 60_000)
