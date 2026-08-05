import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.stubEnv('INVITADO_JWT_SECRET', 'super-secret-key-for-testing-1234567890ab')

// --- db mock ---
// select() is called twice per successful request (evento lookup, then
// invitado count) with different shapes, so we queue responses in call
// order rather than trying to discriminate by arguments.
const selectQueue: unknown[][] = []
const selectMock = vi.fn()
const insertMock = vi.fn()
const updateMock = vi.fn()

vi.mock('../db/index.js', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  },
}))

vi.mock('dotenv/config', () => ({}))

const { createEventosRoutes } = await import('./eventos.routes.js')

const mockEvento = {
  id: 'evt-1',
  slug: 'boda-test-abc123',
  estado: 'activo',
  nombre_evento: 'Boda Test',
  limite_invitados_login: 2,
  limite_fotos_por_invitado: 10,
  limite_videos_por_invitado: 2,
  organizador_id: 'org-1',
  fecha: '2026-12-01',
  horario: '20:00',
  foto_portada_url: null,
  cantidad_invitados_totales: 100,
  created_at: new Date(),
}

function queueSelects(...results: unknown[][]) {
  selectQueue.length = 0
  selectQueue.push(...results)
  selectMock.mockImplementation(() => ({
    from: () => ({
      where: async () => selectQueue.shift() ?? [],
    }),
  }))
}

function mockInsertReturning(id: string) {
  insertMock.mockImplementation(() => ({
    values: () => ({
      returning: async () => [{ id }],
    }),
  }))
}

function mockUpdateOk() {
  updateMock.mockImplementation(() => ({
    set: () => ({
      where: async () => [],
    }),
  }))
}

// registroRateLimitMiddleware is a real, unmocked module-level singleton
// with its own internal Map, now keyed by the (normalized) telefono in the
// request body rather than IP — it is never reset between tests. Every test
// below gets a distinct telefono by default so its requests land in their
// own bucket and can never collide with another test's count, regardless of
// test order, additions, removals, or concurrent execution. Tests that
// specifically need a *shared* telefono (duplicate detection, reingreso
// matching, the rate-limit tests themselves) grab one explicit unique base
// via nextTestTelefono() and reuse it deliberately within that one test.
let ipCounter = 0
function nextTestIp() {
  ipCounter += 1
  return `10.0.0.${ipCounter}`
}

let telefonoCounter = 0
function nextTestTelefono() {
  telefonoCounter += 1
  return `099${String(telefonoCounter).padStart(6, '0')}`
}

function dashed(telefono: string) {
  return `${telefono.slice(0, 3)}-${telefono.slice(3, 6)}-${telefono.slice(6)}`
}

function spaced(telefono: string) {
  return `${telefono.slice(0, 3)} ${telefono.slice(3, 6)} ${telefono.slice(6)}`
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    nombre: 'Ana',
    apellido: 'García',
    telefono: nextTestTelefono(),
    acepto_terminos: true,
    ...overrides,
  }
}

function postInvitado(slug: string, body: unknown, ip = nextTestIp()) {
  const router = createEventosRoutes()
  return router.request(`/eventos/${slug}/invitados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /eventos/:slug/invitados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertReturning('inv-new')
    mockUpdateOk()
  })

  afterEach(() => {
    selectQueue.length = 0
  })

  it('returns 201 with token and invitado_id on successful registration', async () => {
    queueSelects([mockEvento], [{ value: 0 }])

    const res = await postInvitado('boda-test-abc123', validBody())
    const body = (await res.json()) as { token: string; invitado_id: string }

    expect(res.status).toBe(201)
    expect(body).toHaveProperty('invitado_id', 'inv-new')
    expect(typeof body.token).toBe('string')
    expect(body.token.split('.')).toHaveLength(3)
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('returns 404 when evento does not exist for the slug', async () => {
    queueSelects([]) // no evento found

    const res = await postInvitado('no-existe', validBody())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Evento no encontrado' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 404 when evento exists but is not active (borrador)', async () => {
    queueSelects([{ ...mockEvento, estado: 'borrador' }])

    const res = await postInvitado('boda-test-abc123', validBody())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Este evento no está activo' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 409 and never inserts when limite_invitados_login is already reached', async () => {
    // limite is 2, current count is already 2 -> cupo lleno
    queueSelects([mockEvento], [{ value: 2 }])

    const res = await postInvitado('boda-test-abc123', validBody())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body).toEqual({
      error: 'Cupo de invitados alcanzado, hablá con el organizador',
    })
    // Central correctness requirement: count-check happens BEFORE any write.
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('allows registration when count is exactly one below the limit', async () => {
    queueSelects([mockEvento], [{ value: 1 }]) // limite 2, count 1 -> ok

    const res = await postInvitado('boda-test-abc123', validBody())

    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when acepto_terminos is false', async () => {
    const res = await postInvitado(
      'boda-test-abc123',
      validBody({ acepto_terminos: false }),
    )

    expect(res.status).toBe(400)
    expect(selectMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 400 when nombre is missing', async () => {
    const res = await postInvitado(
      'boda-test-abc123',
      { apellido: 'García', acepto_terminos: true },
    )

    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 400 when apellido is missing', async () => {
    const res = await postInvitado(
      'boda-test-abc123',
      { nombre: 'Ana', acepto_terminos: true },
    )

    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 400 when telefono is missing', async () => {
    const res = await postInvitado(
      'boda-test-abc123',
      { nombre: 'Ana', apellido: 'García', acepto_terminos: true },
    )

    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('stores telefono when provided', async () => {
    queueSelects([mockEvento], [{ value: 0 }])
    let capturedValues: Record<string, unknown> | undefined
    insertMock.mockImplementation(() => ({
      values: (v: Record<string, unknown>) => {
        capturedValues = v
        return { returning: async () => [{ id: 'inv-new' }] }
      },
    }))

    const res = await postInvitado(
      'boda-test-abc123',
      validBody({ telefono: '+54 9 11 1234-5678' }),
    )

    expect(res.status).toBe(201)
    expect(capturedValues?.telefono).toBe('+54 9 11 1234-5678')
  })

  it('is rate limited via registroRateLimitMiddleware after repeated requests with the same telefono', async () => {
    queueSelects(...Array.from({ length: 11 }, () => [[mockEvento], [{ value: 0 }], []]).flat())
    mockInsertReturning('inv-new')

    const telefono = nextTestTelefono()
    const router = createEventosRoutes()
    let lastStatus = 0
    for (let i = 0; i < 11; i++) {
      const res = await router.request('/eventos/boda-test-abc123/invitados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '9.9.9.9',
        },
        body: JSON.stringify(validBody({ telefono })),
      })
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })

  it('returns 409 when telefono already exists in the same evento (normalized match)', async () => {
    const telefono = nextTestTelefono()
    // select order: evento, cupo count, invitados-por-telefono lookup
    queueSelects(
      [mockEvento],
      [{ value: 0 }],
      [{ id: 'inv-existente', telefono: dashed(telefono) }],
    )

    const res = await postInvitado(
      'boda-test-abc123',
      validBody({ telefono: spaced(telefono) }),
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body).toEqual({
      error:
        "Ese teléfono ya está registrado en este evento. Si ya te registraste, usá 'Entrá con tu teléfono' abajo.",
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('allows the same telefono to register in a different evento', async () => {
    queueSelects([mockEvento], [{ value: 0 }], [])

    const res = await postInvitado('boda-test-abc123', validBody())

    expect(res.status).toBe(201)
  })
})

function postReingreso(slug: string, body: unknown, ip = nextTestIp()) {
  const router = createEventosRoutes()
  return router.request(`/eventos/${slug}/invitados/reingresar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /eventos/:slug/invitados/reingresar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    selectQueue.length = 0
  })

  it('returns 200 with a fresh token when telefono matches an existing invitado', async () => {
    const telefono = nextTestTelefono()
    queueSelects(
      [mockEvento],
      [{ id: 'inv-existente', evento_id: 'evt-1', telefono: dashed(telefono) }],
    )

    const res = await postReingreso('boda-test-abc123', { telefono: spaced(telefono) })
    const body = (await res.json()) as { token: string; invitado_id: string }

    expect(res.status).toBe(200)
    expect(body.invitado_id).toBe('inv-existente')
    expect(typeof body.token).toBe('string')
    expect(body.token.split('.')).toHaveLength(3)
  })

  it('matches regardless of phone formatting differences', async () => {
    const telefono = nextTestTelefono()
    queueSelects(
      [mockEvento],
      [{ id: 'inv-existente', evento_id: 'evt-1', telefono: `(${telefono.slice(0, 3)}) ${telefono.slice(3, 6)}-${telefono.slice(6)}` }],
    )

    const res = await postReingreso('boda-test-abc123', { telefono: `${telefono.slice(0, 4)} ${telefono.slice(4)}` })

    expect(res.status).toBe(200)
  })

  it('returns 404 when no invitado in this evento has that telefono', async () => {
    queueSelects([mockEvento], [{ id: 'otro', evento_id: 'evt-1', telefono: '000-000-000' }])

    const res = await postReingreso('boda-test-abc123', { telefono: nextTestTelefono() })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({
      error: 'No encontramos ese teléfono registrado en este evento. ¿Ya te registraste? Probá registrándote.',
    })
  })

  it('returns 404 when evento does not exist for the slug', async () => {
    queueSelects([])

    const res = await postReingreso('no-existe', { telefono: nextTestTelefono() })

    expect(res.status).toBe(404)
  })

  it('returns 404 when evento exists but is not active (borrador)', async () => {
    queueSelects([{ ...mockEvento, estado: 'borrador' }])

    const res = await postReingreso('boda-test-abc123', { telefono: nextTestTelefono() })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Este evento no está activo' })
  })

  it('returns 400 when telefono is missing from the body', async () => {
    const res = await postReingreso('boda-test-abc123', {})

    expect(res.status).toBe(400)
  })

  it('is rate limited via registroRateLimitMiddleware after repeated requests with the same telefono', async () => {
    queueSelects(...Array.from({ length: 11 }, () => [[mockEvento], []]).flat())

    const telefono = nextTestTelefono()
    const router = createEventosRoutes()
    let lastStatus = 0
    for (let i = 0; i < 11; i++) {
      const res = await router.request('/eventos/boda-test-abc123/invitados/reingresar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '9.9.9.8' },
        body: JSON.stringify({ telefono }),
      })
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })
})
