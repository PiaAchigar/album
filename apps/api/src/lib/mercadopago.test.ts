import { describe, it, expect, vi, beforeEach } from 'vitest'

const createMock = vi.fn()
const getMock = vi.fn()

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn().mockImplementation((config: unknown) => config),
  Preference: vi.fn().mockImplementation(() => ({ create: createMock })),
  Payment: vi.fn().mockImplementation(() => ({ get: getMock })),
}))

vi.mock('dotenv/config', () => ({}))

const { crearPreferenciaDonacion, obtenerPago } = await import('./mercadopago.js')

beforeEach(() => {
  createMock.mockReset()
  getMock.mockReset()
  vi.stubEnv('MP_ACCESS_TOKEN', 'test-access-token')
  vi.stubEnv('PUBLIC_APP_URL', 'https://album.example.com')
})

describe('crearPreferenciaDonacion', () => {
  it('crea la preferencia y devuelve init_point', async () => {
    createMock.mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://mp.example.com/checkout/pref-1',
    })

    const result = await crearPreferenciaDonacion({ monto: 25000, donacionId: 'don-1' })

    expect(result).toEqual({
      preferenceId: 'pref-1',
      initPoint: 'https://mp.example.com/checkout/pref-1',
    })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          items: [expect.objectContaining({ unit_price: 25000, currency_id: 'ARS' })],
          external_reference: 'don-1',
          notification_url: expect.stringContaining('/donaciones/webhook'),
        }),
      }),
    )
  })

  it('tira un error si Mercado Pago no devuelve init_point', async () => {
    createMock.mockResolvedValue({ id: 'pref-1' })

    await expect(
      crearPreferenciaDonacion({ monto: 25000, donacionId: 'don-1' }),
    ).rejects.toThrow('Mercado Pago no devolvió init_point')
  })

  it('tira un error si falta MP_ACCESS_TOKEN', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', '')

    await expect(
      crearPreferenciaDonacion({ monto: 25000, donacionId: 'don-1' }),
    ).rejects.toThrow('MP_ACCESS_TOKEN is not set')
  })
})

describe('obtenerPago', () => {
  it('devuelve el estado del pago', async () => {
    getMock.mockResolvedValue({ id: 999, status: 'approved', external_reference: 'don-1' })

    const result = await obtenerPago('999')

    expect(result).toEqual({ id: '999', status: 'approved', external_reference: 'don-1' })
    expect(getMock).toHaveBeenCalledWith({ id: '999' })
  })

  it('devuelve external_reference null si Mercado Pago no lo manda', async () => {
    getMock.mockResolvedValue({ id: 999, status: 'approved' })

    const result = await obtenerPago('999')

    expect(result.external_reference).toBeNull()
  })
})