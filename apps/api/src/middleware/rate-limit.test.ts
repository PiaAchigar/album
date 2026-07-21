import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import {
  registroRateLimitMiddleware,
  uploadRateLimitMiddleware,
} from './rate-limit.js'

function buildApp() {
  const app = new Hono()
  app.post('/registro', registroRateLimitMiddleware, (c) =>
    c.json({ ok: true }),
  )
  app.post('/upload', uploadRateLimitMiddleware, (c) => c.json({ ok: true }))
  return app
}

async function requestFrom(
  app: Hono,
  path: string,
  ip: string,
): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('registroRateLimitMiddleware (10 req/min per IP)', () => {
  it('allows up to 10 requests from the same IP within the window', async () => {
    const app = buildApp()
    const ip = '1.1.1.1'

    for (let i = 0; i < 10; i++) {
      const res = await requestFrom(app, '/registro', ip)
      expect(res.status).toBe(200)
    }
  })

  it('rejects the 11th request from the same IP within the window with 429', async () => {
    const app = buildApp()
    const ip = '2.2.2.2'

    for (let i = 0; i < 10; i++) {
      await requestFrom(app, '/registro', ip)
    }
    const res = await requestFrom(app, '/registro', ip)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body).toEqual({
      error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
    })
  })

  it('tracks separate IPs independently', async () => {
    const app = buildApp()

    for (let i = 0; i < 10; i++) {
      await requestFrom(app, '/registro', '3.3.3.3')
    }
    // A different IP should not be affected by 3.3.3.3's usage
    const res = await requestFrom(app, '/registro', '4.4.4.4')

    expect(res.status).toBe(200)
  })

  it('resets the count after the window elapses', async () => {
    const app = buildApp()
    const ip = '5.5.5.5'

    for (let i = 0; i < 10; i++) {
      await requestFrom(app, '/registro', ip)
    }
    let res = await requestFrom(app, '/registro', ip)
    expect(res.status).toBe(429)

    // Advance past the 60s window
    vi.advanceTimersByTime(60_001)

    res = await requestFrom(app, '/registro', ip)
    expect(res.status).toBe(200)
  })
})

describe('uploadRateLimitMiddleware (30 req/min per IP)', () => {
  it('allows up to 30 requests from the same IP within the window', async () => {
    const app = buildApp()
    const ip = '6.6.6.6'

    for (let i = 0; i < 30; i++) {
      const res = await requestFrom(app, '/upload', ip)
      expect(res.status).toBe(200)
    }
  })

  it('rejects the 31st request from the same IP within the window with 429', async () => {
    const app = buildApp()
    const ip = '7.7.7.7'

    for (let i = 0; i < 30; i++) {
      await requestFrom(app, '/upload', ip)
    }
    const res = await requestFrom(app, '/upload', ip)

    expect(res.status).toBe(429)
  })
})
