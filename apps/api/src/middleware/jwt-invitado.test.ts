import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { jwtInvitadoMiddleware } from './jwt-invitado.js'
import { signInvitadoToken } from '../lib/jwt.js'

vi.stubEnv('INVITADO_JWT_SECRET', 'super-secret-key-for-testing-1234567890ab')

afterEach(() => {
  vi.restoreAllMocks()
})

function buildApp() {
  const app = new Hono()
  app.get('/protegido', jwtInvitadoMiddleware, (c) => {
    const invitado = c.var.invitado
    return c.json({ invitado })
  })
  return app
}

describe('jwtInvitadoMiddleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp()

    const res = await app.request('/protegido')
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Token de sesión requerido' })
  })

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const app = buildApp()

    const res = await app.request('/protegido', {
      headers: { Authorization: 'Basic abc123' },
    })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Token de sesión requerido' })
  })

  it('returns 401 when the token is invalid', async () => {
    const app = buildApp()

    const res = await app.request('/protegido', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Token de sesión inválido o expirado' })
  })

  it('returns 401 when the token is expired', async () => {
    const app = buildApp()

    const pastDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    vi.setSystemTime(pastDate)
    const token = await signInvitadoToken({
      invitado_id: 'inv-1',
      evento_id: 'evt-1',
    })
    vi.useRealTimers()

    const res = await app.request('/protegido', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(401)
  })

  it('injects c.var.invitado and calls next on a valid token', async () => {
    const app = buildApp()
    const token = await signInvitadoToken({
      invitado_id: 'inv-123',
      evento_id: 'evt-456',
    })

    const res = await app.request('/protegido', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      invitado: { invitado_id: 'inv-123', evento_id: 'evt-456' },
    })
  })
})
