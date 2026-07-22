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

  it('calls Ratelimit.limit() instead of the in-memory path when env vars are configured', async () => {
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
      headers: { 'x-forwarded-for': '9.9.9.9' },
    })

    expect(res.status).toBe(200)
    expect(RedisMock).toHaveBeenCalledWith({
      url: 'https://fake-upstash.example.com',
      token: 'fake-token',
    })
    expect(slidingWindowMock).toHaveBeenCalledWith(10, '60 s')
    expect(limitMock).toHaveBeenCalledWith('9.9.9.9')
  })

  it('returns the same 429 response shape as the in-memory path when the Upstash limiter reports failure', async () => {
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
    const app = new Hono()
    app.post('/upload', uploadRateLimitMiddleware, (c) => c.json({ ok: true }))

    const res = await app.request('/upload', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.10.10.10' },
    })
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body).toEqual({
      error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
    })
    expect(limitMock).toHaveBeenCalledWith('10.10.10.10')
  })

  it('respects the cf-connecting-ip > x-forwarded-for > x-real-ip precedence in the Upstash path too', async () => {
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
      headers: { 'x-forwarded-for': '44.44.44.44' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(limitMock).toHaveBeenCalledWith('44.44.44.44')
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
    const app = new Hono()
    app.post('/upload', uploadRateLimitMiddleware, (c) => c.json({ ok: true }))

    const res = await app.request('/upload', {
      method: 'POST',
      headers: { 'x-forwarded-for': '55.55.55.55' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(limitMock).toHaveBeenCalledWith('55.55.55.55')
  })
})
