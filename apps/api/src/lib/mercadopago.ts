import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN is not set')
  }
  return new MercadoPagoConfig({ accessToken })
}

function getAppUrl(): string {
  return process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function getApiUrl(): string {
  return process.env.API_PUBLIC_URL ?? 'http://localhost:3001'
}

export interface CrearPreferenciaInput {
  monto: number
  donacionId: string
}

export interface CrearPreferenciaResult {
  preferenceId: string
  initPoint: string
}

export async function crearPreferenciaDonacion(
  input: CrearPreferenciaInput,
): Promise<CrearPreferenciaResult> {
  const client = getClient()
  const preference = new Preference(client)
  const appUrl = getAppUrl()

  const result = await preference.create({
    body: {
      items: [
        {
          id: input.donacionId,
          title: 'Donación a Album',
          quantity: 1,
          unit_price: input.monto,
          currency_id: 'ARS',
        },
      ],
      back_urls: {
        success: `${appUrl}/?donacion=aprobada`,
        pending: `${appUrl}/?donacion=pendiente`,
        failure: `${appUrl}/?donacion=rechazada`,
      },
      auto_return: 'approved',
      notification_url: `${getApiUrl()}/donaciones/webhook`,
      external_reference: input.donacionId,
    },
  })

  if (!result.id || !result.init_point) {
    throw new Error('Mercado Pago no devolvió init_point')
  }

  return { preferenceId: result.id, initPoint: result.init_point }
}

export interface PagoMP {
  id: string
  status: string
  external_reference: string | null
}

export async function obtenerPago(paymentId: string): Promise<PagoMP> {
  const client = getClient()
  const payment = new Payment(client)
  const result = await payment.get({ id: paymentId })

  return {
    id: String(result.id),
    status: result.status ?? 'unknown',
    external_reference: result.external_reference ?? null,
  }
}