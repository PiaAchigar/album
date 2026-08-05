import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { InvitadoJWTPayload } from '../lib/jwt.js'
import {
  registroRateLimitMiddleware,
  uploadRateLimitMiddleware,
} from './rate-limit.js'

type Env = { Variables: { invitado: InvitadoJWTPayload } }

function buildRegistroApp() {
  const app = new Hono()
  app.post('/registro', registroRateLimitMiddleware, (c) => c.json({ ok: true }))
  return app
}

// Simulates jwtInvitadoMiddleware (which normally runs before
// uploadRateLimitMiddleware in the real route chain) by setting `invitado`
// on the context from a test-only header, so these tests don't need real
// JWTs to exercise the invitado_id-keyed limiter.
function buildUploadApp() {
  const app = new Hono<Env>()
  app.post(
    '/upload',
    async (c, next) => {
      const invitado_id = c.req.header('x-test-invitado-id') ?? 'unknown'
      c.set('invitado', { invitado_id, evento_id: 'evento-1' } as InvitadoJWTPayload)
      return next()
    },
    uploadRateLimitMiddleware,
    (c) => c.json({ ok: true }),
  )
  return app
}

async function registro(
  app: Hono,
  telefono: string | undefined,
  ip = '1.1.1.1',
): Promise<Response> {
  return app.request('/registro', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'Content-Type': 'application/json' },
    body: telefono === undefined ? undefined : JSON.stringify({ telefono }),
  })
}

async function upload(app: Hono<Env>, invitadoId: string, ip = '1.1.1.1'): Promise<Response> {
  return app.request('/upload', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'x-test-invitado-id': invitadoId },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('registroRateLimitMiddleware (10 req/min per teléfono)', () => {
  it('allows up to 10 requests for the same teléfono within the window', async () => {
    const app = buildRegistroApp()

    for (let i = 0; i < 10; i++) {
      const res = await registro(app, '099123456')
      expect(res.status).toBe(200)
    }
  })

  it('rejects the 11th request for the same teléfono within the window with 429', async () => {
    const app = buildRegistroApp()

    for (let i = 0; i < 10; i++) {
      await registro(app, '099234567')
    }
    const res = await registro(app, '099234567')
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body).toEqual({
      error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
    })
  })

  it('tracks separate teléfonos independently even from the same IP', async () => {
    // The whole point of keying by teléfono instead of IP: dozens of guests
    // on the same venue WiFi share one public IP, so they must not share one
    // rate-limit budget.
    const app = buildRegistroApp()
    const sharedIp = '10.0.0.1'

    for (let i = 0; i < 10; i++) {
      await registro(app, '099345678', sharedIp)
    }
    // A different phone, same IP, should not be affected by 099345678's usage
    const res = await registro(app, '099999999', sharedIp)

    expect(res.status).toBe(200)
  })

  it('resets the count after the window elapses', async () => {
    const app = buildRegistroApp()

    for (let i = 0; i < 10; i++) {
      await registro(app, '099456789')
    }
    let res = await registro(app, '099456789')
    expect(res.status).toBe(429)

    // Advance past the 60s window
    vi.advanceTimersByTime(60_001)

    res = await registro(app, '099456789')
    expect(res.status).toBe(200)
  })

  it('normalizes teléfono formatting before keying (spaces/dashes vs digits-only match)', async () => {
    const app = buildRegistroApp()

    for (let i = 0; i < 10; i++) {
      await registro(app, '099 567-890')
    }
    const res = await registro(app, '0995 67890')

    expect(res.status).toBe(429)
  })

  it('falls back to IP-based limiting when the request has no valid teléfono', async () => {
    const app = buildRegistroApp()
    const ip = '20.20.20.20'

    for (let i = 0; i < 10; i++) {
      await registro(app, undefined, ip)
    }
    const res = await registro(app, undefined, ip)

    expect(res.status).toBe(429)
  })
})

describe('uploadRateLimitMiddleware (30 req/min per invitado_id)', () => {
  it('allows up to 30 requests for the same invitado_id within the window', async () => {
    const app = buildUploadApp()

    for (let i = 0; i < 30; i++) {
      const res = await upload(app, 'invitado-a')
      expect(res.status).toBe(200)
    }
  })

  it('rejects the 31st request for the same invitado_id within the window with 429', async () => {
    const app = buildUploadApp()

    for (let i = 0; i < 30; i++) {
      await upload(app, 'invitado-b')
    }
    const res = await upload(app, 'invitado-b')

    expect(res.status).toBe(429)
  })

  it('tracks separate invitado_id independently even from the same IP', async () => {
    const app = buildUploadApp()
    const sharedIp = '10.0.0.1'

    for (let i = 0; i < 30; i++) {
      await upload(app, 'invitado-c', sharedIp)
    }
    // A different guest, same venue WiFi/IP, should not be affected
    const res = await upload(app, 'invitado-d', sharedIp)

    expect(res.status).toBe(200)
  })
})

describe('Upstash-backed rate limiting (when UPSTASH_REDIS_REST_URL/TOKEN are set)', () => {
  // NOTE: these tests mock '@upstash/ratelimit' and '@upstash/redis' — there
  // is no real Upstash account/dashboard involved, and none is available in
  // this environment. They verify the code *calls the SDK correctly*, not
  // that a live Upstash deployment behaves as expected.
  const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL
  const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

  beforeEach(() => {
    // Real timers here: these tests reach for the network-shaped mocked SDK,
    // not the in-memory setInterval-based path.
    vi.useRealTimers()
  })

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL

    if (ORIGINAL_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN

    vi.doUnmock('@upstash/ratelimit')
    vi.doUnmock('@upstash/redis')
    vi.resetModules()
  })

  it('calls Ratelimit.limit() with the normalized teléfono instead of IP, for registro', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

    const limitMock = vi.fn().mockResolvedValue({ success: true })
    const slidingWindowMock = vi.fn().mockReturnValue('sliding-window-config')
    const RatelimitMock = vi.fn().mockImplementation(() => ({ limit: limitMock })) as any
    RatelimitMock.slidingWindow = slidingWindowMock
    const RedisMock = vi.fn().mockImplementation((config: unknown) => ({ config }))

    vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: RatelimitMock }))
    vi.doMock('@upstash/redis', () => ({ Redis: RedisMock }))
    vi.resetModules()

    const { registroRateLimitMiddleware } = await import('./rate-limit.js')
    const app = new Hono()
    app.post('/registro', registroRateLimitMiddleware, (c) => c.json({ ok: true }))

    const res = await app.request('/registro', {
      method: 'POST',
      headers: { 'x-forwarded-for': '9.9.9.9', 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: '099 111-222' }),
    })

    expect(res.status).toBe(200)
    expect(RedisMock).toHaveBeenCalledWith({
      url: 'https://fake-upstash.example.com',
      token: 'fake-token',
    })
    expect(slidingWindowMock).toHaveBeenCalledWith(10, '60 s')
    expect(limitMock).toHaveBeenCalledWith('099111222')
  })

  it('falls back to IP precedence (cf-connecting-ip > x-forwarded-for > x-real-ip) when there is no teléfono', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

    const limitMock = vi.fn().mockResolvedValue({ success: true })
    const RatelimitMock = vi.fn().mockImplementation(() => ({ limit: limitMock })) as any
    RatelimitMock.slidingWindow = vi.fn().mockReturnValue('sliding-window-config')
    const RedisMock = vi.fn().mockImplementation(() => ({}))

    vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: RatelimitMock }))
    vi.doMock('@upstash/redis', () => ({ Redis: RedisMock }))
    vi.resetModules()

    const { registroRateLimitMiddleware } = await import('./rate-limit.js')
    const app = new Hono()
    app.post('/registro', registroRateLimitMiddleware, (c) => c.json({ ok: true }))

    await app.request('/registro', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '11.11.11.11',
        'x-forwarded-for': '22.22.22.22',
        'x-real-ip': '33.33.33.33',
      },
    })

    expect(limitMock).toHaveBeenCalledWith('11.11.11.11')
  })

  it('returns the same 429 response shape as the in-memory path when the Upstash limiter reports failure, for upload', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

    const limitMock = vi.fn().mockResolvedValue({ success: false })
    const RatelimitMock = vi.fn().mockImplementation(() => ({ limit: limitMock })) as any
    RatelimitMock.slidingWindow = vi.fn().mockReturnValue('sliding-window-config')
    const RedisMock = vi.fn().mockImplementation(() => ({}))

    vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: RatelimitMock }))
    vi.doMock('@upstash/redis', () => ({ Redis: RedisMock }))
    vi.resetModules()

    const { uploadRateLimitMiddleware } = await import('./rate-limit.js')
    const app = new Hono<Env>()
    app.post(
      '/upload',
      async (c, next) => {
        c.set('invitado', { invitado_id: 'invitado-e', evento_id: 'evento-1' } as InvitadoJWTPayload)
        return next()
      },
      uploadRateLimitMiddleware,
      (c) => c.json({ ok: true }),
    )

    const res = await app.request('/upload', { method: 'POST' })
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body).toEqual({
      error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
    })
    expect(limitMock).toHaveBeenCalledWith('invitado-e')
  })

  it('fails open (calls next(), no 429) when the Upstash limiter throws for the registro middleware', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

    const limitMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const RatelimitMock = vi.fn().mockImplementation(() => ({ limit: limitMock })) as any
    RatelimitMock.slidingWindow = vi.fn().mockReturnValue('sliding-window-config')
    const RedisMock = vi.fn().mockImplementation(() => ({}))

    vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: RatelimitMock }))
    vi.doMock('@upstash/redis', () => ({ Redis: RedisMock }))
    vi.resetModules()

    const { registroRateLimitMiddleware } = await import('./rate-limit.js')
    const app = new Hono()
    app.post('/registro', registroRateLimitMiddleware, (c) => c.json({ ok: true }))

    const res = await app.request('/registro', {
      method: 'POST',
      headers: { 'x-forwarded-for': '44.44.44.44', 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: '044444444' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(limitMock).toHaveBeenCalledWith('044444444')
  })

  it('fails open (calls next(), no 429) when the Upstash limiter throws for the upload middleware', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'

    const limitMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const RatelimitMock = vi.fn().mockImplementation(() => ({ limit: limitMock })) as any
    RatelimitMock.slidingWindow = vi.fn().mockReturnValue('sliding-window-config')
    const RedisMock = vi.fn().mockImplementation(() => ({}))

    vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: RatelimitMock }))
    vi.doMock('@upstash/redis', () => ({ Redis: RedisMock }))
    vi.resetModules()

    const { uploadRateLimitMiddleware } = await import('./rate-limit.js')
    const app = new Hono<Env>()
    app.post(
      '/upload',
      async (c, next) => {
        c.set('invitado', { invitado_id: 'invitado-f', evento_id: 'evento-1' } as InvitadoJWTPayload)
        return next()
      },
      uploadRateLimitMiddleware,
      (c) => c.json({ ok: true }),
    )

    const res = await app.request('/upload', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(limitMock).toHaveBeenCalledWith('invitado-f')
  })
})
