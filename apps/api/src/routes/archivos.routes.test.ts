import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.stubEnv('INVITADO_JWT_SECRET', 'super-secret-key-for-testing-1234567890ab')

// --- db mock ---
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

// --- r2 mock ---
const getInvitadoPresignedUploadMock = vi.fn()
vi.mock('../lib/r2.js', () => ({
  getInvitadoPresignedUpload: (...args: unknown[]) =>
    getInvitadoPresignedUploadMock(...args),
}))

const { createArchivosRoutes } = await import('./archivos.routes.js')
const { signInvitadoToken } = await import('../lib/jwt.js')

const mockEvento = {
  id: 'evt-1',
  slug: 'boda-test-abc123',
  estado: 'activo',
  nombre_evento: 'Boda Test',
  limite_invitados_login: 50,
  limite_fotos_por_invitado: 3,
  limite_videos_por_invitado: 2,
  organizador_id: 'org-1',
  fecha: '2026-12-01',
  horario: '20:00',
  foto_portada_url: null,
  cantidad_invitados_totales: 100,
  created_at: new Date(),
}

const mockInvitado = {
  id: 'inv-1',
  evento_id: 'evt-1',
  nombre: 'Ana',
  apellido: 'García',
  telefono: null,
  acepto_terminos: true,
  token_sesion: 'placeholder',
  fotos_subidas: 0,
  videos_subidos: 0,
  created_at: new Date(),
}

function queueSelects(...results: unknown[][]) {
  selectQueue.length = 0
  selectQueue.push(...results)
  selectMock.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => selectQueue.shift() ?? [],
      }),
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

let ipCounter = 0
function nextTestIp() {
  ipCounter += 1
  return `10.1.0.${ipCounter}`
}

async function authHeader(invitado_id = 'inv-1', evento_id = 'evt-1') {
  const token = await signInvitadoToken({ invitado_id, evento_id })
  return `Bearer ${token}`
}

function solicitarSubida(
  slug: string,
  body: unknown,
  authorization: string | undefined,
  ip = nextTestIp(),
) {
  const router = createArchivosRoutes()
  return router.request(`/eventos/${slug}/archivos/solicitar-subida`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

function confirmar(
  slug: string,
  body: unknown,
  authorization: string | undefined,
  ip = nextTestIp(),
) {
  const router = createArchivosRoutes()
  return router.request(`/eventos/${slug}/archivos/confirmar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockInsertReturning('arch-1')
  mockUpdateOk()
  getInvitadoPresignedUploadMock.mockResolvedValue({
    uploadUrl: 'https://r2.example.com/presigned-put-url',
    r2Key: 'eventos/evt-1/inv-1/generated-name.jpg',
  })
})

afterEach(() => {
  selectQueue.length = 0
})

describe('POST /eventos/:slug/archivos/solicitar-subida', () => {
  it('returns 200 with upload_url and r2_key when within foto limits', async () => {
    queueSelects([mockEvento], [mockInvitado])

    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'foto', extension: 'jpg' },
      await authHeader(),
    )
    const body = (await res.json()) as { upload_url: string; r2_key: string }

    expect(res.status).toBe(200)
    expect(body.upload_url).toBe('https://r2.example.com/presigned-put-url')
    expect(body.r2_key).toBe('eventos/evt-1/inv-1/generated-name.jpg')
    expect(getInvitadoPresignedUploadMock).toHaveBeenCalledWith('evt-1', 'inv-1', 'jpg')
  })

  it('returns 403 "Ya usaste tus 3 fotos" when fotos_subidas >= limite_fotos_por_invitado, and never generates a presigned URL', async () => {
    queueSelects([mockEvento], [{ ...mockInvitado, fotos_subidas: 3 }])

    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'foto', extension: 'jpg' },
      await authHeader(),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'Ya usaste tus 3 fotos' })
    // Central correctness requirement: the limit check happens BEFORE any
    // presigned URL is generated.
    expect(getInvitadoPresignedUploadMock).not.toHaveBeenCalled()
  })

  it('returns 403 "Ya usaste tus 2 videos" when videos_subidos >= limite_videos_por_invitado', async () => {
    queueSelects([mockEvento], [{ ...mockInvitado, videos_subidos: 2 }])

    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'video', extension: 'mp4' },
      await authHeader(),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'Ya usaste tus 2 videos' })
    expect(getInvitadoPresignedUploadMock).not.toHaveBeenCalled()
  })

  it('returns 400 for a disallowed extension and never touches the db or r2', async () => {
    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'foto', extension: 'exe' },
      await authHeader(),
    )

    expect(res.status).toBe(400)
    expect(selectMock).not.toHaveBeenCalled()
    expect(getInvitadoPresignedUploadMock).not.toHaveBeenCalled()
  })

  it('returns 404 when evento does not exist for the slug', async () => {
    queueSelects([])

    const res = await solicitarSubida(
      'no-existe',
      { tipo: 'foto', extension: 'jpg' },
      await authHeader(),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Evento no encontrado' })
  })

  it('returns 403 when evento is not activo', async () => {
    queueSelects([{ ...mockEvento, estado: 'borrador' }])

    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'foto', extension: 'jpg' },
      await authHeader(),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'El evento no está activo' })
  })

  it('returns 403 when the token evento_id does not match the evento in the URL', async () => {
    queueSelects([mockEvento])

    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'foto', extension: 'jpg' },
      await authHeader('inv-1', 'other-evt'),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'Token no válido para este evento' })
  })

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await solicitarSubida(
      'boda-test-abc123',
      { tipo: 'foto', extension: 'jpg' },
      undefined,
    )

    expect(res.status).toBe(401)
    expect(selectMock).not.toHaveBeenCalled()
  })
})

describe('POST /eventos/:slug/archivos/confirmar', () => {
  it('returns 201, inserts the archivo, and increments fotos_subidas', async () => {
    queueSelects([mockEvento])

    const res = await confirmar(
      'boda-test-abc123',
      {
        r2_key: 'eventos/evt-1/inv-1/generated-name.jpg',
        tipo: 'foto',
        extension: 'jpg',
      },
      await authHeader(),
    )
    const body = (await res.json()) as { archivo_id: string }

    expect(res.status).toBe(201)
    expect(body.archivo_id).toBe('arch-1')
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('returns 201 and increments videos_subidos for tipo video', async () => {
    queueSelects([mockEvento])

    const res = await confirmar(
      'boda-test-abc123',
      {
        r2_key: 'eventos/evt-1/inv-1/generated-name.mp4',
        tipo: 'video',
        extension: 'mp4',
      },
      await authHeader(),
    )

    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when r2_key does not match the expected eventos/{evento_id}/{invitado_id}/ prefix, and never inserts', async () => {
    queueSelects([mockEvento])

    const res = await confirmar(
      'boda-test-abc123',
      {
        r2_key: 'eventos/other-evt/other-inv/generated-name.jpg',
        tipo: 'foto',
        extension: 'jpg',
      },
      await authHeader(),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'r2_key no válida' })
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 404 when evento does not exist for the slug', async () => {
    queueSelects([])

    const res = await confirmar(
      'no-existe',
      { r2_key: 'eventos/evt-1/inv-1/x.jpg', tipo: 'foto', extension: 'jpg' },
      await authHeader(),
    )

    expect(res.status).toBe(404)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
