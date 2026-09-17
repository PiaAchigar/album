# Spec: Credenciales de R2 propias por organizador

**Fecha:** 2026-09-17
**Estado:** Aprobado por el usuario (brainstorming), pendiente de plan de implementación.

## 1. Contexto y problema

Hoy `apps/api/src/lib/r2.ts` y `apps/web/src/lib/r2.ts` arman cada uno su propio `S3Client` leyendo variables de entorno globales (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) — **un solo bucket, el del dueño del proyecto, usado por todos los organizadores**. Cada foto/video que sube cualquier invitado de cualquier evento consume el R2 del dueño del SaaS, no el del organizador. El dueño quiere dejar de pagar/exponer su propio storage y que cada organizador traiga su propia cuenta de Cloudflare R2.

El código está más avanzado de lo que documentaba `document.md` (desactualizado): ya existe el panel de moderación completo (Fase 5 — galería, detalle, reproducción de video, ZIP de descarga), y también hay una organizadora real en producción (evento "Los 15 de Valentina") subiendo contra el bucket compartido hoy. Todo eso queda alcanzado por este cambio.

No existe todavía una tabla `organizadores` — `eventos.organizador_id` referencia `auth.users` directamente.

## 2. Modelo de datos

Nueva tabla `organizador_storage_config` en `packages/database/src/schema.ts`, una fila por organizador:

| Columna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| organizador_id | uuid unique not null | FK lógica a `auth.users` (igual que `eventos.organizador_id`, sin FK real de Postgres a `auth.users` por ser un esquema separado — mismo patrón ya usado en `eventos`) |
| r2_account_id_cipher / iv / tag | text | cifrado (no es secreto, pero se cifra por defensa en profundidad) |
| r2_access_key_id_cipher / iv / tag | text | cifrado |
| r2_secret_access_key_cipher / iv / tag | text | cifrado |
| r2_bucket_name_cipher / iv / tag | text | cifrado |
| verificado_at | timestamptz nullable | se completa cuando la validación contra R2 fue exitosa; `null` = configuración pendiente o inválida |
| created_at / updated_at | timestamptz | |

RLS: política `organizador_owns_storage_config` (`organizador_id = auth.uid()`), mismo patrón que `organizador_owns_evento` en `eventos`. El valor descifrado nunca sale de `apps/api` — ni el propio organizador lo vuelve a ver completo (la UI muestra `Configurado ✓ (bucket terminado en ...ab12)`, nunca el secreto).

Migración Drizzle nueva en `packages/database` + la política RLS correspondiente en el mismo archivo de migración SQL donde ya vive `organizador_owns_evento`.

## 3. Cifrado

- **Algoritmo:** AES-256-GCM vía `node:crypto` (sin dependencias nuevas). IV random de 12 bytes por campo y por fila; el auth tag detecta manipulación del ciphertext.
- **Clave maestra:** variable de entorno nueva `CREDENTIALS_ENCRYPTION_KEY` (32 bytes, base64 — `openssl rand -base64 32`). Vive **solo en Railway (apps/api)**, nunca en Vercel — coherente con la decisión de la sección 5 de que solo la API descifra.
- **Sin rotación de clave por ahora** (YAGNI): si hace falta rotar `CREDENTIALS_ENCRYPTION_KEY` en el futuro, se re-cifran las filas existentes con un script puntual — no se construye versionado de claves para un caso que no existe todavía.
- Módulo nuevo `apps/api/src/lib/crypto.ts`:
  - `encryptSecret(plaintext: string): { cipher: string; iv: string; tag: string }`
  - `decryptSecret(input: { cipher: string; iv: string; tag: string }): string`
  - Testeado con Vitest (`crypto.test.ts` al lado, mismo patrón que el resto del repo) — casos: round-trip, distintos plaintexts dan distinto ciphertext (por el IV random), tag inválido lanza.

## 4. Endpoints nuevos en la API

**Middleware nuevo** `apps/api/src/middleware/auth-organizador.ts`: valida el `Authorization: Bearer <access_token>` de Supabase (via `supabase.auth.getUser(token)` con el cliente admin/anon), setea `c.set('organizador_id', user.id)`. Es el primer middleware de auth de *organizador* en la API — hasta ahora solo existía `jwtInvitadoMiddleware`.

Ruta nueva `apps/api/src/routes/organizador.routes.ts`:

| Método y path | Auth | Qué hace |
|---|---|---|
| `POST /organizador/storage-config` | organizador | Recibe las 4 credenciales en texto plano. Arma un `S3Client` efímero (sin guardar nada todavía) y hace `PutObjectCommand` de un objeto de prueba (`_album-verificacion/<uuid>.txt`) + `DeleteObjectCommand` inmediato. Si falla, devuelve el error de R2 tal cual (403 credenciales inválidas, `NoSuchBucket`, etc.) y no persiste nada. Si funciona, cifra los 4 campos y hace upsert, seteando `verificado_at = now()`. |
| `GET /organizador/storage-config/status` | organizador | `{ configurado: boolean, bucket?: string, terminaEn?: string }` — nunca el secreto completo. |
| `POST /organizador/eventos/:id/portada/solicitar-subida` | organizador | Reemplaza `getOrganizadorPresignedUpload` (hoy en `apps/web/src/lib/r2.ts`). Verifica que el evento sea del organizador, resuelve sus credenciales, devuelve URL prefirmada de PUT. |
| `POST /organizador/archivos/urls-lectura` | organizador | Body `{ archivo_ids: string[] }`. Verifica ownership de cada archivo (join `archivos` → `eventos` → `organizador_id`), devuelve `{ urls: Record<archivo_id, url_firmada> }` (GET firmado, expira en minutos). Un solo request para toda una grilla, en vez de una URL por miniatura. |
| `DELETE /organizador/archivos` | organizador | Body `{ archivo_ids: string[] }`. Borra los objetos R2 correspondientes (ownership verificado igual que arriba). Deja la fila en `archivos` intacta — el borrado de DB lo sigue haciendo el Server Action de Next, después de que este endpoint confirme éxito (mismo invariante "R2 primero" que ya usa el código actual). |
| `DELETE /organizador/eventos/:id/archivos-r2` | organizador | Borra **todos** los objetos R2 de un evento: la portada (`eventos.foto_portada_url`) + cada fila de `archivos` de ese evento. Verifica que el evento sea del organizador. Reemplaza el loop manual que hoy arma `eventos.actions.ts` (`keysABorrar` + `Promise.all(deleteR2Object)`) — la API ya tiene que consultar `archivos` para el join de ownership, así que hacerlo ahí evita que Next tenga que enumerar keys. |

Ruta pública nueva en `apps/api/src/routes/eventos.routes.ts` (junto al resto de rutas públicas de evento):

| Método y path | Auth | Qué hace |
|---|---|---|
| `GET /eventos/:slug/portada-url` | ninguna (pública) | Devuelve `{ url }` firmada de lectura para la portada del evento. La usa tanto la landing pública (`/e/[slug]`) como cualquier vista del organizador que necesite la misma miniatura — no hay info sensible en la portada. |

Ruta nueva en `apps/api/src/routes/archivos.routes.ts` (junto a las rutas de invitado ya existentes):

| Método y path | Auth | Qué hace |
|---|---|---|
| `POST /eventos/:slug/archivos/urls-lectura` | invitado (`jwtInvitadoMiddleware`) | Body `{ archivo_ids: string[] }`, acotado a los archivos del propio invitado (mismo chequeo de `evento_id`/`invitado_id` que ya usan `mis-archivos` y el `DELETE` de invitado). Usado por `SubirClient.tsx` para pintar "ya subiste esto" sin depender de una URL pública fija. |

## 5. `apps/api/src/lib/r2.ts` — de env vars estáticas a credenciales por organizador

Funciones nuevas:
- `getS3ClientForOrganizador(organizadorId: string): Promise<{ client: S3Client; bucket: string }>` — trae la fila de `organizador_storage_config`, descifra, arma el cliente. Lanza un error tipado (`StorageNoConfiguradoError`) si no existe fila o `verificado_at` es null.
- `getS3ClientForEvento(eventoId: string)` — hace el join `eventos.organizador_id` → lo anterior. La usan las rutas públicas/invitado que solo tienen `evento_id` a mano.
- `getPresignedReadUrl(client, bucket, r2Key, expiresIn = 300)` — `GetObjectCommand` + `getSignedUrl`, usado por los tres endpoints de "urls-lectura" y por `portada-url`.
- `getPortadaPresignedUpload(client, bucket, eventoId, extension)` — reemplaza `getOrganizadorPresignedUpload`, ahora vive en la API en vez de en `apps/web`.

Las funciones existentes (`getInvitadoPresignedUpload`, `deleteR2Object`) pasan a recibir `{ client, bucket }` ya resuelto como primer argumento, en vez de armar su propio cliente desde `process.env`. Sin caché de clientes por ahora (YAGNI) — es una query liviana por request, no un cuello de botella al volumen que maneja esto.

Sin cambios en `packages/database` más allá de la migración de la sección 2.

## 6. Onboarding y gate

**Pantalla nueva** `apps/web/src/app/(organizador)/configuracion/storage/page.tsx` — formulario con Account ID, Access Key ID, Secret Access Key, Bucket Name + botón "Guardar y verificar". Llama a `POST /organizador/storage-config`. Si la API devuelve error, se muestra el mensaje real de R2 inline. Si tiene éxito, redirige a `/eventos`.

Esta misma pantalla sirve para editar/rotar credenciales más adelante: si `GET /organizador/storage-config/status` devuelve `configurado: true`, la página muestra "Configurado ✓ (bucket terminado en ...ab12)" con un botón "Cambiar credenciales" que revela el mismo formulario vacío (nunca prellenado con el secreto).

**Gate en `apps/web/src/middleware.ts`:** además del chequeo de sesión ya existente, para rutas bajo `/eventos` se agrega una consulta liviana (`supabase.from('organizador_storage_config').select('id').eq('organizador_id', user.id).maybeSingle()`, HTTP vía el cliente ya instanciado ahí, compatible con Edge Runtime) — si no hay fila, redirige a `/configuracion/storage`. La propia ruta `/configuracion` se agrega a `PROTECTED_PREFIXES` (exige sesión) pero se excluye del chequeo de "tiene config", para no generar loop de redirección.

**Orden real del flujo:** registro → login → (gate) `/configuracion/storage` si falta configurar → `/eventos`. Se inserta antes de "Mis eventos", nunca antes del login.

**Migración de la cuenta ya existente (evento "Los 15 de Valentina"):** sin excepción — mismo gate para todas las cuentas, incluida la que ya está en producción. En su próximo login va a caer en `/configuracion/storage` antes de poder seguir usando el panel. Hay que avisarle para que tenga a mano sus credenciales de R2 antes de ese momento (dato operativo, no de código — queda anotado acá para no perderlo al pasar al plan de implementación).

## 7. Cambios en `apps/web` fuera del gate

**Se borra `apps/web/src/lib/r2.ts` completo** — ninguna parte de Next.js vuelve a armar un `S3Client` propio.

**Nuevo módulo** `apps/web/src/lib/organizador-api-client.ts` — helper server-side (para usar solo desde Server Actions y Route Handlers, nunca desde un componente cliente) que toma el `access_token` de `createSupabaseServerClient()` y hace `fetch` contra la API con `Authorization: Bearer`. Mismo rol que `apps/web/src/lib/api-client.ts` ya cumple para el invitado, pero éste nunca se usa desde el browser — así el token de sesión del organizador no viaja a JS de cliente hacia un origen distinto.

Puntos que se actualizan, todos reemplazando su llamada directa a R2 por una llamada a través de `organizador-api-client.ts`:

- `apps/web/src/app/(organizador)/eventos/nuevo/_steps/Paso2FotoPortada.tsx` y `actions.ts` — piden la URL prefirmada a `POST /organizador/eventos/:id/portada/solicitar-subida`.
- `apps/web/src/app/(organizador)/actions/archivos.actions.ts` — `eliminarArchivo` llama a `DELETE /organizador/archivos` con `[archivoId]` en vez de `deleteR2Object` directo.
- `apps/web/src/app/(organizador)/actions/invitados.actions.ts` — `eliminarInvitado` llama una sola vez a `DELETE /organizador/archivos` con todos los `archivo_ids` del invitado, en vez del loop actual de `deleteR2Object` por archivo.
- `apps/web/src/app/(organizador)/actions/eventos.actions.ts` — el borrado de evento llama una vez a `DELETE /organizador/eventos/:id/archivos-r2` y elimina el código manual de `keysABorrar` (simplificación: la API ya resuelve qué borrar).
- **Server Action nueva** `obtenerUrlsLectura(archivoIds: string[])` en `archivos.actions.ts` — llama a `POST /organizador/archivos/urls-lectura`. La consumen como client components (llamando el Server Action directo, patrón ya soportado por Next):
  - `GaleriaClient.tsx` — pide las URLs de todo lo visible en la grilla en un solo batch.
  - `DetalleClient.tsx` y `ReproduccionModal.tsx` — piden la URL del archivo puntual (batch de 1).
  - Los tres reemplazan `${R2_PUBLIC_URL}/${archivo.r2_key}` por el resultado de este Server Action.
- `apps/web/src/app/e/[slug]/page.tsx` — reemplaza `${process.env.R2_PUBLIC_URL}/${evento.foto_portada_url}` (nombre de env var además inconsistente con el resto del código) por un fetch server-side a `GET {API_URL}/eventos/:slug/portada-url`.
- `apps/web/src/app/e/[slug]/subir/SubirClient.tsx` — reemplaza `${R2_PUBLIC_URL}/${item.r2Key}` por una llamada nueva `urlsLectura(archivoIds)` agregada a `apps/web/src/lib/api-client.ts` (mismo patrón invitado-autenticado que ya usan `solicitarSubida`/`confirmarSubida`), contra `POST /eventos/:slug/archivos/urls-lectura`.
- `apps/web/src/app/api/eventos/[id]/galeria/descargar-zip/route.ts` — reemplaza `getR2PublicUrl(row.r2_key)` + fetch directo por: pedir las URLs firmadas vía `organizador-api-client.ts` (mismo endpoint batch que usa la galería) y después hacer el fetch de descarga contra esas URLs firmadas.

Variables de entorno que quedan sin uso tras este cambio (no se borran del código de golpe, pero quedan candidatas a sacarse de Vercel/Railway una vez confirmado el deploy): `NEXT_PUBLIC_R2_PUBLIC_URL`, `R2_PUBLIC_URL` (en `apps/web`). Las de `apps/api` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) quedan sin uso una vez que **todos** los organizadores (incluida la cuenta de Valentina) migraron a su propia config — no se borran en este cambio, es limpieza operativa posterior.

## 8. Testing

- `apps/api/src/lib/crypto.test.ts` (nuevo): round-trip, IV distinto por llamada, tag inválido lanza.
- `apps/api/src/routes/organizador.routes.test.ts` (nuevo), mismo patrón de mocks que `archivos.routes.test.ts` (mock de `../db/index.js` y de `../lib/r2.js`):
  - guardar credenciales válidas → 200, `verificado_at` seteado.
  - guardar credenciales que fallan la prueba Put+Delete → 4xx, no se persiste nada.
  - `status` sin config previa → `{ configurado: false }`.
  - `urls-lectura` rechaza `archivo_id` que pertenece a otro organizador (403/404, no se filtra ni un solo url ajeno).
  - `DELETE /organizador/archivos` y `DELETE /organizador/eventos/:id/archivos-r2` idénticamente acotados por ownership.
- `apps/api/src/routes/archivos.routes.test.ts` (existente): actualizar los mocks de `getInvitadoPresignedUpload`/`deleteR2Object` a la nueva firma con `{ client, bucket }`, agregar caso del nuevo `POST /eventos/:slug/archivos/urls-lectura` acotado al invitado dueño del token.
- Frontend: verificación manual en browser — mismo criterio que el resto de las fases (no hay suite de componentes en este repo todavía): organizador nuevo se registra → cae en `/configuracion/storage` → prueba con credenciales inválidas (ve el error real) → prueba con credenciales válidas → llega a `/eventos` → wizard completo con portada real → galería muestra miniaturas reales → eliminar un archivo lo borra del bucket propio → eliminar el evento borra todo el prefijo `eventos/<id>/` del bucket propio.

## 9. Fuera de alcance

- Rotación de `CREDENTIALS_ENCRYPTION_KEY` (re-cifrado masivo) — se resuelve con un script puntual el día que haga falta, no antes.
- Configurar dominio público / CORS del bucket del organizador en Cloudflare — es un paso manual del organizador en su propia cuenta, documentado aparte (no es código de este repo).
- Exención ("grandfathering") de cuentas existentes — se descartó explícitamente: todas las cuentas, incluida la de producción, pasan por el mismo gate.
- Límite de tamaño de archivo o cuota de storage del organizador — ya cubierto por `limite_fotos_por_invitado`/`limite_videos_por_invitado` existentes, sin relación con este cambio.
- Borrar de env vars `R2_*`/`NEXT_PUBLIC_R2_PUBLIC_URL` — se hace después de confirmar que no queda ninguna cuenta usando el bucket compartido.
