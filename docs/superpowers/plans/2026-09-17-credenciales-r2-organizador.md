# Credenciales R2 propias por organizador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every organizador brings their own Cloudflare R2 bucket instead of consuming the SaaS owner's shared bucket — credentials are collected once, encrypted at rest, and all R2 access (upload, read, delete) is resolved through them.

**Architecture:** A new encrypted `organizador_storage_config` table backs a per-organizer `S3Client` resolver in `apps/api/src/lib/r2.ts`. All R2 reads/writes/deletes are consolidated behind new API endpoints (organizer-authed via a new Supabase-token-verifying middleware, or public for the event landing). `apps/web` stops building `S3Client`s or public R2 URLs entirely — it calls the API for every presigned upload URL, signed read URL, and delete.

**Tech Stack:** Hono (API), Next.js 15 App Router (web), Drizzle ORM + Postgres (Supabase), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `node:crypto` (AES-256-GCM), `@supabase/supabase-js` (new dependency in `apps/api`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-credenciales-r2-organizador-design.md`

## Global Constraints

- Cifrado: AES-256-GCM vía `node:crypto`, sin dependencias nuevas para eso. Clave maestra en `CREDENTIALS_ENCRYPTION_KEY` (32 bytes base64), solo en `apps/api`.
- Todo el acceso a R2 (presign de subida, URL de lectura, borrado) pasa por la API — `apps/web` no arma `S3Client` ni URLs públicas de R2 en ningún punto.
- URLs de lectura son siempre firmadas (nunca una URL pública fija), sin importar si el bucket del organizador es público o privado.
- Configuración de R2 es una por cuenta de organizador (no por evento), y se valida contra R2 real (Put+Delete de prueba) antes de guardarse.
- Todas las cuentas, incluida la que ya está en producción, pasan por el mismo gate — no hay excepciones.
- No se corre SQL directo contra la base de producción desde esta sesión — la migración de tabla se genera con `drizzle-kit` (mismo flujo ya usado en Fase 1), y la política RLS se entrega como SQL para que el usuario la corra a mano en el SQL Editor de Supabase, igual que las políticas de `eventos` ya existentes.

---

## Task 1: Módulo de cifrado (`apps/api/src/lib/crypto.ts`)

**Files:**
- Create: `apps/api/src/lib/crypto.ts`
- Test: `apps/api/src/lib/crypto.test.ts`
- Modify: `apps/api/.env.example` (agregar `CREDENTIALS_ENCRYPTION_KEY`)
- Modify: `.env.example` (raíz del monorepo, misma variable)

**Interfaces:**
- Produces: `encryptSecret(plaintext: string): { cipher: string; iv: string; tag: string }`, `decryptSecret(input: { cipher: string; iv: string; tag: string }): string`, type `EncryptedField`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// apps/api/src/lib/crypto.test.ts
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
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd apps/api && pnpm vitest run src/lib/crypto.test.ts`
Expected: FAIL — `Cannot find module './crypto.js'`

- [ ] **Step 3: Implementar `crypto.ts`**

```typescript
// apps/api/src/lib/crypto.ts
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
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd apps/api && pnpm vitest run src/lib/crypto.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Agregar la variable de entorno nueva a los archivos de ejemplo**

En `apps/api/.env.example`, agregar después de `R2_BUCKET_NAME=album-media`:

```
# ─── Cifrado de credenciales de terceros ───────────────────
# 32 bytes, base64: openssl rand -base64 32
CREDENTIALS_ENCRYPTION_KEY=
```

En `.env.example` (raíz), agregar la misma variable en la sección `# ─── Cloudflare R2 ──`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/crypto.ts apps/api/src/lib/crypto.test.ts apps/api/.env.example .env.example
git commit -m "$(cat <<'EOF'
feat(api): módulo de cifrado AES-256-GCM para credenciales de terceros

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tabla `organizador_storage_config` + migración

**Files:**
- Modify: `packages/database/src/schema.ts`
- Create (generado por drizzle-kit): `packages/database/migrations/000X_<nombre>.sql`

**Interfaces:**
- Produces: Drizzle table `organizadorStorageConfig`, types `OrganizadorStorageConfig` / `NuevoOrganizadorStorageConfig`.

- [ ] **Step 1: Agregar la tabla al schema**

En `packages/database/src/schema.ts`, después de la definición de `archivos` (antes de los `export type`):

```typescript
export const organizadorStorageConfig = pgTable('organizador_storage_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizador_id: uuid('organizador_id').notNull().unique(),
  r2_account_id_cipher: text('r2_account_id_cipher').notNull(),
  r2_account_id_iv: text('r2_account_id_iv').notNull(),
  r2_account_id_tag: text('r2_account_id_tag').notNull(),
  r2_access_key_id_cipher: text('r2_access_key_id_cipher').notNull(),
  r2_access_key_id_iv: text('r2_access_key_id_iv').notNull(),
  r2_access_key_id_tag: text('r2_access_key_id_tag').notNull(),
  r2_secret_access_key_cipher: text('r2_secret_access_key_cipher').notNull(),
  r2_secret_access_key_iv: text('r2_secret_access_key_iv').notNull(),
  r2_secret_access_key_tag: text('r2_secret_access_key_tag').notNull(),
  r2_bucket_name_cipher: text('r2_bucket_name_cipher').notNull(),
  r2_bucket_name_iv: text('r2_bucket_name_iv').notNull(),
  r2_bucket_name_tag: text('r2_bucket_name_tag').notNull(),
  verificado_at: timestamp('verificado_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
```

Y junto a los `export type` existentes al final del archivo:

```typescript
export type OrganizadorStorageConfig = typeof organizadorStorageConfig.$inferSelect
export type NuevoOrganizadorStorageConfig = typeof organizadorStorageConfig.$inferInsert
```

- [ ] **Step 2: Generar la migración**

Run: `cd packages/database && pnpm db:generate`
Expected: crea `migrations/000X_<nombre-random>.sql` con el `CREATE TABLE "organizador_storage_config"` correspondiente a las columnas de arriba. Revisar el SQL generado — debe incluir el `UNIQUE` en `organizador_id` y ningún `NOT NULL` en `verificado_at`/`created_at`/`updated_at`.

- [ ] **Step 3: Aplicar la migración**

Esto corre DDL contra la base de Supabase real (`DATABASE_URL` del `.env` de `packages/database`) — **confirmar con el usuario antes de correrlo** si la sesión no tiene ya autorización explícita para escribir en esa base.

Run: `cd packages/database && pnpm db:migrate`
Expected: la tabla `organizador_storage_config` existe en Supabase (se puede confirmar con `pnpm db:studio` o pidiéndole al usuario que la vea en el Table Editor de Supabase — no correr un `SELECT` directo desde esta sesión).

- [ ] **Step 4: Entregar el SQL de RLS al usuario (no ejecutarlo desde acá)**

RLS no se aplica vía migración de Drizzle en este repo (la política de `eventos` tampoco vive en `migrations/`) — se corre a mano en el SQL Editor de Supabase, mismo patrón ya usado. Mostrarle este bloque al usuario para que lo pegue él mismo:

```sql
alter table public.organizador_storage_config enable row level security;

create policy organizador_owns_storage_config
  on public.organizador_storage_config
  for all
  using (organizador_id = auth.uid())
  with check (organizador_id = auth.uid());
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema.ts packages/database/migrations
git commit -m "$(cat <<'EOF'
feat(db): tabla organizador_storage_config para credenciales R2 cifradas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Middleware `auth-organizador` + dependencia de Supabase en la API

**Files:**
- Modify: `apps/api/package.json` (agregar `@supabase/supabase-js`)
- Create: `apps/api/src/middleware/auth-organizador.ts`
- Test: `apps/api/src/middleware/auth-organizador.test.ts`
- Modify: `apps/api/.env.example` y `.env.example` (raíz): agregar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Interfaces:**
- Consumes: ninguna de tasks anteriores.
- Produces: `authOrganizadorMiddleware` (Hono middleware que setea `c.set('organizador_id', string)`).

- [ ] **Step 1: Agregar la dependencia**

Run: `cd apps/api && pnpm add @supabase/supabase-js@^2.49.1`
Expected: se agrega a `apps/api/package.json` (misma versión que ya usa `apps/web`).

- [ ] **Step 2: Escribir el test que falla**

```typescript
// apps/api/src/middleware/auth-organizador.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key')

const getUserMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  }),
}))

const { authOrganizadorMiddleware } = await import('./auth-organizador.js')

function buildApp() {
  const app = new Hono<{ Variables: { organizador_id: string } }>()
  app.get('/protegido', authOrganizadorMiddleware, (c) =>
    c.json({ organizador_id: c.get('organizador_id') }),
  )
  return app
}

beforeEach(() => {
  getUserMock.mockReset()
})

describe('authOrganizadorMiddleware', () => {
  it('rechaza sin Authorization header', async () => {
    const res = await buildApp().request('/protegido')
    expect(res.status).toBe(401)
  })

  it('rechaza un token inválido', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const res = await buildApp().request('/protegido', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)
  })

  it('setea organizador_id para un token válido', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'org-1' } }, error: null })
    const res = await buildApp().request('/protegido', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ organizador_id: 'org-1' })
  })
})
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `cd apps/api && pnpm vitest run src/middleware/auth-organizador.test.ts`
Expected: FAIL — `Cannot find module './auth-organizador.js'`

- [ ] **Step 4: Implementar el middleware**

```typescript
// apps/api/src/middleware/auth-organizador.ts
import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'

type Env = {
  Variables: {
    organizador_id: string
  }
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, serviceRoleKey)
}

export const authOrganizadorMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Sesión de organizador requerida' }, 401)
  }

  const token = authHeader.slice(7)
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return c.json({ error: 'Sesión inválida o expirada' }, 401)
  }

  c.set('organizador_id', data.user.id)
  return next()
})
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `cd apps/api && pnpm vitest run src/middleware/auth-organizador.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Agregar las variables de entorno nuevas**

En `apps/api/.env.example`, agregar en una sección nueva:

```
# ─── Supabase (verificación de sesión de organizador) ──────
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

En `.env.example` (raíz), la sección `# ─── Supabase ───` ya tiene `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (para `apps/web`). Agregar debajo de esa sección:

```
# apps/api necesita las mismas credenciales, sin el prefijo NEXT_PUBLIC_
# (las usa auth-organizador.ts para verificar la sesión del organizador)
SUPABASE_URL=
```

(`SUPABASE_SERVICE_ROLE_KEY` ya está declarada arriba y es la misma variable/valor que usa `apps/api` — no se duplica.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/middleware/auth-organizador.ts apps/api/src/middleware/auth-organizador.test.ts apps/api/.env.example .env.example
git commit -m "$(cat <<'EOF'
feat(api): middleware de autenticación de organizador vía sesión de Supabase

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

*(Nota: si el lockfile del monorepo es único en la raíz en vez de por paquete, ajustar el `git add` a `pnpm-lock.yaml` de la raíz — confirmar con `git status` antes del commit.)*

---

## Task 4: Refactor de `apps/api/src/lib/r2.ts` — de env vars a credenciales por organizador

**Files:**
- Modify: `apps/api/src/lib/r2.ts` (reescritura completa)

**Interfaces:**
- Consumes: `decryptSecret` (Task 1), tabla `organizadorStorageConfig` (Task 2).
- Produces: `OrganizadorR2Client` (`{ client: S3Client; bucket: string }`), `StorageNoConfiguradoError`, `buildS3Client(config)`, `getS3ClientForOrganizador(organizadorId): Promise<OrganizadorR2Client>`, `getS3ClientForEvento(eventoId): Promise<OrganizadorR2Client>`, `getInvitadoPresignedUpload(clientInfo, eventoId, invitadoId, extension)`, `getPortadaPresignedUpload(clientInfo, eventoId, extension)`, `getPresignedReadUrl(clientInfo, r2Key, expiresIn?)`, `deleteR2Object(clientInfo, r2Key)`, `testR2Credentials(clientInfo): Promise<void>`.

Este módulo no tiene test propio hoy (`archivos.routes.test.ts` lo mockea completo) — se actualizan esos mocks en la Task 9, después de que las rutas que lo consumen estén reescritas.

- [ ] **Step 1: Reescribir `apps/api/src/lib/r2.ts`**

```typescript
// apps/api/src/lib/r2.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eventos, organizadorStorageConfig } from '@album/database'
import { decryptSecret } from './crypto.js'

export class StorageNoConfiguradoError extends Error {
  constructor() {
    super('El organizador todavía no configuró su storage de R2')
    this.name = 'StorageNoConfiguradoError'
  }
}

export interface OrganizadorR2Client {
  client: S3Client
  bucket: string
}

export function buildS3Client(config: {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}): OrganizadorR2Client {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return { client, bucket: config.bucket }
}

async function resolveFromRow(
  row: typeof organizadorStorageConfig.$inferSelect,
): Promise<OrganizadorR2Client> {
  if (!row.verificado_at) throw new StorageNoConfiguradoError()

  return buildS3Client({
    accountId: decryptSecret({
      cipher: row.r2_account_id_cipher,
      iv: row.r2_account_id_iv,
      tag: row.r2_account_id_tag,
    }),
    accessKeyId: decryptSecret({
      cipher: row.r2_access_key_id_cipher,
      iv: row.r2_access_key_id_iv,
      tag: row.r2_access_key_id_tag,
    }),
    secretAccessKey: decryptSecret({
      cipher: row.r2_secret_access_key_cipher,
      iv: row.r2_secret_access_key_iv,
      tag: row.r2_secret_access_key_tag,
    }),
    bucket: decryptSecret({
      cipher: row.r2_bucket_name_cipher,
      iv: row.r2_bucket_name_iv,
      tag: row.r2_bucket_name_tag,
    }),
  })
}

export async function getS3ClientForOrganizador(
  organizadorId: string,
): Promise<OrganizadorR2Client> {
  const [row] = await db
    .select()
    .from(organizadorStorageConfig)
    .where(eq(organizadorStorageConfig.organizador_id, organizadorId))
    .limit(1)

  if (!row) throw new StorageNoConfiguradoError()
  return resolveFromRow(row)
}

export async function getS3ClientForEvento(eventoId: string): Promise<OrganizadorR2Client> {
  const [row] = await db
    .select({ organizador_id: eventos.organizador_id })
    .from(eventos)
    .where(eq(eventos.id, eventoId))
    .limit(1)

  if (!row) throw new StorageNoConfiguradoError()
  return getS3ClientForOrganizador(row.organizador_id)
}

export async function getInvitadoPresignedUpload(
  { client, bucket }: OrganizadorR2Client,
  eventoId: string,
  invitadoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  const r2Key = `eventos/${eventoId}/${invitadoId}/${nanoid()}.${extension}`
  const command = new PutObjectCommand({ Bucket: bucket, Key: r2Key })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  return { uploadUrl, r2Key }
}

export async function getPortadaPresignedUpload(
  { client, bucket }: OrganizadorR2Client,
  eventoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  const r2Key = `eventos/${eventoId}/portada/${nanoid()}.${extension}`
  const command = new PutObjectCommand({ Bucket: bucket, Key: r2Key })
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  return { uploadUrl, r2Key }
}

export async function getPresignedReadUrl(
  { client, bucket }: OrganizadorR2Client,
  r2Key: string,
  expiresIn = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: r2Key })
  return getSignedUrl(client, command, { expiresIn })
}

export async function deleteR2Object(
  { client, bucket }: OrganizadorR2Client,
  r2Key: string,
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }))
}

export async function testR2Credentials(clientInfo: OrganizadorR2Client): Promise<void> {
  const testKey = `_album-verificacion/${nanoid()}.txt`
  await clientInfo.client.send(
    new PutObjectCommand({ Bucket: clientInfo.bucket, Key: testKey, Body: 'album-verificacion' }),
  )
  await clientInfo.client.send(
    new DeleteObjectCommand({ Bucket: clientInfo.bucket, Key: testKey }),
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && pnpm build`
Expected: falla acá es esperado — `eventos.routes.ts` y `archivos.routes.ts` todavía llaman a las firmas viejas de `getInvitadoPresignedUpload`/`deleteR2Object`. Se arregla en la Task 9. Confirmar igual que el error de compilación es *solo* en esos dos call sites (no un typo nuevo en `r2.ts`) leyendo el output de `tsc`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/r2.ts
git commit -m "$(cat <<'EOF'
refactor(api): r2.ts resuelve credenciales por organizador en vez de env vars estáticas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Endpoints de storage-config (`POST` y `GET status`)

**Files:**
- Create: `apps/api/src/routes/organizador.routes.ts`
- Test: `apps/api/src/routes/organizador.routes.test.ts`

**Interfaces:**
- Consumes: `authOrganizadorMiddleware` (Task 3), `encryptSecret`/`decryptSecret` (Task 1), `buildS3Client`/`testR2Credentials` (Task 4), tabla `organizadorStorageConfig` (Task 2).
- Produces: `createOrganizadorRoutes(): Hono` con `POST /organizador/storage-config` y `GET /organizador/storage-config/status`. Se completa con más rutas en las Tasks 6 y 7 sobre el mismo router.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// apps/api/src/routes/organizador.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('dotenv/config', () => ({}))

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
vi.mock('../lib/r2.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/r2.js')>('../lib/r2.js')
  return {
    ...actual,
    testR2Credentials: (...args: unknown[]) => testR2CredentialsMock(...args),
  }
})

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key')
vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))

const { createOrganizadorRoutes } = await import('./organizador.routes.js')

function authHeader() {
  return { Authorization: 'Bearer valid-token' }
}

function postStorageConfig(body: unknown) {
  const router = createOrganizadorRoutes()
  return router.request('/organizador/storage-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  })
}

function getStatus() {
  const router = createOrganizadorRoutes()
  return router.request('/organizador/storage-config/status', { headers: authHeader() })
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
  getUserMock.mockResolvedValue({ data: { user: { id: 'org-1' } }, error: null })
})

describe('POST /organizador/storage-config', () => {
  it('guarda las credenciales cuando la validación contra R2 funciona', async () => {
    testR2CredentialsMock.mockResolvedValue(undefined)
    const valuesMock = vi.fn(() => ({ onConflictDoUpdate: () => Promise.resolve() }))
    insertMock.mockImplementation(() => ({ values: valuesMock }))

    const res = await postStorageConfig(validBody)

    expect(res.status).toBe(200)
    expect(testR2CredentialsMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('no guarda nada cuando la validación contra R2 falla', async () => {
    testR2CredentialsMock.mockRejectedValue(new Error('403 Forbidden'))

    const res = await postStorageConfig(validBody)

    expect(res.status).toBe(422)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rechaza body incompleto con 400 antes de tocar R2', async () => {
    const res = await postStorageConfig({ r2_account_id: 'acc-1' })

    expect(res.status).toBe(400)
    expect(testR2CredentialsMock).not.toHaveBeenCalled()
  })
})

describe('GET /organizador/storage-config/status', () => {
  it('devuelve configurado:false si no hay fila', async () => {
    selectMock.mockImplementation(() => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }))

    const res = await getStatus()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ configurado: false })
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd apps/api && pnpm vitest run src/routes/organizador.routes.test.ts`
Expected: FAIL — `Cannot find module './organizador.routes.js'`

- [ ] **Step 3: Implementar `organizador.routes.ts` (parte 1: storage-config)**

```typescript
// apps/api/src/routes/organizador.routes.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { organizadorStorageConfig } from '@album/database'
import { authOrganizadorMiddleware } from '../middleware/auth-organizador.js'
import { encryptSecret, decryptSecret } from '../lib/crypto.js'
import { buildS3Client, testR2Credentials } from '../lib/r2.js'
import { logger } from '../lib/logger.js'

type Env = { Variables: { organizador_id: string } }

const storageConfigSchema = z.object({
  r2_account_id: z.string().min(1),
  r2_access_key_id: z.string().min(1),
  r2_secret_access_key: z.string().min(1),
  r2_bucket_name: z.string().min(1),
})

export function createOrganizadorRoutes() {
  const router = new Hono<Env>()

  router.post(
    '/organizador/storage-config',
    authOrganizadorMiddleware,
    zValidator('json', storageConfigSchema),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const body = c.req.valid('json')

      const clientInfo = buildS3Client({
        accountId: body.r2_account_id,
        accessKeyId: body.r2_access_key_id,
        secretAccessKey: body.r2_secret_access_key,
        bucket: body.r2_bucket_name,
      })

      try {
        await testR2Credentials(clientInfo)
      } catch (err) {
        logger.warn({ err, organizadorId }, 'Validación de credenciales R2 falló')
        return c.json(
          {
            error:
              'No pudimos conectarnos a tu bucket con esas credenciales. Revisá el Account ID, las keys y el nombre del bucket.',
          },
          422,
        )
      }

      const accountId = encryptSecret(body.r2_account_id)
      const accessKeyId = encryptSecret(body.r2_access_key_id)
      const secretAccessKey = encryptSecret(body.r2_secret_access_key)
      const bucketName = encryptSecret(body.r2_bucket_name)
      const now = new Date()

      const values = {
        organizador_id: organizadorId,
        r2_account_id_cipher: accountId.cipher,
        r2_account_id_iv: accountId.iv,
        r2_account_id_tag: accountId.tag,
        r2_access_key_id_cipher: accessKeyId.cipher,
        r2_access_key_id_iv: accessKeyId.iv,
        r2_access_key_id_tag: accessKeyId.tag,
        r2_secret_access_key_cipher: secretAccessKey.cipher,
        r2_secret_access_key_iv: secretAccessKey.iv,
        r2_secret_access_key_tag: secretAccessKey.tag,
        r2_bucket_name_cipher: bucketName.cipher,
        r2_bucket_name_iv: bucketName.iv,
        r2_bucket_name_tag: bucketName.tag,
        verificado_at: now,
      }

      await db
        .insert(organizadorStorageConfig)
        .values(values)
        .onConflictDoUpdate({
          target: organizadorStorageConfig.organizador_id,
          set: { ...values, updated_at: now },
        })

      logger.info({ organizadorId }, 'Credenciales R2 guardadas y verificadas')
      return c.json({ success: true }, 200)
    },
  )

  router.get('/organizador/storage-config/status', authOrganizadorMiddleware, async (c) => {
    const organizadorId = c.get('organizador_id')

    const [row] = await db
      .select({
        verificado_at: organizadorStorageConfig.verificado_at,
        bucketCipher: organizadorStorageConfig.r2_bucket_name_cipher,
        bucketIv: organizadorStorageConfig.r2_bucket_name_iv,
        bucketTag: organizadorStorageConfig.r2_bucket_name_tag,
        accessKeyCipher: organizadorStorageConfig.r2_access_key_id_cipher,
        accessKeyIv: organizadorStorageConfig.r2_access_key_id_iv,
        accessKeyTag: organizadorStorageConfig.r2_access_key_id_tag,
      })
      .from(organizadorStorageConfig)
      .where(eq(organizadorStorageConfig.organizador_id, organizadorId))
      .limit(1)

    if (!row || !row.verificado_at) {
      return c.json({ configurado: false as const }, 200)
    }

    const bucket = decryptSecret({ cipher: row.bucketCipher, iv: row.bucketIv, tag: row.bucketTag })
    const accessKeyId = decryptSecret({
      cipher: row.accessKeyCipher,
      iv: row.accessKeyIv,
      tag: row.accessKeyTag,
    })

    return c.json(
      { configurado: true as const, bucket, terminaEn: accessKeyId.slice(-4) },
      200,
    )
  })

  return router
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd apps/api && pnpm vitest run src/routes/organizador.routes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/organizador.routes.ts apps/api/src/routes/organizador.routes.test.ts
git commit -m "$(cat <<'EOF'
feat(api): endpoints de guardar/validar y consultar estado de credenciales R2

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Endpoint de presign de portada

**Files:**
- Modify: `apps/api/src/routes/organizador.routes.ts` (agregar ruta al mismo router)
- Modify: `apps/api/src/routes/organizador.routes.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `getS3ClientForOrganizador`, `getPortadaPresignedUpload`, `StorageNoConfiguradoError` (Task 4).
- Produces: `POST /organizador/eventos/:id/portada/solicitar-subida` → `{ uploadUrl: string; r2Key: string }`.

- [ ] **Step 1: Agregar los casos de test**

En `organizador.routes.test.ts`, agregar el mock de `eventos` a la tabla mockeada de `../db/index.js` (ya existe `db.select`, se reutiliza `selectMock` con un helper de cola como en `archivos.routes.test.ts`):

```typescript
// agregar cerca de los otros helpers en organizador.routes.test.ts
function queueSelects(...results: unknown[][]) {
  const queue = [...results]
  selectMock.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => queue.shift() ?? [],
        // getS3ClientForOrganizador también hace un .where(...).limit(1)
        // sin .from() intermedio en algunos call sites — ver Step 3.
      }),
    }),
  }))
}

function postPortadaPresign(eventoId: string, body: unknown) {
  const router = createOrganizadorRoutes()
  return router.request(`/organizador/eventos/${eventoId}/portada/solicitar-subida`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  })
}

describe('POST /organizador/eventos/:id/portada/solicitar-subida', () => {
  it('devuelve 404 si el evento no es del organizador autenticado', async () => {
    queueSelects([]) // evento no encontrado para ese organizador_id
    const res = await postPortadaPresign('evt-1', { extension: 'jpg' })
    expect(res.status).toBe(404)
  })
})
```

`queueSelects` encola una respuesta por cada `select().from().where().limit()` secuencial que dispare el handler, en el orden en que se llaman — mismo mecanismo que ya usa `archivos.routes.test.ts` para manejar varios `select` en un mismo request.

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd apps/api && pnpm vitest run src/routes/organizador.routes.test.ts`
Expected: FAIL — ruta no encontrada (404 genérico de Hono, no el 404 de negocio esperado) o error de importación.

- [ ] **Step 3: Agregar la ruta**

En `organizador.routes.ts`, agregar los imports necesarios y la ruta dentro de `createOrganizadorRoutes()`, antes del `return router`. Cambiar la línea `import { eq } from 'drizzle-orm'` (agregada en la Task 5) por:

```typescript
import { eq, and } from 'drizzle-orm'
```

Y la línea `import { organizadorStorageConfig } from '@album/database'` (Task 5) por:

```typescript
import { organizadorStorageConfig, eventos } from '@album/database'
```

Y la línea `import { buildS3Client, testR2Credentials } from '../lib/r2.js'` (Task 5) por:

```typescript
import {
  buildS3Client,
  testR2Credentials,
  getS3ClientForOrganizador,
  getPortadaPresignedUpload,
  StorageNoConfiguradoError,
} from '../lib/r2.js'
```

```typescript
  router.post(
    '/organizador/eventos/:id/portada/solicitar-subida',
    authOrganizadorMiddleware,
    zValidator('json', z.object({ extension: z.string().min(1).max(10) })),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const { id: eventoId } = c.req.param()
      const { extension } = c.req.valid('json')

      const [evento] = await db
        .select({ id: eventos.id })
        .from(eventos)
        .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))
        .limit(1)

      if (!evento) return c.json({ error: 'Evento no encontrado' }, 404)

      try {
        const clientInfo = await getS3ClientForOrganizador(organizadorId)
        const ext = extension.toLowerCase().replace(/^\./, '')
        const { uploadUrl, r2Key } = await getPortadaPresignedUpload(clientInfo, eventoId, ext)
        return c.json({ uploadUrl, r2Key }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
        }
        throw err
      }
    },
  )
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd apps/api && pnpm vitest run src/routes/organizador.routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/organizador.routes.ts apps/api/src/routes/organizador.routes.test.ts
git commit -m "$(cat <<'EOF'
feat(api): presign de subida de portada usando el R2 del organizador

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Endpoints de lectura en batch y borrado

**Files:**
- Modify: `apps/api/src/routes/organizador.routes.ts`
- Modify: `apps/api/src/routes/organizador.routes.test.ts`

**Interfaces:**
- Consumes: `getS3ClientForOrganizador`, `getPresignedReadUrl`, `deleteR2Object` (Task 4); tabla `archivos` (existente).
- Produces: `POST /organizador/archivos/urls-lectura` → `{ urls: Record<string, string> }`; `DELETE /organizador/archivos` → `{ success: true }`; `DELETE /organizador/eventos/:id/archivos-r2` → `{ success: true }`.

- [ ] **Step 1: Agregar los casos de test**

```typescript
function postUrlsLectura(archivoIds: string[]) {
  const router = createOrganizadorRoutes()
  return router.request('/organizador/archivos/urls-lectura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ archivo_ids: archivoIds }),
  })
}

describe('POST /organizador/archivos/urls-lectura', () => {
  it('no devuelve ninguna URL para un archivo de otro organizador', async () => {
    queueSelects([]) // el join por organizador_id no matchea nada
    const res = await postUrlsLectura(['archivo-ajeno'])
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ urls: {} })
  })
})

function deleteArchivos(archivoIds: string[]) {
  const router = createOrganizadorRoutes()
  return router.request('/organizador/archivos', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ archivo_ids: archivoIds }),
  })
}

describe('DELETE /organizador/archivos', () => {
  it('no borra nada si ningún archivo pertenece al organizador', async () => {
    queueSelects([])
    const res = await deleteArchivos(['archivo-ajeno'])
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd apps/api && pnpm vitest run src/routes/organizador.routes.test.ts`
Expected: FAIL — rutas no existen todavía.

- [ ] **Step 3: Agregar las rutas**

En `organizador.routes.ts`, extender las tres líneas de import que ya tocó la Task 6:

```typescript
import { eq, and, inArray } from 'drizzle-orm'
import { organizadorStorageConfig, eventos, archivos } from '@album/database'
import {
  buildS3Client,
  testR2Credentials,
  getS3ClientForOrganizador,
  getPortadaPresignedUpload,
  getPresignedReadUrl,
  deleteR2Object,
  StorageNoConfiguradoError,
} from '../lib/r2.js'
```

Agregar las tres rutas dentro de `createOrganizadorRoutes()`:

```typescript
  router.post(
    '/organizador/archivos/urls-lectura',
    authOrganizadorMiddleware,
    zValidator('json', z.object({ archivo_ids: z.array(z.string()).min(1).max(200) })),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const { archivo_ids } = c.req.valid('json')

      const rows = await db
        .select({ id: archivos.id, r2_key: archivos.r2_key })
        .from(archivos)
        .innerJoin(eventos, eq(archivos.evento_id, eventos.id))
        .where(and(inArray(archivos.id, archivo_ids), eq(eventos.organizador_id, organizadorId)))

      if (rows.length === 0) return c.json({ urls: {} }, 200)

      try {
        const clientInfo = await getS3ClientForOrganizador(organizadorId)
        const urls: Record<string, string> = {}
        for (const row of rows) {
          urls[row.id] = await getPresignedReadUrl(clientInfo, row.r2_key)
        }
        return c.json({ urls }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
        }
        throw err
      }
    },
  )

  router.delete(
    '/organizador/archivos',
    authOrganizadorMiddleware,
    zValidator('json', z.object({ archivo_ids: z.array(z.string()).min(1).max(200) })),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const { archivo_ids } = c.req.valid('json')

      const rows = await db
        .select({ id: archivos.id, r2_key: archivos.r2_key })
        .from(archivos)
        .innerJoin(eventos, eq(archivos.evento_id, eventos.id))
        .where(and(inArray(archivos.id, archivo_ids), eq(eventos.organizador_id, organizadorId)))

      if (rows.length === 0) return c.json({ success: true as const }, 200)

      try {
        const clientInfo = await getS3ClientForOrganizador(organizadorId)
        for (const row of rows) {
          await deleteR2Object(clientInfo, row.r2_key)
        }
        return c.json({ success: true as const }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
        }
        throw err
      }
    },
  )

  router.delete('/organizador/eventos/:id/archivos-r2', authOrganizadorMiddleware, async (c) => {
    const organizadorId = c.get('organizador_id')
    const { id: eventoId } = c.req.param()

    const [evento] = await db
      .select({ id: eventos.id, foto_portada_url: eventos.foto_portada_url })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))
      .limit(1)

    if (!evento) return c.json({ error: 'Evento no encontrado' }, 404)

    const archivosDelEvento = await db
      .select({ r2_key: archivos.r2_key })
      .from(archivos)
      .where(eq(archivos.evento_id, eventoId))

    const keys = archivosDelEvento.map((a) => a.r2_key)
    if (evento.foto_portada_url) keys.push(evento.foto_portada_url)

    if (keys.length === 0) return c.json({ success: true as const }, 200)

    try {
      const clientInfo = await getS3ClientForOrganizador(organizadorId)
      for (const key of keys) {
        await deleteR2Object(clientInfo, key)
      }
      return c.json({ success: true as const }, 200)
    } catch (err) {
      if (err instanceof StorageNoConfiguradoError) {
        return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
      }
      throw err
    }
  })
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd apps/api && pnpm vitest run src/routes/organizador.routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/organizador.routes.ts apps/api/src/routes/organizador.routes.test.ts
git commit -m "$(cat <<'EOF'
feat(api): URLs de lectura en batch y borrado de archivos R2 del organizador

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Registrar rutas + endpoint público de portada

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/eventos.routes.ts`
- Modify: `apps/api/src/routes/eventos.routes.test.ts`

**Interfaces:**
- Consumes: `createOrganizadorRoutes` (Task 5-7), `getS3ClientForEvento`/`getPresignedReadUrl`/`StorageNoConfiguradoError` (Task 4).
- Produces: `GET /eventos/:slug/portada-url` público → `{ url: string }`.

- [ ] **Step 1: Registrar `organizador.routes.ts` en `index.ts`**

En `apps/api/src/index.ts`, agregar el import junto a los otros:

```typescript
import { createOrganizadorRoutes } from './routes/organizador.routes.js'
```

Y la línea de registro junto a las otras dos:

```typescript
app.route('/', createOrganizadorRoutes())
```

- [ ] **Step 2: Escribir el test que falla para el endpoint público**

En `apps/api/src/routes/eventos.routes.test.ts`, agregar (siguiendo el mismo patrón de mocks ya presente en ese archivo — mock de `../db/index.js` y de `../lib/r2.js`):

```typescript
// agregar junto a los otros mocks de '../lib/r2.js' en este archivo
const getS3ClientForEventoMock = vi.fn()
const getPresignedReadUrlMock = vi.fn()
vi.mock('../lib/r2.js', () => ({
  getS3ClientForEvento: (...args: unknown[]) => getS3ClientForEventoMock(...args),
  getPresignedReadUrl: (...args: unknown[]) => getPresignedReadUrlMock(...args),
  StorageNoConfiguradoError: class StorageNoConfiguradoError extends Error {},
}))

describe('GET /eventos/:slug/portada-url', () => {
  it('devuelve 404 si el evento no tiene portada', async () => {
    queueSelects([{ ...mockEvento, foto_portada_url: null }])
    const router = createEventosRoutes()
    const res = await router.request(`/eventos/${mockEvento.slug}/portada-url`)
    expect(res.status).toBe(404)
  })

  it('devuelve una URL firmada cuando hay portada y storage configurado', async () => {
    queueSelects([{ ...mockEvento, foto_portada_url: 'eventos/evt-1/portada/foo.jpg' }])
    getS3ClientForEventoMock.mockResolvedValue({ client: {}, bucket: 'b' })
    getPresignedReadUrlMock.mockResolvedValue('https://signed.example/foo.jpg')

    const router = createEventosRoutes()
    const res = await router.request(`/eventos/${mockEvento.slug}/portada-url`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://signed.example/foo.jpg' })
  })
})
```

`eventos.routes.test.ts` ya define `mockEvento` y `queueSelects` (usados por los tests existentes de registro de invitados) — se reutilizan tal cual, sin duplicarlos.

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `cd apps/api && pnpm vitest run src/routes/eventos.routes.test.ts`
Expected: FAIL — ruta no existe.

- [ ] **Step 4: Agregar la ruta**

En `eventos.routes.ts`, agregar el import:

```typescript
import { getS3ClientForEvento, getPresignedReadUrl, StorageNoConfiguradoError } from '../lib/r2.js'
```

Y la ruta, dentro de `createEventosRoutes()`:

```typescript
  router.get('/eventos/:slug/portada-url', async (c) => {
    const { slug } = c.req.param()

    // Sin .limit(1): mismo estilo que el resto de las queries de este
    // archivo (ver el lookup de evento en POST /eventos/:slug/invitados).
    const [evento] = await db
      .select({ id: eventos.id, foto_portada_url: eventos.foto_portada_url })
      .from(eventos)
      .where(eq(eventos.slug, slug))

    if (!evento || !evento.foto_portada_url) {
      return c.json({ error: 'Portada no disponible' }, 404)
    }

    try {
      const clientInfo = await getS3ClientForEvento(evento.id)
      const url = await getPresignedReadUrl(clientInfo, evento.foto_portada_url)
      return c.json({ url }, 200)
    } catch (err) {
      if (err instanceof StorageNoConfiguradoError) {
        return c.json({ error: 'Portada no disponible' }, 404)
      }
      throw err
    }
  })
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `cd apps/api && pnpm vitest run src/routes/eventos.routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/routes/eventos.routes.ts apps/api/src/routes/eventos.routes.test.ts
git commit -m "$(cat <<'EOF'
feat(api): registrar rutas de organizador y exponer portada-url pública

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Actualizar `archivos.routes.ts` a las nuevas firmas de `r2.ts` + `url` en `mis-archivos`

**Files:**
- Modify: `apps/api/src/routes/archivos.routes.ts`
- Modify: `apps/api/src/routes/archivos.routes.test.ts`

**Interfaces:**
- Consumes: `getS3ClientForEvento`, `getInvitadoPresignedUpload`, `deleteR2Object`, `getPresignedReadUrl`, `StorageNoConfiguradoError` (Task 4).
- Produces: `GET /eventos/:slug/archivos/mis-archivos` ahora incluye `url: string` por fila.

- [ ] **Step 1: Actualizar los mocks existentes del test**

En `archivos.routes.test.ts`, reemplazar el bloque de mock de `../lib/r2.js` (líneas 21-26 actuales):

```typescript
// antes
const getInvitadoPresignedUploadMock = vi.fn()
vi.mock('../lib/r2.js', () => ({
  getInvitadoPresignedUpload: (...args: unknown[]) =>
    getInvitadoPresignedUploadMock(...args),
}))
```

por:

```typescript
// después
const getInvitadoPresignedUploadMock = vi.fn()
const deleteR2ObjectMock = vi.fn()
const getS3ClientForEventoMock = vi.fn()
const getPresignedReadUrlMock = vi.fn()
vi.mock('../lib/r2.js', () => ({
  getInvitadoPresignedUpload: (...args: unknown[]) => getInvitadoPresignedUploadMock(...args),
  deleteR2Object: (...args: unknown[]) => deleteR2ObjectMock(...args),
  getS3ClientForEvento: (...args: unknown[]) => getS3ClientForEventoMock(...args),
  getPresignedReadUrl: (...args: unknown[]) => getPresignedReadUrlMock(...args),
  StorageNoConfiguradoError: class StorageNoConfiguradoError extends Error {},
}))
```

Y en cada test que ya llama a `solicitarSubida(...)` o al `DELETE` de archivo esperando éxito, agregar antes del `await`:

```typescript
getS3ClientForEventoMock.mockResolvedValue({ client: {}, bucket: 'test-bucket' })
```

(el mock de `getInvitadoPresignedUploadMock`/`deleteR2ObjectMock` sigue devolviendo lo mismo que antes — ya no le importa el `clientInfo` que reciben como primer argumento porque son mocks).

- [ ] **Step 2: Extender `queueSelects` para soportar `.orderBy()` como terminal**

El endpoint `mis-archivos` termina su segunda query en `.orderBy(archivos.created_at)`, no en `.limit()` como el resto de las queries ya cubiertas por el `queueSelects` actual de este archivo (que solo resuelve en `.limit()`). En `archivos.routes.test.ts`, extender el helper para que ambos terminales consuman de la misma cola:

```typescript
// reemplazar la función queueSelects existente por:
function queueSelects(...results: unknown[][]) {
  selectQueue.length = 0
  selectQueue.push(...results)
  selectMock.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => selectQueue.shift() ?? [],
        orderBy: async () => selectQueue.shift() ?? [],
      }),
    }),
  }))
}
```

- [ ] **Step 3: Agregar el caso de test para `url` en `mis-archivos`**

```typescript
describe('GET /eventos/:slug/archivos/mis-archivos', () => {
  it('incluye una url firmada por archivo', async () => {
    getS3ClientForEventoMock.mockResolvedValue({ client: {}, bucket: 'test-bucket' })
    getPresignedReadUrlMock.mockResolvedValue('https://signed.example/foo.jpg')
    queueSelects(
      [mockEvento],
      [{ id: 'arch-1', tipo: 'foto', r2_key: 'k', estado: 'aprobada', created_at: new Date() }],
    )

    const router = createArchivosRoutes()
    const res = await router.request(`/eventos/${mockEvento.slug}/archivos/mis-archivos`, {
      headers: { Authorization: await authHeader() },
    })

    const body = await res.json()
    expect(body.archivos[0].url).toBe('https://signed.example/foo.jpg')
  })
})
```

- [ ] **Step 4: Correr los tests y confirmar que fallan**

Run: `cd apps/api && pnpm vitest run src/routes/archivos.routes.test.ts`
Expected: FAIL — `getInvitadoPresignedUpload`/`deleteR2Object` reciben argumentos con la firma vieja, y `mis-archivos` no devuelve `url`.

- [ ] **Step 5: Actualizar `archivos.routes.ts`**

Cambiar el import:

```typescript
import {
  getS3ClientForEvento,
  getInvitadoPresignedUpload,
  deleteR2Object,
  getPresignedReadUrl,
  StorageNoConfiguradoError,
} from '../lib/r2.js'
```

En `POST /eventos/:slug/archivos/solicitar-subida`, reemplazar el bloque final (donde hoy dice `const { uploadUrl, r2Key } = await getInvitadoPresignedUpload(evento.id, invitado_id, ext)`):

```typescript
      try {
        const clientInfo = await getS3ClientForEvento(evento.id)
        const { uploadUrl, r2Key } = await getInvitadoPresignedUpload(
          clientInfo,
          evento.id,
          invitado_id,
          ext,
        )
        logger.info({ invitado_id, tipo, evento_id: evento.id }, 'Presigned URL generada')
        return c.json({ upload_url: uploadUrl, r2_key: r2Key }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'El organizador todavía no configuró su almacenamiento' }, 503)
        }
        throw err
      }
```

En `DELETE /eventos/:slug/archivos/:archivoId`, reemplazar `await deleteR2Object(archivo.r2_key)` por:

```typescript
      const clientInfo = await getS3ClientForEvento(evento.id)
      // Orden crítico: R2 primero. Si falla, no se toca la DB ni el contador.
      await deleteR2Object(clientInfo, archivo.r2_key)
```

En `GET /eventos/:slug/archivos/mis-archivos`, después de traer `rows`, enriquecer con `url` antes del `return`:

```typescript
      if (rows.length === 0) {
        return c.json({ archivos: [] }, 200)
      }

      let clientInfo
      try {
        clientInfo = await getS3ClientForEvento(evento.id)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ archivos: rows.map((r) => ({ ...r, url: null })) }, 200)
        }
        throw err
      }

      const archivosConUrl = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          url: await getPresignedReadUrl(clientInfo, row.r2_key),
        })),
      )

      return c.json({ archivos: archivosConUrl }, 200)
```

- [ ] **Step 6: Correr los tests y confirmar que pasan**

Run: `cd apps/api && pnpm vitest run src/routes/archivos.routes.test.ts`
Expected: PASS (todos los tests existentes + los nuevos)

- [ ] **Step 7: Correr toda la suite de la API una vez más**

Run: `cd apps/api && pnpm test`
Expected: PASS — confirma que Tasks 1-9 no rompieron nada entre sí.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/archivos.routes.ts apps/api/src/routes/archivos.routes.test.ts
git commit -m "$(cat <<'EOF'
refactor(api): archivos.routes usa credenciales R2 por evento y expone url firmada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Cliente HTTP del organizador hacia la API (`apps/web`)

**Files:**
- Create: `apps/web/src/lib/organizador-api-client.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (existente en `apps/web/src/lib/supabase-server.ts`).
- Produces: `organizadorApi` con los métodos `guardarStorageConfig`, `storageConfigStatus`, `solicitarPresignedPortada`, `urlsLectura`, `eliminarArchivosR2`, `eliminarEventoArchivosR2`. `OrganizadorApiError`.

Este módulo es server-only (se usa desde Server Actions y Route Handlers, nunca desde un componente cliente) — no tiene test automatizado, mismo criterio que `apps/web/src/lib/r2.ts` (que reemplaza) no lo tenía.

- [ ] **Step 1: Crear el archivo**

```typescript
// apps/web/src/lib/organizador-api-client.ts
import { createSupabaseServerClient } from '@/lib/supabase-server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class OrganizadorApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'OrganizadorApiError'
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) throw new OrganizadorApiError(401, 'No autenticado')

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json()
    if (body?.error) message = body.error
  } catch {
    /* ignore */
  }
  throw new OrganizadorApiError(res.status, message)
}

export const organizadorApi = {
  async guardarStorageConfig(data: {
    r2_account_id: string
    r2_access_key_id: string
    r2_secret_access_key: string
    r2_bucket_name: string
  }): Promise<{ success: true }> {
    const res = await fetch(`${API_URL}/organizador/storage-config`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  async storageConfigStatus(): Promise<
    { configurado: false } | { configurado: true; bucket: string; terminaEn: string }
  > {
    const res = await fetch(`${API_URL}/organizador/storage-config/status`, {
      headers: await authHeaders(),
    })
    return handleResponse(res)
  },

  async solicitarPresignedPortada(
    eventoId: string,
    extension: string,
  ): Promise<{ uploadUrl: string; r2Key: string }> {
    const res = await fetch(
      `${API_URL}/organizador/eventos/${eventoId}/portada/solicitar-subida`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ extension }),
      },
    )
    return handleResponse(res)
  },

  async urlsLectura(archivoIds: string[]): Promise<{ urls: Record<string, string> }> {
    if (archivoIds.length === 0) return { urls: {} }
    const res = await fetch(`${API_URL}/organizador/archivos/urls-lectura`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ archivo_ids: archivoIds }),
    })
    return handleResponse(res)
  },

  async eliminarArchivosR2(archivoIds: string[]): Promise<{ success: true }> {
    if (archivoIds.length === 0) return { success: true }
    const res = await fetch(`${API_URL}/organizador/archivos`, {
      method: 'DELETE',
      headers: await authHeaders(),
      body: JSON.stringify({ archivo_ids: archivoIds }),
    })
    return handleResponse(res)
  },

  async eliminarEventoArchivosR2(eventoId: string): Promise<{ success: true }> {
    const res = await fetch(`${API_URL}/organizador/eventos/${eventoId}/archivos-r2`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    return handleResponse(res)
  },
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/web && pnpm build`
Expected: puede seguir fallando por los call sites que todavía no se actualizaron (Tasks 11-16) — confirmar que el error, si lo hay, no está en este archivo nuevo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/organizador-api-client.ts
git commit -m "$(cat <<'EOF'
feat(web): cliente HTTP server-side del organizador hacia la API de R2

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Pantalla de configuración de storage + gate en el middleware

**Files:**
- Create: `apps/web/src/app/(organizador)/configuracion/storage/page.tsx`
- Create: `apps/web/src/app/(organizador)/configuracion/storage/StorageConfigForm.tsx`
- Create: `apps/web/src/app/(organizador)/configuracion/storage/actions.ts`
- Modify: `apps/web/src/middleware.ts`

**Interfaces:**
- Consumes: `organizadorApi.guardarStorageConfig`/`storageConfigStatus` (Task 10).

- [ ] **Step 1: Server Actions de la pantalla**

```typescript
// apps/web/src/app/(organizador)/configuracion/storage/actions.ts
'use server'

import { organizadorApi, OrganizadorApiError } from '@/lib/organizador-api-client'

export async function guardarStorageConfig(data: {
  r2_account_id: string
  r2_access_key_id: string
  r2_secret_access_key: string
  r2_bucket_name: string
}): Promise<{ success: true } | { error: string }> {
  try {
    return await organizadorApi.guardarStorageConfig(data)
  } catch (err) {
    if (err instanceof OrganizadorApiError) return { error: err.message }
    console.error('[guardarStorageConfig]', err)
    return { error: 'No se pudo guardar la configuración' }
  }
}

export async function obtenerStorageConfigStatus(): Promise<
  { configurado: false } | { configurado: true; bucket: string; terminaEn: string }
> {
  try {
    return await organizadorApi.storageConfigStatus()
  } catch {
    return { configurado: false }
  }
}
```

- [ ] **Step 2: Página (Server Component)**

```tsx
// apps/web/src/app/(organizador)/configuracion/storage/page.tsx
import { obtenerStorageConfigStatus } from './actions'
import { StorageConfigForm } from './StorageConfigForm'

export default async function ConfiguracionStoragePage() {
  const status = await obtenerStorageConfigStatus()

  return (
    <div className="ctx-organizador flex min-h-screen items-center justify-center bg-backdrop px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Configurá tu almacenamiento
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Album guarda las fotos y videos de tus invitados en tu propia cuenta de Cloudflare
          R2 — nunca en la nuestra. Necesitamos las credenciales de tu bucket antes de que
          puedas crear o administrar eventos.
        </p>
        <div className="mt-8">
          <StorageConfigForm status={status} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Formulario (Client Component)**

```tsx
// apps/web/src/app/(organizador)/configuracion/storage/StorageConfigForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { guardarStorageConfig } from './actions'

const schema = z.object({
  r2_account_id: z.string().min(1, 'Obligatorio'),
  r2_access_key_id: z.string().min(1, 'Obligatorio'),
  r2_secret_access_key: z.string().min(1, 'Obligatorio'),
  r2_bucket_name: z.string().min(1, 'Obligatorio'),
})

type Values = z.infer<typeof schema>

type Status =
  | { configurado: false }
  | { configurado: true; bucket: string; terminaEn: string }

interface Props {
  status: Status
}

export function StorageConfigForm({ status }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [editing, setEditing] = useState(!status.configurado)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      r2_account_id: '',
      r2_access_key_id: '',
      r2_secret_access_key: '',
      r2_bucket_name: '',
    },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    const result = await guardarStorageConfig(values)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    router.push('/eventos')
    router.refresh()
  }

  if (status.configurado && !editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Configurado — bucket &quot;{status.bucket}&quot;
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Access key terminada en …{status.terminaEn}
            </p>
          </div>
        </div>
        <Button variant="outline" className="h-11 w-full" onClick={() => setEditing(true)}>
          Cambiar credenciales
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="r2_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Account ID
              </FormLabel>
              <FormControl>
                <Input placeholder="Account ID de Cloudflare" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="r2_access_key_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Access Key ID
              </FormLabel>
              <FormControl>
                <Input placeholder="Access Key ID" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="r2_secret_access_key"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Secret Access Key
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="Secret Access Key" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="r2_bucket_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Nombre del bucket
              </FormLabel>
              <FormControl>
                <Input placeholder="mi-bucket" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button
          type="submit"
          className="h-11 w-full gap-2 text-sm font-semibold uppercase tracking-widest"
          disabled={form.formState.isSubmitting}
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {form.formState.isSubmitting ? 'Verificando…' : 'Guardar y verificar'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Gate en el middleware**

En `apps/web/src/middleware.ts`, agregar `/configuracion` a las rutas protegidas por sesión, y agregar el chequeo de storage config para `/eventos`:

```typescript
// reemplazar la línea:
// const PROTECTED_PREFIXES = ['/eventos']
// por:
const PROTECTED_PREFIXES = ['/eventos', '/configuracion']

// las rutas que exigen tener el storage configurado (no incluye /configuracion,
// para no generar un loop de redirección hacia sí misma)
const REQUIERE_STORAGE_PREFIXES = ['/eventos']
```

Y después del bloque que ya redirige a `/login` si no hay `user`, agregar:

```typescript
  if (user && REQUIERE_STORAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const { data: storageConfig } = await supabase
      .from('organizador_storage_config')
      .select('id')
      .eq('organizador_id', user.id)
      .not('verificado_at', 'is', null)
      .maybeSingle()

    if (!storageConfig) {
      const url = request.nextUrl.clone()
      url.pathname = '/configuracion/storage'
      return NextResponse.redirect(url)
    }
  }
```

- [ ] **Step 5: Verificar manualmente en el browser**

1. Levantar `pnpm dev` en la raíz del monorepo.
2. Registrar una cuenta de organizador nueva → login.
3. Confirmar que redirige a `/configuracion/storage` en vez de a `/eventos`.
4. Probar con credenciales de R2 inválidas (Account ID inventado) → confirmar que se ve el mensaje de error real, sin redirigir.
5. Probar con credenciales de R2 reales de un bucket de prueba → confirmar que redirige a `/eventos`.
6. Entrar de nuevo a `/configuracion/storage` manualmente → confirmar que muestra "Configurado ✓" con el botón "Cambiar credenciales".

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(organizador\)/configuracion apps/web/src/middleware.ts
git commit -m "$(cat <<'EOF'
feat(web): pantalla de configuración de R2 y gate antes de /eventos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Portada del wizard usa el nuevo endpoint

**Files:**
- Modify: `apps/web/src/app/(organizador)/eventos/nuevo/actions.ts`

**Interfaces:**
- Consumes: `organizadorApi.solicitarPresignedPortada` (Task 10).
- No cambia la firma consumida por `Paso2FotoPortada.tsx` — ese componente queda intacto.

- [ ] **Step 1: Reemplazar la implementación**

```typescript
// apps/web/src/app/(organizador)/eventos/nuevo/actions.ts
'use server'

import { organizadorApi } from '@/lib/organizador-api-client'

export async function solicitarPresignedPortada(
  eventoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  return organizadorApi.solicitarPresignedPortada(eventoId, extension)
}
```

- [ ] **Step 2: Verificar manualmente en el browser**

Crear un evento nuevo de punta a punta hasta el paso 2 (portada) → subir una imagen real → confirmar que sube sin error y avanza al paso 3.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(organizador)/eventos/nuevo/actions.ts"
git commit -m "$(cat <<'EOF'
refactor(web): presign de portada del wizard vía la API en vez de R2 directo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `eventos.actions.ts` — borrado de evento vía API

**Files:**
- Modify: `apps/web/src/app/(organizador)/actions/eventos.actions.ts`

**Interfaces:**
- Consumes: `organizadorApi.eliminarEventoArchivosR2` (Task 10).

- [ ] **Step 1: Reemplazar el import y la función `eliminarEvento`**

Cambiar:

```typescript
import { deleteR2Object } from '@/lib/r2'
```

por:

```typescript
import { organizadorApi } from '@/lib/organizador-api-client'
```

Y reemplazar el cuerpo de `eliminarEvento`:

```typescript
export async function eliminarEvento(
  eventoId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const organizadorId = await getOrganizadorId()

    const [evento] = await db
      .select({ id: eventos.id })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))

    if (!evento) return { error: 'Evento no encontrado' }

    // Orden crítico: R2 primero. Si falla, no se toca la DB.
    await organizadorApi.eliminarEventoArchivosR2(eventoId)

    // Orden por FKs: archivos -> invitados -> eventos.
    await db.delete(archivos).where(eq(archivos.evento_id, eventoId))
    await db.delete(invitados).where(eq(invitados.evento_id, eventoId))
    await db.delete(eventos).where(eq(eventos.id, eventoId))

    revalidatePath('/eventos', 'page')
    return { success: true }
  } catch (err) {
    console.error('[eliminarEvento]', err)
    return { error: 'No se pudo eliminar el evento' }
  }
}
```

- [ ] **Step 2: Verificar manualmente en el browser**

Crear un evento de prueba con portada + al menos un archivo subido por un invitado de prueba → eliminarlo desde el panel → confirmar que desaparece de "Mis eventos" y que los objetos ya no están en el bucket del organizador (revisar el bucket en el dashboard de Cloudflare, o confirmar que un `GET` posterior a la URL firmada vieja da error).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(organizador)/actions/eventos.actions.ts"
git commit -m "$(cat <<'EOF'
refactor(web): borrado de evento delega el borrado de R2 a la API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `archivos.actions.ts` — borrado y `url` en galería

**Files:**
- Modify: `apps/web/src/app/(organizador)/actions/archivos.actions.ts`

**Interfaces:**
- Consumes: `organizadorApi.eliminarArchivosR2`/`urlsLectura` (Task 10).
- Produces: `ArchivoConInvitado` gana el campo `url: string`. `listarArchivos` y `obtenerArchivoDetalle` lo completan.

- [ ] **Step 1: Actualizar imports y el tipo `ArchivoConInvitado`**

Cambiar:

```typescript
import { deleteR2Object } from '@/lib/r2'
```

por:

```typescript
import { organizadorApi } from '@/lib/organizador-api-client'
```

Y agregar `url: string` a la interfaz:

```typescript
export interface ArchivoConInvitado {
  id: string
  tipo: string
  r2_key: string
  thumbnail_key: string | null
  estado: string
  created_at: Date | null
  invitado_id: string
  invitado_nombre: string
  invitado_apellido: string
  url: string
}
```

- [ ] **Step 2: Actualizar `eliminarArchivo`**

Reemplazar `await deleteR2Object(archivo.r2_key)` por:

```typescript
    // Orden crítico: R2 primero. Si falla, no se toca la DB ni el contador.
    await organizadorApi.eliminarArchivosR2([archivoId])
```

- [ ] **Step 3: Actualizar `obtenerArchivoDetalle` para incluir `url`**

Después de obtener `row` (y confirmar que no es `null`), antes del cálculo de `siblings`:

```typescript
    const { urls } = await organizadorApi.urlsLectura([row.id])
```

Y en el `return`, cambiar `archivo: row` por `archivo: { ...row, url: urls[row.id] ?? '' }`.

- [ ] **Step 4: Actualizar `listarArchivos` para incluir `url`**

Después de obtener `rows` (antes del `return rows`):

```typescript
  if (rows.length === 0) return []

  const { urls } = await organizadorApi.urlsLectura(rows.map((r) => r.id))

  return rows.map((row) => ({ ...row, url: urls[row.id] ?? '' }))
```

(reemplaza el `return rows` final de la función).

- [ ] **Step 5: Verificar manualmente en el browser**

Entrar a la galería de un evento con archivos reales → confirmar que las miniaturas cargan (ya no dependen de `NEXT_PUBLIC_R2_PUBLIC_URL`) → eliminar una → confirmar que desaparece de la grilla y del bucket.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(organizador)/actions/archivos.actions.ts"
git commit -m "$(cat <<'EOF'
refactor(web): archivos.actions usa URLs firmadas de la API y borra vía R2 del organizador

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: `invitados.actions.ts` — borrado en batch

**Files:**
- Modify: `apps/web/src/app/(organizador)/actions/invitados.actions.ts`

**Interfaces:**
- Consumes: `organizadorApi.eliminarArchivosR2` (Task 10).

- [ ] **Step 1: Reemplazar import y la selección de archivos del invitado**

Cambiar:

```typescript
import { deleteR2Object } from '@/lib/r2'
```

por:

```typescript
import { organizadorApi } from '@/lib/organizador-api-client'
```

En `eliminarInvitado`, cambiar la selección (hoy trae solo `r2_key`) para traer `id`:

```typescript
    const archivosDelInvitado = await db
      .select({ id: archivos.id })
      .from(archivos)
      .where(eq(archivos.invitado_id, invitadoId))

    // Orden crítico: R2 primero. Si falla, no se toca la DB — mismo
    // criterio que eliminarArchivo en archivos.actions.ts.
    await organizadorApi.eliminarArchivosR2(archivosDelInvitado.map((a) => a.id))
```

(reemplaza el `for` loop existente que llamaba a `deleteR2Object` por archivo).

- [ ] **Step 2: Verificar manualmente en el browser**

En la lista de invitados de un evento de prueba, eliminar un invitado que tenga fotos subidas → confirmar que desaparece de la lista y sus archivos ya no están en el bucket.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(organizador)/actions/invitados.actions.ts"
git commit -m "$(cat <<'EOF'
refactor(web): borrado de invitado delega el borrado de R2 a la API en batch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Componentes de galería consumen `archivo.url`

**Files:**
- Modify: `apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx`
- Modify: `apps/web/src/app/(organizador)/eventos/[id]/galeria/[archivoId]/DetalleClient.tsx`
- Modify: `apps/web/src/app/(organizador)/eventos/[id]/galeria/_components/ReproduccionModal.tsx`

**Interfaces:**
- Consumes: `ArchivoConInvitado.url` (Task 14) — ya viene resuelto desde el Server Component (`page.tsx` de cada ruta, sin cambios necesarios ahí porque llaman a `listarArchivos`/`obtenerArchivoDetalle`, que ya devuelven `url`).

- [ ] **Step 1: `GaleriaClient.tsx`**

Eliminar la línea `const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL` y reemplazar:

```tsx
src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
```

por:

```tsx
src={archivo.url}
```

- [ ] **Step 2: `DetalleClient.tsx`**

Eliminar la línea `const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL` y reemplazar las dos apariciones (`<video src={...}>` y `<Image src={...}>`) de:

```tsx
`${R2_PUBLIC_URL}/${archivo.r2_key}`
```

por:

```tsx
archivo.url
```

- [ ] **Step 3: `ReproduccionModal.tsx`**

Eliminar la línea `const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL` y reemplazar las dos apariciones de:

```tsx
`${R2_PUBLIC_URL}/${archivo.r2_key}`
```

por:

```tsx
archivo.url
```

- [ ] **Step 4: Verificar manualmente en el browser**

Abrir la galería → ver miniaturas → abrir el detalle de un archivo (Prev/Next) → abrir "Reproducir" con varios archivos aprobados → confirmar que fotos y videos cargan en las tres vistas.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(organizador)/eventos/[id]/galeria"
git commit -m "$(cat <<'EOF'
refactor(web): galería, detalle y reproductor usan URLs firmadas en vez de URL pública fija

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Landing pública usa `portada-url`

**Files:**
- Modify: `apps/web/src/app/e/[slug]/page.tsx`

**Interfaces:**
- Consumes: `GET /eventos/:slug/portada-url` (Task 8), vía `fetch` directo (Server Component, no hay sesión de organizador acá — endpoint público).

- [ ] **Step 1: Reemplazar la construcción de `portadaUrl`**

Cambiar:

```typescript
  const portadaUrl = evento.foto_portada_url
    ? `${process.env.R2_PUBLIC_URL}/${evento.foto_portada_url}`
    : null

  if (evento.estado !== 'activo') {
```

por:

```typescript
  if (evento.estado !== 'activo') {
```

(se mueve el cálculo de `portadaUrl` a después del chequeo de `estado`, para no pedirle una URL a la API de un evento inactivo):

Y, ya dentro del `return` principal (después del bloque `if (evento.estado !== 'activo') { ... }`), antes del `return (`:

```typescript
  let portadaUrl: string | null = null
  if (evento.foto_portada_url) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/eventos/${slug}/portada-url`, { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { url: string }
        portadaUrl = data.url
      }
    } catch {
      portadaUrl = null
    }
  }
```

- [ ] **Step 2: Verificar manualmente en el browser**

Visitar `/e/<slug-de-un-evento-activo-con-portada>` sin sesión (ventana incógnito) → confirmar que la portada carga. Visitar un evento sin portada → confirmar que se ve el degradé de fallback, sin error en consola.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/e/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
refactor(web): landing pública pide la portada a la API en vez de una URL pública fija

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: `SubirClient.tsx` (invitado) usa `url` de `mis-archivos`

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/app/e/[slug]/subir/SubirClient.tsx`

**Interfaces:**
- Consumes: `GET /eventos/:slug/archivos/mis-archivos` con `url` por fila (Task 9).

- [ ] **Step 1: Actualizar el tipo de retorno de `misArchivos` en `api-client.ts`**

```typescript
    async misArchivos(): Promise<{
      archivos: Array<{
        id: string
        tipo: 'foto' | 'video'
        r2_key: string
        estado: string
        created_at: string | null
        url: string | null
      }>
    }> {
      const res = await fetch(`${API_URL}/eventos/${slug}/archivos/mis-archivos`, {
        headers: authHeaders(),
      })
      return handleResponse(res)
    },
```

- [ ] **Step 2: Usar `row.url` en `SubirClient.tsx`**

En el `.then(({ archivos: rows }) => ...)` del `useEffect` que carga `misArchivos()`, cambiar `previewUrl: null` por `previewUrl: row.url`.

Eliminar la línea `const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL` y, en el `<Image src={...}>` que hoy hace `item.previewUrl ?? \`${R2_PUBLIC_URL}/${item.r2Key}\``, dejar simplemente:

```tsx
src={item.previewUrl ?? ''}
```

(el fallback a `R2_PUBLIC_URL` deja de tener sentido — si `previewUrl` es `null` es porque el storage del organizador todavía no está configurado, mismo caso borde ya cubierto en el backend con `url: null`).

- [ ] **Step 3: Verificar manualmente en el browser**

Como invitado (flujo `/e/<slug>/registro` → `/e/<slug>/subir`), subir una foto → recargar la página → confirmar que "Tus recuerdos" sigue mostrando la miniatura después del reload.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api-client.ts "apps/web/src/app/e/[slug]/subir/SubirClient.tsx"
git commit -m "$(cat <<'EOF'
refactor(web): vista del invitado usa la url firmada que devuelve mis-archivos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: ZIP de descarga usa URLs firmadas en batch

**Files:**
- Modify: `apps/web/src/app/api/eventos/[id]/galeria/descargar-zip/route.ts`

**Interfaces:**
- Consumes: `organizadorApi.urlsLectura` (Task 10).

- [ ] **Step 1: Actualizar la query y el loop de descarga**

Cambiar el import:

```typescript
import { organizadorApi } from '@/lib/organizador-api-client'
```

(eliminar `import { getR2PublicUrl } from '@/lib/r2'`).

Agregar `id: archivos.id` a la selección de `rows`:

```typescript
    const rows = await db
      .select({
        id: archivos.id,
        r2_key: archivos.r2_key,
        tipo: archivos.tipo,
        created_at: archivos.created_at,
        invitado_nombre: invitados.nombre,
        invitado_apellido: invitados.apellido,
      })
      .from(archivos)
      .innerJoin(invitados, eq(archivos.invitado_id, invitados.id))
      .where(and(eq(archivos.evento_id, eventoId), eq(archivos.estado, 'aprobada')))
      .orderBy(archivos.created_at)
```

Reemplazar el loop de descarga:

```typescript
    const { urls } = await organizadorApi.urlsLectura(rows.map((r) => r.id))

    const zip = new JSZip()

    for (const row of rows) {
      try {
        const url = urls[row.id]
        if (!url) {
          console.warn(`Sin URL firmada para ${row.r2_key}`)
          continue
        }

        const response = await fetch(url)

        if (!response.ok) {
          console.warn(`Failed to download ${row.r2_key}: ${response.statusText}`)
          continue
        }

        const buffer = await response.arrayBuffer()

        const folder = `${row.invitado_nombre}_${row.invitado_apellido}`
        const filename = row.r2_key.split('/').pop() || 'archivo'
        const filepath = `${folder}/${filename}`

        zip.file(filepath, buffer)
      } catch (err) {
        console.error(`Error downloading ${row.r2_key}:`, err)
      }
    }
```

- [ ] **Step 2: Verificar manualmente en el browser**

Desde la galería de un evento con al menos un archivo aprobado, tocar "Descargar" → confirmar que el ZIP descarga y contiene el/los archivo(s) reales.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/api/eventos/[id]/galeria/descargar-zip/route.ts"
git commit -m "$(cat <<'EOF'
refactor(web): ZIP de descarga usa URLs firmadas en batch en vez de URL pública

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Borrar `apps/web/src/lib/r2.ts` y confirmar que no queda ninguna referencia

**Files:**
- Delete: `apps/web/src/lib/r2.ts`

**Interfaces:**
- No produce ni consume nada — es el paso final que confirma que las Tasks 10-19 dejaron de necesitar este archivo.

- [ ] **Step 1: Buscar referencias restantes**

Run: `cd apps/web && grep -rn "from '@/lib/r2'" src/`
Expected: sin resultados. Si aparece alguno, falta actualizar ese archivo — no continuar hasta que la búsqueda esté vacía.

- [ ] **Step 2: Borrar el archivo**

```bash
git rm apps/web/src/lib/r2.ts
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/web && pnpm build`
Expected: PASS, sin errores de módulo faltante.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(web): eliminar lib/r2.ts — todo el acceso a R2 pasa por la API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Verificación de punta a punta y aviso a la organizadora de producción

**Files:** ninguno — tarea de verificación manual, sin cambios de código.

- [ ] **Step 1: Suite completa de tests**

Run: `pnpm -w test` (o `cd apps/api && pnpm test` si el monorepo no tiene un script raíz que corra ambos)
Expected: PASS en `apps/api` (no hay suite en `apps/web`).

- [ ] **Step 2: Flujo completo en local**

1. Organizador nuevo se registra → cae en `/configuracion/storage` → configura credenciales de un bucket de R2 de prueba real → llega a `/eventos` vacío.
2. Wizard completo: nombre/fecha → portada real → límites → confirmar → QR generado.
3. Como invitado (otra pestaña/incógnito): escanear el link del QR → landing con portada real → registrarse → subir una foto y un video reales → ver el contador actualizado.
4. Como organizador: entrar a la galería → ver las miniaturas reales → abrir detalle → aprobar → reproducir → descargar ZIP → eliminar el archivo → confirmar que desaparece de la grilla y del bucket.
5. Eliminar el evento completo → confirmar que el prefijo `eventos/<id>/` quedó vacío en el bucket.

- [ ] **Step 3: Deploy y variables de entorno nuevas**

Antes de deployar, confirmar con el usuario que están seteadas en Railway (`apps/api`):
- `CREDENTIALS_ENCRYPTION_KEY` (generar una vez con `openssl rand -base64 32`, nunca reusar la de otro entorno)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Y correr la migración de la Task 2 contra la base de producción (`pnpm db:migrate` con el `DATABASE_URL` de producción) — **pedir confirmación explícita antes de este paso**, y aplicar la política RLS de la Task 2 Step 4 a mano en el SQL Editor de Supabase.

- [ ] **Step 4: Avisar a la organizadora de "Los 15 de Valentina"**

Sin excepciones de grandfathering (decisión de la spec) — en su próximo login va a caer en `/configuracion/storage`. Avisarle antes del deploy para que tenga a mano sus propias credenciales de Cloudflare R2 (o coordinar con ella la creación de un bucket).
