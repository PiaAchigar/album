import { describe, it, expect, vi, afterEach } from 'vitest'
import { signInvitadoToken, verifyInvitadoToken } from './jwt.js'

// Provide a valid secret for all tests
vi.stubEnv('INVITADO_JWT_SECRET', 'super-secret-key-for-testing-1234567890ab')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('signInvitadoToken + verifyInvitadoToken', () => {
  it('signs a token and verifies it successfully', async () => {
    const payload = { invitado_id: 'inv-123', evento_id: 'evt-456' }
    const token = await signInvitadoToken(payload)

    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3) // valid JWT structure

    const verified = await verifyInvitadoToken(token)
    expect(verified.invitado_id).toBe('inv-123')
    expect(verified.evento_id).toBe('evt-456')
  })

  it('throws on a tampered token', async () => {
    const token = await signInvitadoToken({ invitado_id: 'a', evento_id: 'b' })
    const [header, payload, sig] = token.split('.')
    const tampered = `${header}.${payload}.${sig}XX`

    await expect(verifyInvitadoToken(tampered)).rejects.toThrow()
  })

  it('throws on an expired token', async () => {
    // Freeze time in the past so the token is already expired
    const pastDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    vi.setSystemTime(pastDate)

    const token = await signInvitadoToken({ invitado_id: 'a', evento_id: 'b' })

    // Restore to present so expiry check catches the expired token
    vi.useRealTimers()

    await expect(verifyInvitadoToken(token)).rejects.toThrow()
  })
})
