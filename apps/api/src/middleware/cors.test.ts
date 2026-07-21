import { describe, it, expect, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { corsMiddleware } from './cors.js'

function buildApp() {
  const app = new Hono()
  app.use('*', corsMiddleware)
  app.get('/ping', (c) => c.json({ ok: true }))
  return app
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('corsMiddleware', () => {
  it('allows the configured API_CORS_ORIGIN and echoes it back', async () => {
    vi.stubEnv('API_CORS_ORIGIN', 'https://album.example.com')
    const app = buildApp()

    const res = await app.request('/ping', {
      headers: { Origin: 'https://album.example.com' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://album.example.com',
    )
  })

  it('does not set Access-Control-Allow-Origin for a mismatched origin', async () => {
    vi.stubEnv('API_CORS_ORIGIN', 'https://album.example.com')
    const app = buildApp()

    const res = await app.request('/ping', {
      headers: { Origin: 'https://evil.example.com' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('defaults to http://localhost:3000 when API_CORS_ORIGIN is unset', async () => {
    vi.stubEnv('API_CORS_ORIGIN', '')
    vi.unstubAllEnvs()
    delete process.env.API_CORS_ORIGIN
    const app = buildApp()

    const res = await app.request('/ping', {
      headers: { Origin: 'http://localhost:3000' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000',
    )
  })

  it('allows all origins when API_CORS_ORIGIN is "*"', async () => {
    vi.stubEnv('API_CORS_ORIGIN', '*')
    const app = buildApp()

    const res = await app.request('/ping', {
      headers: { Origin: 'https://anything.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://anything.example.com',
    )
  })

  it('sets Access-Control-Allow-Credentials to true', async () => {
    vi.stubEnv('API_CORS_ORIGIN', 'https://album.example.com')
    const app = buildApp()

    const res = await app.request('/ping', {
      headers: { Origin: 'https://album.example.com' },
    })

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('handles an OPTIONS preflight request with allowed methods and headers', async () => {
    vi.stubEnv('API_CORS_ORIGIN', 'https://album.example.com')
    const app = buildApp()

    const res = await app.request('/ping', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://album.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'Content-Type',
    )
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'Authorization',
    )
  })
})
