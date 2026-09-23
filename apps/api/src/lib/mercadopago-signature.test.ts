import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

vi.mock('dotenv/config', () => ({}))

const { verificarFirmaWebhook } = await import('./mercadopago-signature.js')

const SECRET = 'test-webhook-secret'

beforeEach(() => {
  vi.stubEnv('MP_WEBHOOK_SECRET', SECRET)
})

function firmar(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  return createHmac('sha256', SECRET).update(manifest).digest('hex')
}

describe('verificarFirmaWebhook', () => {
  it('acepta una firma válida', () => {
    const ts = '1700000000000'
    const v1 = firmar('123', 'req-1', ts)

    const resultado = verificarFirmaWebhook(
      { xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1' },
      '123',
    )

    expect(resultado).toBe(true)
  })

  it('rechaza una firma alterada', () => {
    const ts = '1700000000000'
    const v1 = firmar('123', 'req-1', ts)
    const v1Alterada = v1.slice(0, -2) + (v1.endsWith('00') ? 'ff' : '00')

    const resultado = verificarFirmaWebhook(
      { xSignature: `ts=${ts},v1=${v1Alterada}`, xRequestId: 'req-1' },
      '123',
    )

    expect(resultado).toBe(false)
  })

  it('rechaza si falta el header x-signature', () => {
    const resultado = verificarFirmaWebhook({ xSignature: undefined, xRequestId: 'req-1' }, '123')
    expect(resultado).toBe(false)
  })

  it('rechaza si falta el header x-request-id', () => {
    const ts = '1700000000000'
    const v1 = firmar('123', 'req-1', ts)

    const resultado = verificarFirmaWebhook(
      { xSignature: `ts=${ts},v1=${v1}`, xRequestId: undefined },
      '123',
    )

    expect(resultado).toBe(false)
  })

  it('rechaza si el dataId no coincide con el firmado', () => {
    const ts = '1700000000000'
    const v1 = firmar('123', 'req-1', ts)

    const resultado = verificarFirmaWebhook(
      { xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1' },
      '999',
    )

    expect(resultado).toBe(false)
  })

  it('tira un error si falta MP_WEBHOOK_SECRET', () => {
    vi.stubEnv('MP_WEBHOOK_SECRET', '')

    expect(() =>
      verificarFirmaWebhook({ xSignature: 'ts=1,v1=abc', xRequestId: 'req-1' }, '123'),
    ).toThrow('MP_WEBHOOK_SECRET is not set')
  })
})