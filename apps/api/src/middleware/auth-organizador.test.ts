import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key')

const getUserMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  }),
}))

const { authOrganizadorMiddleware } = await import('./auth-organizador.js')

function buildApp() {
  const app = new Hono<{ Variables: { organizador_id: string } }>()
  app.get('/protegido', authOrganizadorMiddleware, (c) =>
    c.json({ organizador_id: c.get('organizador_id') }),
  )
  return app
}

beforeEach(() => {
  getUserMock.mockReset()
})

describe('authOrganizadorMiddleware', () => {
  it('rechaza sin Authorization header', async () => {
    const res = await buildApp().request('/protegido')
    expect(res.status).toBe(401)
  })

  it('rechaza un token inválido', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const res = await buildApp().request('/protegido', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)
  })

  it('setea organizador_id para un token válido', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'org-1' } }, error: null })
    const res = await buildApp().request('/protegido', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizador_id: 'org-1' })
  })
})
