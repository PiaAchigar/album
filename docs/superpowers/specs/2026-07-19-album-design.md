# Album — Design Spec
**Fecha:** 2026-07-19
**Dominio:** www.album.com.ar

## Qué es esto

SaaS multi-tenant de recolección de fotos/videos por QR para eventos (fiestas de 15, casamientos, etc.). Dos superficies completamente distintas:

- **Panel del organizador:** protegido por Supabase Auth. Wizard de creación de evento, panel de moderación (resumen, galería, detalle, invitados).
- **App del invitado:** completamente pública. El invitado escanea el QR, se registra con nombre/apellido/teléfono, recibe un JWT custom, y sube fotos/videos respetando los límites configurados por el organizador.

El organizador crea una cuenta real con email/contraseña (Supabase Auth). El invitado no crea cuenta — solo genera un `token_sesion` que se guarda en su navegador.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 |
| Backend (endpoints públicos) | Hono + @hono/node-server |
| DB + Auth organizador | Supabase (Postgres + Auth) |
| ORM | Drizzle |
| Storage de archivos | Cloudflare R2 — **nunca Supabase Storage** |
| UI components | shadcn/ui + Tailwind v4 |
| Package manager | pnpm + Turborepo v2 |
| Auth invitado | JWT custom firmado con `INVITADO_JWT_SECRET` |

---

## Arquitectura: Enfoque Híbrido (B)

**Hono** maneja únicamente los endpoints públicos del invitado (registro, presigned URL, confirmar subida). No tiene acceso a Supabase Auth ni maneja sesiones del organizador.

**Next.js Server Actions + Server Components** manejan todo el panel del organizador. Hablan directamente con Supabase/Drizzle usando el cliente server-side. RLS en `eventos` garantiza que el organizador solo ve los suyos.

Ambas apps comparten `packages/database` con el schema Drizzle y las migraciones.

---

## Estructura del monorepo

```
album/
├── apps/
│   ├── api/                        # Hono — Puerto 3001
│   │   └── src/
│   │       ├── index.ts
│   │       ├── middleware/
│   │       │   ├── cors.ts
│   │       │   ├── rate-limit.ts   # Map en memoria (Fase 0-5), Upstash Redis (Fase 6)
│   │       │   └── jwt-invitado.ts # valida Bearer token del invitado
│   │       └── routes/
│   │           ├── eventos.routes.ts   # POST /eventos/:slug/invitados
│   │           └── archivos.routes.ts  # solicitar-subida, confirmar
│   │
│   └── web/                        # Next.js — Puerto 3000
│       └── src/app/
│           ├── (auth)/
│           │   ├── login/page.tsx
│           │   └── registro/page.tsx
│           ├── (organizador)/          # middleware.ts protege este grupo
│           │   ├── eventos/page.tsx    # "Mis eventos"
│           │   └── eventos/
│           │       ├── nuevo/
│           │       │   ├── page.tsx   # wizard wrapper
│           │       │   └── _steps/    # Paso1, Paso2, Paso3, Paso4
│           │       └── [id]/
│           │           ├── page.tsx              # Resumen
│           │           ├── galeria/page.tsx       # Galería
│           │           ├── galeria/[archivoId]/page.tsx  # Detalle
│           │           └── invitados/page.tsx     # Lista de invitados
│           └── evento/[slug]/          # App pública del invitado
│               ├── page.tsx            # Landing
│               ├── registro/page.tsx
│               └── subir/page.tsx
│
├── packages/
│   └── database/
│       ├── src/schema.ts
│       ├── drizzle.config.ts
│       └── migrations/
│
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Schema de base de datos

```ts
// packages/database/src/schema.ts

export const eventos = pgTable('eventos', {
  id:                         uuid().primaryKey().defaultRandom(),
  organizador_id:             uuid().notNull(),               // FK a auth.users
  slug:                       text().unique().notNull(),
  nombre_evento:              text().notNull(),
  fecha:                      date().notNull(),
  horario:                    time().notNull(),
  foto_portada_url:           text(),
  cantidad_invitados_totales: integer(),
  limite_invitados_login:     integer().notNull(),
  limite_fotos_por_invitado:  integer().notNull(),
  limite_videos_por_invitado: integer().notNull(),
  estado:                     text().notNull().default('borrador'), // borrador|activo|cerrado
  created_at:                 timestamptz().defaultNow(),
})

export const invitados = pgTable('invitados', {
  id:              uuid().primaryKey().defaultRandom(),
  evento_id:       uuid().notNull().references(() => eventos.id),
  nombre:          text().notNull(),
  apellido:        text().notNull(),
  telefono:        text(),
  acepto_terminos: boolean().notNull(),
  token_sesion:    text().notNull().unique(),
  fotos_subidas:   integer().notNull().default(0),
  videos_subidos:  integer().notNull().default(0),
  created_at:      timestamptz().defaultNow(),
})

export const archivos = pgTable('archivos', {
  id:            uuid().primaryKey().defaultRandom(),
  evento_id:     uuid().notNull().references(() => eventos.id),
  invitado_id:   uuid().notNull().references(() => invitados.id),
  tipo:          text().notNull(),            // foto|video
  r2_key:        text().notNull(),
  thumbnail_key: text(),
  estado:        text().notNull().default('pendiente'), // pendiente|aprobada|oculta
  created_at:    timestamptz().defaultNow(),
})
```

**RLS:**
- `eventos`: política `organizador_id = auth.uid()` — el organizador solo ve/edita sus eventos.
- `invitados` / `archivos`: sin RLS de Supabase Auth. El control de acceso lo hace Hono validando el JWT del invitado. El organizador accede a estas tablas vía Server Actions con el Service Role Key (solo en server-side).

---

## Auth del organizador

- `@supabase/ssr` en `apps/web` para manejar cookies de sesión en Server Components.
- `src/middleware.ts` de Next.js intercepta `/(organizador)/*`. Sin sesión → redirect `/login`.
- Login/registro usan Supabase Auth (email + contraseña). Sin magic links por ahora.
- Las Server Actions del panel usan `createServerClient` con las cookies del request — nunca el Service Role Key en el cliente.

## Auth del invitado

- JWT generado en Hono al completar el registro. Payload: `{ invitado_id, evento_id, iat, exp }`. Expira en 30 días.
- Firmado con `INVITADO_JWT_SECRET` (HS256).
- Guardado en `localStorage` bajo `album_token_<slug>`.
- Hook `useInvitado(slug)` en el frontend del invitado lo lee y lo adjunta como `Authorization: Bearer <token>` en cada llamada a Hono.
- Middleware `jwt-invitado.ts` de Hono verifica la firma sin tocar la DB, luego inyecta `{ invitado_id, evento_id }` en el contexto.

---

## Endpoints Hono (`apps/api`)

### `GET /health`
Verifica conectividad con DB. Responde `{ status: "ok" }` 200 o `{ status: "degraded" }` 503.

### `POST /eventos/:slug/invitados`
**Sin autenticación.**
1. Fetch del evento por `slug` — verifica estado `activo`.
2. `COUNT(invitados) WHERE evento_id = ?` — si `>= limite_invitados_login` → `409 { error: "Cupo de invitados alcanzado" }`.
3. Inserta fila en `invitados`, genera JWT.
4. Responde `{ token, invitado_id }`.

Body: `{ nombre, apellido, telefono?, acepto_terminos: true }`

### `POST /eventos/:slug/archivos/solicitar-subida`
**Requiere JWT del invitado.**
1. Lee `invitado.fotos_subidas` o `invitado.videos_subidos` según `tipo`.
2. Compara contra el límite del evento — si sin cupo → `403 { error: "Ya usaste tus N fotos" }`.
3. Genera presigned URL de R2 con key `eventos/{evento_id}/{invitado_id}/{uuid}.{ext}`. Expira en 5 minutos.
4. Responde `{ upload_url, r2_key }`.

Body: `{ tipo: "foto"|"video", extension: string }`

### `POST /eventos/:slug/archivos/confirmar`
**Requiere JWT del invitado.**
1. Verifica que `r2_key` empiece con `eventos/{evento_id}/{invitado_id}/` — evita confirmaciones de keys ajenas.
2. Inserta fila en `archivos` con `estado = "pendiente"`.
3. `UPDATE invitados SET fotos_subidas = fotos_subidas + 1` (o videos).
4. Responde `{ archivo_id }`.

Body: `{ r2_key, tipo, extension }`

---

## Flujo de subida de archivos (R2)

```
Browser (invitado)
  │
  ├─ POST /eventos/:slug/archivos/solicitar-subida
  │    └─ Hono valida JWT + límites → genera presigned URL (5 min)
  │
  ├─ PUT {upload_url}  ← directo a R2, sin pasar por el servidor
  │
  └─ POST /eventos/:slug/archivos/confirmar
       └─ Hono registra archivo en DB + incrementa contador
```

La foto de portada del organizador (wizard Paso 2) sigue el mismo patrón pero la presigned URL se genera en una Server Action de Next.js (el organizador tiene sesión Supabase Auth).

---

## Server Actions del organizador

```
apps/web/src/app/(organizador)/actions/
├── eventos.actions.ts
│   ├── crearEvento(data)       # crea en borrador
│   ├── activarEvento(id)       # borrador → activo, genera slug, devuelve QR data
│   ├── listarEventos()         # eventos del organizador autenticado
│   └── obtenerEvento(id)
├── archivos.actions.ts
│   ├── aprobarArchivo(id)
│   ├── ocultarArchivo(id)
│   └── eliminarArchivo(id)     # borra R2 → elimina fila → decrementa contador
└── invitados.actions.ts
    └── listarInvitados(eventoId, search?)
```

**`eliminarArchivo`** es la operación más crítica: primero borra el objeto en R2, luego elimina la fila en `archivos`, luego decrementa el contador en `invitados`. Si falla R2 no se borra la fila (integridad sobre limpieza).

---

## Sistema de diseño

Los tokens del `DESIGN.md` se mapean como CSS custom properties en `tailwind.css`:

- **Contexto organizador** (`.ctx-organizador`): primary `#1E293B` (Navy), bg blanco, bordes slate `#E2E8F0`. Tipografía Inter. Elevación con tonal layers (sin sombras).
- **Contexto invitado** (`.ctx-invitado`): primary `#D4AF37` (Gold), accent `#FBCFE8` (Pale Pink). Tipografía Playfair Display para H1/H2, Inter para cuerpo. Sombras difusas warm-tinted.

El layout raíz de `(organizador)/layout.tsx` aplica `ctx-organizador`. El layout de `evento/[slug]/layout.tsx` aplica `ctx-invitado`. shadcn/ui consume los CSS custom properties — sin conflictos.

---

## Variables de entorno

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=              # URL pública del bucket (para mostrar imágenes)

# App
PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# Auth invitado
INVITADO_JWT_SECRET=        # mínimo 32 chars, random

# Upstash Redis (Fase 6+)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Fases de implementación

### Fase 0 — Scaffold del monorepo
- Turborepo + pnpm workspaces con `apps/api`, `apps/web`, `packages/database`.
- `turbo.json`, `tsconfig.base.json`, `.env.example`.
- Hono con `GET /health` respondiendo 200.
- Next.js con página `/` placeholder + Tailwind v4 + shadcn/ui init.
- Drizzle config conectando a Supabase.

**Criterio:** `pnpm dev` levanta ambas apps. `GET localhost:3001/health` → 200.

### Fase 1 — Schema de datos + Auth del organizador
- Migraciones Drizzle para las 3 tablas.
- RLS en `eventos`.
- Pantallas `/registro`, `/login`, `/eventos` (estado vacío con botón "Crear mi primer evento").
- Middleware de Next.js protegiendo `/(organizador)/*`.

**Criterio:** registro → logout → login → `/eventos` vacío.

### Fase 2 — Wizard de creación de evento
- Wizard 4 pasos: datos básicos, foto portada (R2), límites (steppers), revisión.
- Al confirmar: genera `slug` (slugify + nanoid 6 chars), estado `activo`, genera QR.
- Pantalla QR: QR grande + descargar PNG + copiar link.
- `/eventos` lista los eventos existentes.

**Criterio:** QR descargable → escanearlo lleva a `/evento/:slug`.

### Fase 3 — Landing pública + registro de invitado
- `/evento/[slug]`: foto portada, nombre, fecha/hora, CTA.
- `/evento/[slug]/registro`: formulario + T&C + validación de cupo.
- Endpoint Hono: valida cupo, inserta invitado, devuelve JWT.
- Frontend guarda JWT en localStorage, redirige a `/subir`.

**Criterio:** con `limite_invitados_login = 2`, el tercer registro recibe mensaje "Cupo de invitados alcanzado".

### Fase 4 — Subida de fotos/videos
- `/evento/[slug]/subir`: botón cámara/galería, grilla de subidos, contador "X de Y fotos".
- Validación MIME + tamaño en frontend antes de pedir presigned URL.
- Flujo: solicitar-subida → PUT a R2 → confirmar.

**Criterio:** con `limite_fotos_por_invitado = 3`, la cuarta foto es rechazada por Hono.

### Fase 5 — Panel de moderación (4 pantallas)
- Resumen: tarjetas estadísticas.
- Galería: grilla mosaico con filtros (invitado, tipo, estado).
- Detalle: full screen, aprobar/ocultar/eliminar, nav prev/next sin volver a la grilla.
- Invitados: lista con buscador + contadores vs límites.
- Eliminar: borra R2 → elimina fila → decrementa contador.
- Descarga ZIP síncrona de archivos aprobados.

**Criterio:** organizador elimina foto → desaparece de galería + de R2 + contador del invitado baja.

### Fase 6 — Hardening
- Rate limiting con Upstash Redis (reemplaza Map en memoria).
- Compresión de imagen en cliente con `browser-image-compression`.
- Verificación de que RLS bloquea acceso cruzado entre organizadores.
- Logs de auditoría con pino en Hono.

### Fase 7 — QA + prep deploy
- Prueba en Android/iOS, distintas conexiones.
- Cron ping a Supabase (GitHub Action) para evitar pausa por inactividad.
- Variables de entorno de producción documentadas y listas para Vercel + Railway.

---

## Decisiones explícitas

| Decisión | Elección | Razón |
|---|---|---|
| CSS/components | shadcn/ui + Tailwind v4 | Accesibilidad gratis + theming por CSS vars |
| Auth invitado | JWT HS256 | Sin round-trip a DB en cada request |
| Storage | Cloudflare R2 | Egress gratis, 10GB free tier |
| Upload | Presigned URL directo desde browser | No pasa por el servidor = sin costo de bandwidth |
| ORM | Drizzle | Ya conocido de saas-crm, type-safe |
| Rate limit inicial | Map en memoria | Sin Redis hasta Fase 6, suficiente para dev/testing |
| ZIP descarga | Síncrono Fase 5, BullMQ Fase 6+ | YAGNI — cola cuando realmente haga falta |

## Fuera de alcance (por ahora)

- Pagos (Mercado Pago)
- Moderación automática de contenido (NSFW)
- Notificaciones push/email al organizador
- App móvil nativa
