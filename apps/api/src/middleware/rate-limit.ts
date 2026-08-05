import type { Context, MiddlewareHandler } from 'hono'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getIP } from '../lib/ip.js'
import { normalizarTelefono } from '../lib/telefono.js'
import { logger } from '../lib/logger.js'
import type { InvitadoJWTPayload } from '../lib/jwt.js'

interface RateLimitEntry {
  count: number
  windowStart: number
}

type KeyExtractor = (c: Context) => string | Promise<string>

const RATE_LIMIT_MESSAGE = 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.'

function createInMemoryRateLimiter(
  maxRequests: number,
  windowMs: number,
  label: string,
  getKey: KeyExtractor,
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
    const key = await getKey(c)

    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now })
      return next()
    }

    if (entry.count >= maxRequests) {
      logger.warn({ key, label }, 'Rate limit excedido')
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
  getKey: KeyExtractor,
): MiddlewareHandler {
  const redis = new Redis({ url, token })
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs / 1000} s`),
    // Distinct prefix per limiter so registro/upload never share a Redis
    // bucket even if a phone number and an invitado_id happened to collide.
    prefix: `album-ratelimit-${label}`,
  })

  return async (c, next) => {
    const key = await getKey(c)

    try {
      const { success } = await limiter.limit(key)

      if (!success) {
        logger.warn({ key, label }, 'Rate limit excedido')
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
//
// `getKey` defaults to IP but can be overridden. This matters for guest
// endpoints at a live event: dozens of phones on the same venue WiFi share
// one public IP, so an IP-keyed limit would throttle the whole group instead
// of individual abuse. Keying by something per-person instead (phone number
// at registration, invitado_id once a session exists) gives each guest their
// own budget regardless of shared IP.
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  label: string,
  getKey: KeyExtractor = getIP,
): MiddlewareHandler {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    return createUpstashRateLimiter(maxRequests, windowMs, url, token, label, getKey)
  }

  return createInMemoryRateLimiter(maxRequests, windowMs, label, getKey)
}

// Keyed by the phone number being registered (normalized), not IP. Hono
// caches the parsed body (HonoRequest#bodyCache), so calling c.req.json()
// here is safe even though zValidator (which also parses the body) runs
// later in the route chain — both reuse the same cached parse. If the body
// isn't valid JSON or has no telefono, zValidator will reject the request
// right after anyway, so falling back to IP here is just a safety net.
export const registroRateLimitMiddleware = createRateLimiter(
  10,
  60_000,
  'registro',
  async (c) => {
    try {
      const body = await c.req.json()
      if (body && typeof body.telefono === 'string') {
        return normalizarTelefono(body.telefono)
      }
    } catch {
      // not valid JSON — fall through to IP
    }
    return getIP(c)
  },
)

// Keyed by invitado_id (from the guest's session token), not IP. Must run
// AFTER jwtInvitadoMiddleware in the route chain so `c.get('invitado')` is
// already populated.
export const uploadRateLimitMiddleware = createRateLimiter(
  30,
  60_000,
  'upload',
  (c) => (c.get('invitado') as InvitadoJWTPayload).invitado_id,
)
