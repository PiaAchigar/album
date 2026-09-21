import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

export interface EncryptedField {
  cipher: string
  iv: string
  tag: string
}

function getKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set')
  }
  const buffer = Buffer.from(key, 'base64')
  if (buffer.length !== KEY_LENGTH) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }
  return buffer
}

export function encryptSecret(plaintext: string): EncryptedField {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return {
    cipher: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptSecret(input: EncryptedField): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(input.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(input.tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.cipher, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
