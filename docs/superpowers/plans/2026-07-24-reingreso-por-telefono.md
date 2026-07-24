# Reingreso de invitado por teléfono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un invitado que ya se registró en un evento puede volver a entrar (nuevo dispositivo, localStorage borrado, etc.) escribiendo su número de teléfono, sin contraseña, en vez de tener que registrarse de nuevo.

**Architecture:** Endpoint nuevo `POST /eventos/:slug/invitados/reingresar` en el mismo router de `eventos.routes.ts` que ya expone el registro, reutilizando `signInvitadoToken`. El matching es por teléfono normalizado (solo dígitos) dentro del mismo `evento_id`, sin cambios de schema. El registro existente gana una validación de teléfono-duplicado antes del insert. Frontend: pantalla nueva `/e/[slug]/reingresar`, link nuevo en `/e/[slug]/registro`, y un fix al manejo de errores 409 que hoy ignora el body de la respuesta.

**Tech Stack:** Hono + Zod + Drizzle (API, Railway), Next.js App Router + react-hook-form + zod (web, Vercel), Vitest para tests de API.

## Global Constraints

- Sin migraciones de schema — `invitados.telefono` sigue siendo `text` nullable en `packages/database/src/schema.ts`. La obligatoriedad se aplica solo vía Zod (spec sección 2).
- Sin índice único ni columna nueva para la unicidad de teléfono — chequeo "buscar antes de insertar" en JS, mismo patrón que el chequeo de cupo existente (spec sección 3).
- El reingreso usa la misma `registroRateLimitMiddleware` que ya protege el registro (spec sección 4).
- El país en la pantalla de reingreso es cosmético (placeholder), no se envía al backend (spec sección 5).
- Repo real en `album_monorepo/`, rama `main`. Commits sí, `git push` solo con autorización explícita del usuario (fuera del alcance de este plan — el usuario decide cuándo pushear).

---

### Task 1: `normalizarTelefono` — función compartida de normalización

**Files:**
- Create: `apps/api/src/lib/telefono.ts`
- Test: `apps/api/src/lib/telefono.test.ts`

**Interfaces:**
- Produces: `normalizarTelefono(telefono: string): string` — saca todo carácter que no sea dígito (`0-9`). Usada por Task 2 (registro) y Task 3 (reingreso).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/lib/telefono.test.ts
import { describe, it, expect } from 'vitest'
import { normalizarTelefono } from './telefono.js'

describe('normalizarTelefono', () => {
  it('quita espacios', () => {
    expect(normalizarTelefono('099 123 456')).toBe('099123456')
  })

  it('quita guiones y paréntesis', () => {
    expect(normalizarTelefono('(099) 123-456')).toBe('099123456')
  })

  it('quita el signo +', () => {
    expect(normalizarTelefono('+598 99 123 456')).toBe('59899123456')
  })

  it('deja un string de solo dígitos sin cambios', () => {
    expect(normalizarTelefono('59899123456')).toBe('59899123456')
  })

  it('devuelve string vacío para un input sin dígitos', () => {
    expect(normalizarTelefono('---')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/lib/telefono.test.ts`
Expected: FAIL — `Cannot find module './telefono.js'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/api/src/lib/telefono.ts
export function normalizarTelefono(telefono: string): string {
  return telefono.replace(/\D/g, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/lib/telefono.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/telefono.ts apps/api/src/lib/telefono.test.ts
git commit -m "feat(api): agrega normalizarTelefono para matching de reingreso"
```

---

### Task 2: Registro rechaza teléfono duplicado y exige teléfono

**Files:**
- Modify: `apps/api/src/routes/eventos.routes.ts`
- Test: `apps/api/src/routes/eventos.routes.test.ts`

**Interfaces:**
- Consumes: `normalizarTelefono` de Task 1 (`../lib/telefono.js`).
- Produces: ningún símbolo nuevo exportado — cambia el comportamiento del handler existente `POST /eventos/:slug/invitados`.

**Contexto para quien implemente:** hoy `registroSchema.telefono` es `z.string().max(30).optional()` y el handler nunca chequea si el teléfono ya existe en el evento. El test existente `eventos.routes.test.ts` tiene un helper `validBody()` que hoy **no** incluye `telefono` — como pasa a ser obligatorio, ese helper necesita un default, y el test `'accepts registration without telefono (optional field)'` se invierte a esperar 400.

- [ ] **Step 1: Write the failing tests**

En `apps/api/src/routes/eventos.routes.test.ts`, reemplazar el helper `validBody` (líneas 68-75) por:

```typescript
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    nombre: 'Ana',
    apellido: 'García',
    telefono: '099 123 456',
    acepto_terminos: true,
    ...overrides,
  }
}
```

Reemplazar el test `'accepts registration without telefono (optional field)'` (líneas 200-206) por:

```typescript
it('returns 400 when telefono is missing', async () => {
  const res = await postInvitado(
    'boda-test-abc123',
    { nombre: 'Ana', apellido: 'García', acepto_terminos: true },
  )

  expect(res.status).toBe(400)
  expect(insertMock).not.toHaveBeenCalled()
})
```

Y agregar, al final del `describe('POST /eventos/:slug/invitados', ...)` bloque, antes del cierre `})` en la línea 247:

```typescript
it('returns 409 when telefono already exists in the same evento (normalized match)', async () => {
  // select order: evento, cupo count, invitados-por-telefono lookup
  queueSelects(
    [mockEvento],
    [{ value: 0 }],
    [{ id: 'inv-existente', telefono: '099-123-456' }],
  )

  const res = await postInvitado(
    'boda-test-abc123',
    validBody({ telefono: '099 123 456' }),
  )
  const body = await res.json()

  expect(res.status).toBe(409)
  expect(body).toEqual({
    error:
      "Ese teléfono ya está registrado en este evento. Si ya te registraste, usá 'Entrá con tu teléfono' en la pantalla anterior.",
  })
  expect(insertMock).not.toHaveBeenCalled()
})

it('allows the same telefono to register in a different evento', async () => {
  queueSelects([mockEvento], [{ value: 0 }], [])

  const res = await postInvitado('boda-test-abc123', validBody({ telefono: '099 123 456' }))

  expect(res.status).toBe(201)
})
```

Además, el handler pasa a hacer **3** queries `select` por request exitoso (evento, cupo, chequeo de teléfono) en vez de 2. El test ya existente `'is rate limited via registroRateLimitMiddleware after repeated requests from the same IP'` (líneas 227-246) prepara la cola asumiendo 2 por request — hay que actualizarlo o los requests posteriores al primero leen datos de otro request y corrompen el resto de la ejecución (aunque el test igual "pasaría" por accidente, porque solo valida el último status). Reemplazar esa única línea:

```typescript
queueSelects(...Array.from({ length: 11 }, () => [mockEvento]).flatMap((e) => [e, [{ value: 0 }]]))
```

por:

```typescript
queueSelects(...Array.from({ length: 11 }, () => [[mockEvento], [{ value: 0 }], []]).flat())
```

(el tercer elemento `[]` de cada tripleta es la respuesta vacía del chequeo de teléfono duplicado — "nadie más tiene este teléfono", así cada uno de los primeros 10 requests sigue llegando a 201 antes de que el 11º choque con el rate limit).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/routes/eventos.routes.test.ts`
Expected: FAIL — el test de teléfono-obligatorio pasa igual (ya era 400 por otras razones no), pero el de "409 duplicado" falla porque hoy no hay tercera query ni chequeo; y varios otros tests que dependían de `validBody()` sin romperse deberían seguir en verde salvo el que se invirtió.

- [ ] **Step 3: Implement**

En `apps/api/src/routes/eventos.routes.ts`, cambiar el import (agregar `normalizarTelefono`):

```typescript
import { normalizarTelefono } from '../lib/telefono.js'
```

Cambiar `registroSchema`:

```typescript
const registroSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  telefono: z.string().min(1, 'El teléfono es obligatorio').max(30),
  acepto_terminos: z.literal(true, {
    errorMap: () => ({ message: 'Debés aceptar los Términos y Condiciones' }),
  }),
})
```

Insertar, justo después del bloque de chequeo de cupo (después del `if (currentCount >= evento.limite_invitados_login) { ... }` y antes del comentario `// 3. Insert invitado...`):

```typescript
      // 2.5. Reject a phone number already used by another invitado in this
      // same evento — same "check before insert" shape as the cupo check
      // above. Comparison is on the normalized (digits-only) form so
      // formatting differences ("099 123-456" vs "0991233456") still match.
      const telefonoNormalizado = normalizarTelefono(body.telefono)
      const existentesConTelefono = await db
        .select({ id: invitados.id, telefono: invitados.telefono })
        .from(invitados)
        .where(eq(invitados.evento_id, evento.id))

      const yaRegistrado = existentesConTelefono.some(
        (inv) => inv.telefono && normalizarTelefono(inv.telefono) === telefonoNormalizado,
      )

      if (yaRegistrado) {
        console.log('[POST /eventos/:slug/invitados] teléfono duplicado', { evento_id: evento.id })
        return c.json(
          {
            error:
              "Ese teléfono ya está registrado en este evento. Si ya te registraste, usá 'Entrá con tu teléfono' en la pantalla anterior.",
          },
          409,
        )
      }
```

Y en el insert (paso 3 existente), cambiar `telefono: body.telefono ?? null,` por `telefono: body.telefono,` (ya no puede ser undefined, Zod lo garantiza).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/routes/eventos.routes.test.ts`
Expected: PASS, todos los tests del archivo (los preexistentes + los 3 nuevos/modificados).

- [ ] **Step 5: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/eventos.routes.ts apps/api/src/routes/eventos.routes.test.ts
git commit -m "feat(api): teléfono obligatorio y único por evento al registrarse"
```

---

### Task 3: Endpoint `POST /eventos/:slug/invitados/reingresar`

**Files:**
- Modify: `apps/api/src/routes/eventos.routes.ts`
- Test: `apps/api/src/routes/eventos.routes.test.ts`

**Interfaces:**
- Consumes: `normalizarTelefono` (Task 1), `signInvitadoToken` (ya existe en `../lib/jwt.js`), `registroRateLimitMiddleware` (ya existe).
- Produces: ruta `POST /eventos/:slug/invitados/reingresar` — response 200 `{ token: string, invitado_id: string }` o 404 `{ error: string }`. Consumida por Task 5 (frontend `api-client.ts`).

- [ ] **Step 1: Write the failing tests**

Agregar, al final de `apps/api/src/routes/eventos.routes.test.ts` (después del `describe('POST /eventos/:slug/invitados', ...)` que cierra en la línea ~250, como un nuevo `describe` hermano):

```typescript
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
    queueSelects(
      [mockEvento],
      [{ id: 'inv-existente', evento_id: 'evt-1', telefono: '099-123-456' }],
    )

    const res = await postReingreso('boda-test-abc123', { telefono: '099 123 456' })
    const body = (await res.json()) as { token: string; invitado_id: string }

    expect(res.status).toBe(200)
    expect(body.invitado_id).toBe('inv-existente')
    expect(typeof body.token).toBe('string')
    expect(body.token.split('.')).toHaveLength(3)
  })

  it('matches regardless of phone formatting differences', async () => {
    queueSelects(
      [mockEvento],
      [{ id: 'inv-existente', evento_id: 'evt-1', telefono: '(099) 123-456' }],
    )

    const res = await postReingreso('boda-test-abc123', { telefono: '0991 23456' })

    expect(res.status).toBe(200)
  })

  it('returns 404 when no invitado in this evento has that telefono', async () => {
    queueSelects([mockEvento], [{ id: 'otro', evento_id: 'evt-1', telefono: '000-000-000' }])

    const res = await postReingreso('boda-test-abc123', { telefono: '099 123 456' })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({
      error: 'No encontramos ese teléfono registrado en este evento. ¿Ya te registraste? Probá el formulario de registro.',
    })
  })

  it('returns 404 when evento does not exist for the slug', async () => {
    queueSelects([])

    const res = await postReingreso('no-existe', { telefono: '099 123 456' })

    expect(res.status).toBe(404)
  })

  it('returns 400 when telefono is missing from the body', async () => {
    const res = await postReingreso('boda-test-abc123', {})

    expect(res.status).toBe(400)
  })

  it('is rate limited via registroRateLimitMiddleware after repeated requests from the same IP', async () => {
    queueSelects(...Array.from({ length: 11 }, () => [[mockEvento], []]).flat())

    const router = createEventosRoutes()
    let lastStatus = 0
    for (let i = 0; i < 11; i++) {
      const res = await router.request('/eventos/boda-test-abc123/invitados/reingresar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '9.9.9.8' },
        body: JSON.stringify({ telefono: '099 123 456' }),
      })
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/routes/eventos.routes.test.ts`
Expected: FAIL — la ruta `/reingresar` no existe todavía (404 genérico de Hono en vez de los status esperados).

- [ ] **Step 3: Implement**

En `apps/api/src/routes/eventos.routes.ts`, agregar después del cierre del `router.post('/eventos/:slug/invitados', ...)` existente (antes del `return router`):

```typescript
  router.post(
    '/eventos/:slug/invitados/reingresar',
    registroRateLimitMiddleware,
    zValidator('json', z.object({ telefono: z.string().min(1) })),
    async (c) => {
      const { slug } = c.req.param()
      const { telefono } = c.req.valid('json')

      const [evento] = await db.select().from(eventos).where(eq(eventos.slug, slug))

      if (!evento) {
        return c.json({ error: 'Evento no encontrado' }, 404)
      }

      const telefonoNormalizado = normalizarTelefono(telefono)
      const candidatos = await db
        .select({ id: invitados.id, evento_id: invitados.evento_id, telefono: invitados.telefono })
        .from(invitados)
        .where(eq(invitados.evento_id, evento.id))

      const match = candidatos.find(
        (inv) => inv.telefono && normalizarTelefono(inv.telefono) === telefonoNormalizado,
      )

      if (!match) {
        return c.json(
          {
            error:
              'No encontramos ese teléfono registrado en este evento. ¿Ya te registraste? Probá el formulario de registro.',
          },
          404,
        )
      }

      const token = await signInvitadoToken({
        invitado_id: match.id,
        evento_id: evento.id,
      })

      logger.info({ invitado_id: match.id, evento_id: evento.id }, 'Invitado reingresó por teléfono')

      return c.json({ token, invitado_id: match.id }, 200)
    },
  )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/routes/eventos.routes.test.ts`
Expected: PASS, archivo completo en verde.

- [ ] **Step 5: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/eventos.routes.ts apps/api/src/routes/eventos.routes.test.ts
git commit -m "feat(api): endpoint de reingreso de invitado por teléfono"
```

---

### Task 4: Extraer `PAISES` a módulo compartido

**Files:**
- Create: `apps/web/src/lib/paises.ts`
- Modify: `apps/web/src/app/e/[slug]/registro/page.tsx`

**Interfaces:**
- Produces: `PAISES` (array constante) y `type PaisCodigo = 'UY' | 'AR' | 'PY'` desde `apps/web/src/lib/paises.ts`. Consumido por Task 5 (pantalla de reingreso) y por el registro existente en este mismo task.

**Contexto:** hoy `PAISES` vive hardcodeado en `registro/page.tsx` (líneas 29-33). Se mueve tal cual a un módulo nuevo para no duplicarlo en la pantalla de reingreso.

- [ ] **Step 1: Crear el módulo compartido**

```typescript
// apps/web/src/lib/paises.ts
export const PAISES = [
  { value: 'UY', label: 'Uruguay', placeholder: '+598 99 123 456' },
  { value: 'AR', label: 'Argentina', placeholder: '+54 9 11 1234 5678' },
  { value: 'PY', label: 'Paraguay', placeholder: '+595 981 123 456' },
] as const

export type PaisCodigo = (typeof PAISES)[number]['value']
```

- [ ] **Step 2: Actualizar `registro/page.tsx` para importar en vez de declarar**

En `apps/web/src/app/e/[slug]/registro/page.tsx`, agregar el import junto a los demás imports locales:

```typescript
import { PAISES } from '@/lib/paises'
```

Y eliminar la declaración local (líneas 29-33 del archivo actual):

```typescript
const PAISES = [
  { value: 'UY', label: 'Uruguay', placeholder: '+598 99 123 456' },
  { value: 'AR', label: 'Argentina', placeholder: '+54 9 11 1234 5678' },
  { value: 'PY', label: 'Paraguay', placeholder: '+595 981 123 456' },
] as const
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores. Si `z.enum(['UY', 'AR', 'PY'])` en el schema local del archivo da algún warning de tipos por no usar `PaisCodigo`, dejarlo como está — el schema Zod es independiente del tipo del array y no hace falta unificarlos para esto.

- [ ] **Step 4: Verificación manual**

Correr `pnpm --filter @album/web dev`, abrir `http://localhost:3000/e/<cualquier-slug-de-prueba>/registro` y confirmar que el selector de país sigue mostrando Uruguay/Argentina/Paraguay con los mismos placeholders que antes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/paises.ts apps/web/src/app/e/[slug]/registro/page.tsx
git commit -m "refactor(web): extrae PAISES a módulo compartido"
```

---

### Task 5: Cliente API — método `reingresar`

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

**Interfaces:**
- Consumes: nada nuevo — usa el `handleResponse` y `API_URL` ya existentes en el archivo.
- Produces: `apiClient(slug).reingresar(telefono: string): Promise<{ token: string; invitado_id: string }>`. Consumido por Task 6 (pantalla de reingreso).

**Contexto:** este archivo no tiene tests hoy (es un cliente delgado de `fetch`); se verifica por typecheck + uso manual en Task 6, siguiendo el mismo nivel de cobertura que los métodos ya existentes (`solicitarSubida`, `confirmarSubida`, etc.).

- [ ] **Step 1: Implementar el método**

En `apps/web/src/lib/api-client.ts`, dentro del objeto que retorna `apiClient(slug)` (junto a `solicitarSubida`, `confirmarSubida`, etc.), agregar:

```typescript
    async reingresar(telefono: string): Promise<{ token: string; invitado_id: string }> {
      const res = await fetch(`${API_URL}/eventos/${slug}/invitados/reingresar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono }),
      })
      return handleResponse<{ token: string; invitado_id: string }>(res)
    },
```

Nota: a diferencia de `solicitarSubida`/`confirmarSubida`/`eliminarArchivo`, este método **no** usa `authHeaders()` — el invitado todavía no tiene token en este punto, es justamente lo que está pidiendo.

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "feat(web): agrega apiClient.reingresar"
```

---

### Task 6: Pantalla `/e/[slug]/reingresar`

**Files:**
- Create: `apps/web/src/app/e/[slug]/reingresar/page.tsx`

**Interfaces:**
- Consumes: `PAISES` (Task 4, `@/lib/paises`), `apiClient(slug).reingresar` (Task 5, `@/lib/api-client`).
- Produces: ruta `/e/[slug]/reingresar`, misma forma de persistencia (`localStorage` `album_token_${slug}` / `album_invitado_${slug}`) que ya usa `registro/page.tsx`, así que `useInvitado` (`apps/web/src/hooks/useInvitado.ts`, sin cambios) funciona igual para ambos caminos.

**Contexto:** esta pantalla es deliberadamente el mismo patrón visual que `registro/page.tsx` (header fijo con X, título Playfair, `Form`/`FormField` de shadcn) pero con un único campo de teléfono. El país es cosmético — cambia el placeholder, no se envía al backend (spec sección 5).

- [ ] **Step 1: Crear la página**

```tsx
// apps/web/src/app/e/[slug]/reingresar/page.tsx
'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Heart, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PAISES } from '@/lib/paises'
import { apiClient, ApiError } from '@/lib/api-client'

const schema = z.object({
  pais: z.enum(['UY', 'AR', 'PY']),
  telefono: z.string().min(1, 'El teléfono es obligatorio').max(30),
})

type FormValues = z.infer<typeof schema>

interface Props {
  params: Promise<{ slug: string }>
}

export default function ReingresarPage({ params }: Props) {
  const { slug } = use(params)
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pais: 'AR',
      telefono: '',
    },
  })

  const paisSeleccionado = form.watch('pais')
  const placeholderTelefono =
    PAISES.find((p) => p.value === paisSeleccionado)?.placeholder ?? PAISES[1].placeholder

  async function onSubmit(values: FormValues) {
    setServerError(null)

    try {
      const { token, invitado_id } = await apiClient(slug).reingresar(values.telefono)

      localStorage.setItem(`album_token_${slug}`, token)
      localStorage.setItem(`album_invitado_${slug}`, invitado_id)

      router.push(`/e/${slug}/subir`)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo conectar. Verificá tu conexión e intentá de nuevo.'
      setServerError(message)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-backdrop">
      <header className="fixed top-0 z-30 flex h-12 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-md">
        <Link
          href={`/e/${slug}/registro`}
          aria-label="Volver al registro"
          className="flex h-8 w-8 items-center justify-center text-primary transition-opacity active:opacity-70"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h2 className="truncate font-[family-name:var(--font-playfair)] text-lg font-bold text-primary">
          Entrá con tu teléfono
        </h2>
        <div className="w-8" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-20">
        <div className="relative mb-10 text-center">
          <Heart
            className="pointer-events-none absolute -left-1 -top-4 h-14 w-14 -rotate-12 text-primary/10"
            aria-hidden="true"
            fill="currentColor"
          />
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-foreground">
            ¡Hola de nuevo!
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-muted-foreground">
            Ingresá el teléfono con el que te registraste para volver a acceder a tus fotos.
          </p>
        </div>

        {serverError && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 shadow-sm">
            <Info className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium text-destructive">{serverError}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="pais"
                render={({ field }) => (
                  <FormItem className="w-[7.5rem] shrink-0">
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      País
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.value} value={pais.value}>
                            {pais.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Teléfono
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder={placeholderTelefono}
                        autoComplete="tel"
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-full text-sm font-bold uppercase tracking-widest shadow-md"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                'Entrando…'
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/e/[slug]/reingresar/page.tsx
git commit -m "feat(web): pantalla de reingreso por teléfono"
```

---

### Task 7: Link desde Registro + fix del 409 hardcodeado

**Files:**
- Modify: `apps/web/src/app/e/[slug]/registro/page.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo — cambia el JSX y el manejo de errores del componente existente.

**Contexto:** esto cierra la spec sección 6. El código actual (post Task 4, que ya quitó el `PAISES` local) tiene este bloque en `onSubmit` que hay que reemplazar:

```typescript
      if (res.status === 409) {
        console.warn('[registro] rejected: cupo lleno')
        setServerError('Cupo de invitados alcanzado, hablá con el organizador.')
        return
      }

      if (!res.ok) {
        const rawText = await res.clone().text().catch(() => '<no se pudo leer el body>')
        const body = await res.json().catch(() => ({}))
        console.error('[registro] respuesta no-ok', {
          status: res.status,
          rawText,
        })
        setServerError((body as { error?: string }).error ?? 'Ocurrió un error. Intentá de nuevo.')
        return
      }
```

- [ ] **Step 1: Quitar el caso especial de 409**

Reemplazar el bloque de arriba por:

```typescript
      if (!res.ok) {
        const rawText = await res.clone().text().catch(() => '<no se pudo leer el body>')
        const body = await res.json().catch(() => ({}))
        console.error('[registro] respuesta no-ok', {
          status: res.status,
          rawText,
        })
        setServerError((body as { error?: string }).error ?? 'Ocurrió un error. Intentá de nuevo.')
        return
      }
```

(Se elimina únicamente el `if (res.status === 409) { ... }` que iba antes — el `if (!res.ok)` que queda ya cubre 409 igual que cualquier otro status de error, mostrando el mensaje real del backend.)

- [ ] **Step 2: Agregar el link a reingresar**

En el JSX, después del `<Button type="submit">...</Button>` que cierra el `<form>` (justo antes del `</form>` de cierre), agregar:

```tsx
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya te registraste?{' '}
              <Link
                href={`/e/${slug}/reingresar`}
                className="font-bold text-primary hover:underline"
              >
                Entrá con tu teléfono
              </Link>
            </p>
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificación manual end-to-end**

Con `pnpm --filter @album/api dev` y `pnpm --filter @album/web dev` corriendo:
1. Ir a `/e/<slug-de-evento-activo>/registro`, registrarse con un teléfono de prueba (ej. `099 111 222`) → debe llegar a `/subir`.
2. Volver a `/e/<slug>/registro` e intentar registrarse de nuevo con el mismo teléfono → debe mostrar el mensaje de teléfono duplicado (409), no el de cupo lleno.
3. Borrar `localStorage` (o abrir en una ventana privada) y entrar a `/e/<slug>/reingresar`, poner el mismo teléfono → debe llegar a `/subir` con los contadores de fotos/videos ya usados reflejando lo que subió antes.
4. Probar un teléfono que no existe en `/e/<slug>/reingresar` → debe mostrar el 404 con el mensaje de "no encontramos ese teléfono".

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/e/[slug]/registro/page.tsx
git commit -m "feat(web): link a reingreso y fix de mensaje 409 hardcodeado"
```

---

### Task 8: Suite completa — verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Correr toda la suite de tests de la API**

Run: `cd apps/api && npx vitest run`
Expected: todos los archivos de test en verde, incluyendo `eventos.routes.test.ts`, `archivos.routes.test.ts` y `jwt.test.ts` sin regresiones.

- [ ] **Step 2: Typecheck completo de ambos paquetes**

Run: `cd apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`
Expected: sin errores en ninguno de los dos.

- [ ] **Step 3: Confirmar que no se pusheó nada**

Run: `git log --oneline origin/main..HEAD`
Expected: lista los commits de las Tasks 1-7, todos locales — ninguno debe estar ya en `origin/main`. No ejecutar `git push`; eso queda a criterio explícito de la usuaria.
