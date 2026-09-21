import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('dotenv/config', () => ({}))

// --- db mock ---
const selectQueue: unknown[][] = []
const selectMock = vi.fn()
const insertMock = vi.fn()

vi.mock('../db/index.js', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
  },
}))

const getUserMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  }),
}))

const testR2CredentialsMock = vi.fn()
const getS3ClientForOrganizadorMock = vi.fn()
const getPortadaPresignedUploadMock = vi.fn()
const getPresignedReadUrlMock = vi.fn()
const deleteR2ObjectMock = vi.fn()
vi.mock('../lib/r2.js', () => ({
  buildS3Client: () => ({ client: {}, bucket: 'test' }),
  testR2Credentials: (...args: unknown[]) => testR2CredentialsMock(...args),
  getS3ClientForOrganizador: (...args: unknown[]) => getS3ClientForOrganizadorMock(...args),
  getPortadaPresignedUpload: (...args: unknown[]) => getPortadaPresignedUploadMock(...args),
  getPresignedReadUrl: (...args: unknown[]) => getPresignedReadUrlMock(...args),
  deleteR2Object: (...args: unknown[]) => deleteR2ObjectMock(...args),
  StorageNoConfiguradoError: class StorageNoConfiguradoError extends Error {},
}))

vi.mock('../lib/crypto.js', () => ({
  encryptSecret: (v: string) => ({ cipher: `enc-${v}`, iv: 'iv', tag: 'tag' }),
  decryptSecret: (f: { cipher: string }) => f.cipher.replace('enc-', ''),
}))

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key')
vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))

const { createOrganizadorRoutes } = await import('./organizador.routes.js')

function authHeader() {
  return { Authorization: 'Bearer valid-token' }
}

function queueSelects(...results: unknown[][]) {
  selectQueue.length = 0
  selectQueue.push(...results)

  // Awaitable directamente (para rutas que hacen `await db.select()...where(...)`
  // sin `.limit()`/`.orderBy()` final, como urls-lectura y DELETE /organizador/archivos)
  // y además expone `.limit()`/`.orderBy()` para las rutas que sí encadenan uno de esos.
  function whereResult() {
    const shift = () => selectQueue.shift() ?? []
    return {
      limit: async () => shift(),
      orderBy: async () => shift(),
      then: (resolve: (v: unknown[]) => void) => resolve(shift()),
    }
  }

  selectMock.mockImplementation(() => ({
    from: () => ({
      where: whereResult,
      innerJoin: () => ({
        where: whereResult,
      }),
    }),
  }))
}

function mockInsertOnConflict() {
  const setMock = vi.fn(() => Promise.resolve())
  const onConflictDoUpdateMock = vi.fn(() => ({ set: setMock }))
  const valuesMock = vi.fn(() => ({ onConflictDoUpdate: onConflictDoUpdateMock }))
  insertMock.mockImplementation(() => ({ values: valuesMock }))
}

const validBody = {
  r2_account_id: 'acc-1',
  r2_access_key_id: 'AKIAABCDEFGH',
  r2_secret_access_key: 'secreto-largo',
  r2_bucket_name: 'mi-bucket',
}

beforeEach(() => {
  getUserMock.mockReset()
  testR2CredentialsMock.mockReset()
  selectMock.mockReset()
  insertMock.mockReset()
  getS3ClientForOrganizadorMock.mockReset()
  getPortadaPresignedUploadMock.mockReset()
  getPresignedReadUrlMock.mockReset()
  deleteR2ObjectMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { id: 'org-1' } }, error: null })
})

describe('POST /organizador/storage-config', () => {
  it('guarda las credenciales cuando la validación contra R2 funciona', async () => {
    testR2CredentialsMock.mockResolvedValue(undefined)
    mockInsertOnConflict()

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/storage-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(200)
    expect(testR2CredentialsMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('no guarda nada cuando la validación contra R2 falla', async () => {
    testR2CredentialsMock.mockRejectedValue(new Error('403 Forbidden'))

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/storage-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(422)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rechaza body incompleto con 400 antes de tocar R2', async () => {
    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/storage-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ r2_account_id: 'acc-1' }),
    })

    expect(res.status).toBe(400)
    expect(testR2CredentialsMock).not.toHaveBeenCalled()
  })
})

describe('GET /organizador/storage-config/status', () => {
  it('devuelve configurado:false si no hay fila', async () => {
    queueSelects([])

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/storage-config/status', {
      headers: authHeader(),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ configurado: false })
  })
})

describe('POST /organizador/eventos/:id/portada/solicitar-subida', () => {
  it('devuelve 404 si el evento no es del organizador autenticado', async () => {
    queueSelects([])

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/eventos/evt-1/portada/solicitar-subida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ extension: 'jpg' }),
    })

    expect(res.status).toBe(404)
  })

  it('devuelve uploadUrl y r2Key cuando el evento existe y storage está configurado', async () => {
    queueSelects([{ id: 'evt-1' }])
    getS3ClientForOrganizadorMock.mockResolvedValue({ client: {}, bucket: 'b' })
    getPortadaPresignedUploadMock.mockResolvedValue({ uploadUrl: 'https://upload.example', r2Key: 'eventos/evt-1/portada/abc.jpg' })

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/eventos/evt-1/portada/solicitar-subida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ extension: 'jpg' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { uploadUrl: string; r2Key: string }
    expect(body.uploadUrl).toBe('https://upload.example')
    expect(body.r2Key).toBe('eventos/evt-1/portada/abc.jpg')
  })
})

describe('POST /organizador/archivos/urls-lectura', () => {
  it('no devuelve ninguna URL para un archivo de otro organizador', async () => {
    queueSelects([])

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/archivos/urls-lectura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ archivo_ids: ['archivo-ajeno'] }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ urls: {} })
  })
})

describe('DELETE /organizador/archivos', () => {
  it('no borra nada si ningún archivo pertenece al organizador', async () => {
    queueSelects([])

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/archivos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ archivo_ids: ['archivo-ajeno'] }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })
})

describe('DELETE /organizador/eventos/:id/archivos-r2', () => {
  it('devuelve 404 si el evento no es del organizador', async () => {
    queueSelects([])

    const router = createOrganizadorRoutes()
    const res = await router.request('/organizador/eventos/evt-1/archivos-r2', {
      method: 'DELETE',
      headers: authHeader(),
    })

    expect(res.status).toBe(404)
  })
})
