import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module before importing the app
vi.mock('../db/index.js', () => ({
  db: {
    execute: vi.fn(),
  },
}))

// Mock dotenv/config to avoid needing a real .env file
vi.mock('dotenv/config', () => ({}))

// Mock @hono/node-server so the server doesn't actually listen
vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

const { db } = await import('../db/index.js')
const { default: app } = await import('../index.js')

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 { status: "ok", db: "ok" } when DB is reachable', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)

    const res = await app.request('/health')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok', db: 'ok' })
  })

  it('returns 503 { status: "degraded", db: "error" } when DB throws', async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection refused'))

    const res = await app.request('/health')
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'degraded', db: 'error' })
  })

  it('returns 503 when DB query times out', async () => {
    vi.mocked(db.execute).mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('DB timeout')), 5000)) as never,
    )

    const res = await app.request('/health')
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'degraded', db: 'error' })
  }, 10000)
})
