import { createHmac, timingSafeEqual } from 'node:crypto'

export interface WebhookHeaders {
  xSignature: string | undefined
  xRequestId: string | undefined
}

// Mercado Pago manda x-signature como "ts=<timestamp>,v1=<hmac-hex>" y pide
// recalcular un HMAC-SHA256 sobre un "manifest" con formato fijo. Ver:
// https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
export function verificarFirmaWebhook(headers: WebhookHeaders, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('MP_WEBHOOK_SECRET is not set')
  }

  if (!headers.xSignature || !headers.xRequestId) {
    return false
  }

  const parts = new Map<string, string>()
  for (const part of headers.xSignature.split(',')) {
    const [key, value] = part.split('=')
    if (key && value) {
      parts.set(key.trim(), value.trim())
    }
  }

  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  if (!ts || !v1) {
    return false
  }

  // MP documenta que si el data.id trae letras, deben ir en minúsculas en
  // el manifest.
  const manifest = `id:${dataId.toLowerCase()};request-id:${headers.xRequestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(v1, 'hex')
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}