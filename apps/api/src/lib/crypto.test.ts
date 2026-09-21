import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
})

const { encryptSecret, decryptSecret } = await import('./crypto.js')

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext value', () => {
    const encrypted = encryptSecret('my-secret-value')
    expect(decryptSecret(encrypted)).toBe('my-secret-value')
  })

  it('produces different ciphertext and iv for the same plaintext on each call', () => {
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    expect(a.cipher).not.toBe(b.cipher)
    expect(a.iv).not.toBe(b.iv)
  })

  it('throws when the auth tag does not match the ciphertext', () => {
    const encrypted = encryptSecret('tampered')
    const other = encryptSecret('other')
    expect(() => decryptSecret({ ...encrypted, tag: other.tag })).toThrow()
  })

  it('throws when CREDENTIALS_ENCRYPTION_KEY is not set', () => {
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', '')
    expect(() => encryptSecret('x')).toThrow('CREDENTIALS_ENCRYPTION_KEY')
  })
})
