import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const updateMock = vi.fn()

vi.mock('../db/index.js', () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  },
}))

vi.mock('dotenv/config', () => ({}))

const crearPreferenciaDonacionMock = vi.fn()
const obtenerPagoMock = vi.fn()
vi.mock('../lib/mercadopago.js', () => ({
  crearPreferenciaDonacion: (...args: unknown[]) => crearPreferenciaDonacionMock(...args),
  obtenerPago: (...args: unknown[]) => obtenerPagoMock(...args),
}))

const verificarFirmaWebhookMock = vi.fn()
vi.mock('../lib/mercadopago-signature.js', () => ({
  verificarFirmaWebhook: (...args: unknown[]) => verificarFirmaWebhookMock(...args),
}))

const { createDonacionesRoutes } = await import('./donaciones.routes.js')

function mockInsertOk() {
  const valuesMock = vi.fn(() => Promise.resolve())
  insertMock.mockImplementation(() => ({ values: valuesMock }))
  return valuesMock
}

let ipCounter = 0
function nextIp(): string {
  ipCounter += 1
  return `10.2.0.${ipCounter}`
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const router = createDonacionesRoutes()
  return router.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': nextIp(), ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  insertMock.mockReset()
  updateMock.mockReset()
  crearPreferenciaDonacionMock.mockReset()
  obtenerPagoMock.mockReset()
  verificarFirmaWebhookMock.mockReset()
})

describe('POST /donaciones', () => {
  it('crea la preferencia y devuelve init_point', async () => {
    crearPreferenciaDonacionMock.mockResolvedValue({
      preferenceId: 'pref-1',
      initPoint: 'https://mp.example.com/checkout/pref-1',
    })
    mockInsertOk()

    const res = await post('/donaciones', { monto: 25000, origen: 'landing' })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ init_point: 'https://mp.example.com/checkout/pref-1' })
  })

  it('rechaza un monto en 0', async () => {
    const res = await post('/donaciones', { monto: 0, origen: 'landing' })
    expect(res.status).toBe(400)
    expect(crearPreferenciaDonacionMock).not.toHaveBeenCalled()
  })

  it('rechaza un monto negativo', async () => {
    const res = await post('/donaciones', { monto: -100, origen: 'landing' })
    expect(res.status).toBe(400)
  })

  it('rechaza un monto no entero', async () => {
    const res = await post('/donaciones', { monto: 25000.5, origen: 'landing' })
    expect(res.status).toBe(400)
  })

  it('rechaza un origen inválido', async () => {
    const res = await post('/donaciones', { monto: 1000, origen: 'otro' })
    expect(res.status).toBe(400)
  })

  it('devuelve 502 y no inserta nada si Mercado Pago falla', async () => {
    crearPreferenciaDonacionMock.mockRejectedValue(new Error('MP caído'))

    const res = await post('/donaciones', { monto: 25000, origen: 'landing' })

    expect(res.status).toBe(502)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('acepta organizador_id opcional y lo guarda', async () => {
    crearPreferenciaDonacionMock.mockResolvedValue({
      preferenceId: 'pref-2',
      initPoint: 'https://mp.example.com/checkout/pref-2',
    })
    const valuesMock = mockInsertOk()

    const res = await post('/donaciones', {
      monto: 50000,
      origen: 'registro_organizador',
      organizador_id: '11111111-1111-1111-1111-111111111111',
    })

    expect(res.status).toBe(201)
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizador_id: '11111111-1111-1111-1111-111111111111' }),
    )
  })

  it('guarda organizador_id null cuando no se manda', async () => {
    crearPreferenciaDonacionMock.mockResolvedValue({
      preferenceId: 'pref-3',
      initPoint: 'https://mp.example.com/checkout/pref-3',
    })
    const valuesMock = mockInsertOk()

    await post('/donaciones', { monto: 25000, origen: 'landing' })

    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ organizador_id: null }))
  })
})

describe('POST /donaciones/webhook', () => {
  function webhookBody(dataId = '999') {
    return { type: 'payment', data: { id: dataId } }
  }

  function mockUpdateOk() {
    const setMock = vi.fn(() => ({ where: async () => [] }))
    updateMock.mockImplementation(() => ({ set: setMock }))
    return setMock
  }

  it('ignora notificaciones que no son de tipo payment', async () => {
    const res = await post('/donaciones/webhook', { type: 'merchant_order', data: { id: '1' } })

    expect(res.status).toBe(200)
    expect(verificarFirmaWebhookMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rechaza si la firma es inválida', async () => {
    verificarFirmaWebhookMock.mockReturnValue(false)

    const res = await post('/donaciones/webhook', webhookBody(), {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1',
    })

    expect(res.status).toBe(401)
    expect(obtenerPagoMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('marca la donación aprobada cuando Mercado Pago confirma el pago', async () => {
    verificarFirmaWebhookMock.mockReturnValue(true)
    obtenerPagoMock.mockResolvedValue({ id: '999', status: 'approved', external_reference: 'don-1' })
    const setMock = mockUpdateOk()

    const res = await post('/donaciones/webhook', webhookBody(), {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1',
    })

    expect(res.status).toBe(200)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'aprobada', mp_payment_id: '999' }),
    )
  })

  it('marca la donación rechazada cuando el pago no está aprobado', async () => {
    verificarFirmaWebhookMock.mockReturnValue(true)
    obtenerPagoMock.mockResolvedValue({ id: '999', status: 'rejected', external_reference: 'don-1' })
    mockUpdateOk()
    const realSetMock = vi.fn(() => ({ where: async () => [] }))
    updateMock.mockImplementation(() => ({ set: realSetMock }))

    await post('/donaciones/webhook', webhookBody(), {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1',
    })

    expect(realSetMock).toHaveBeenCalledWith(expect.objectContaining({ estado: 'rechazada' }))
  })

  it('no rompe si el pago no trae external_reference', async () => {
    verificarFirmaWebhookMock.mockReturnValue(true)
    obtenerPagoMock.mockResolvedValue({ id: '999', status: 'approved', external_reference: null })

    const res = await post('/donaciones/webhook', webhookBody(), {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1',
    })

    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('es idempotente ante notificaciones duplicadas', async () => {
    verificarFirmaWebhookMock.mockReturnValue(true)
    obtenerPagoMock.mockResolvedValue({ id: '999', status: 'approved', external_reference: 'don-1' })
    mockUpdateOk()

    const res1 = await post('/donaciones/webhook', webhookBody(), {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1',
    })
    const res2 = await post('/donaciones/webhook', webhookBody(), {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1',
    })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(updateMock).toHaveBeenCalledTimes(2)
  })
})