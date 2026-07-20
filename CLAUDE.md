# CLAUDE.md — Album: SaaS de Recolección de Fotos/Videos por QR

## 1. Qué es esto

**Album** es un SaaS multi-tenant donde un **organizador** (cliente que paga, ej: dueño de una fiesta de 15, casamiento) crea un **evento**, configura límites de uso, y recibe un **QR** para repartir a sus invitados. Los **invitados** escanean el QR, se registran con sus datos, y suben fotos/videos que quedan en un álbum que el organizador puede moderar.

Dos superficies distintas — no confundir:
- **Panel del organizador (admin del evento):** registro/login de cuenta real (Supabase Auth) → wizard de creación de evento → panel de moderación multi-pantalla (resumen, galería, detalle, invitados). Requiere cuenta.
- **App del invitado:** landing pública del evento + registro liviano (sin cuenta) + subida. Se registra en el momento con el token de sesión, no crea usuario en Supabase Auth.

No confundir los dos "registros": el del organizador crea una cuenta real con email/contraseña. El del invitado es solo un formulario que genera un `token_sesion`, sin cuenta.

## Recursos:
Dentro de las carpetas "design_album_mobile_first" y "design_web_album" estan los esqueletos de Frontend y el design ux/ui de la aplicación.

## 2. Stack

- **Frontend:** Next.js (App Router), Turborepo monorepo (mismo patrón que `saas-crm`).
- **Backend:** Hono, deploy en Railway (o Cloudflare Workers si migramos ahí para tener R2 en la misma cuenta).
- **DB + Auth:** Supabase (Postgres + Auth). Free tier alcanza de sobra para la parte de datos.
- **Storage de archivos:** Cloudflare R2 (free tier 10GB, egress gratis). **Nunca subir fotos/videos a Supabase Storage** — se llena rápido y no es el punto fuerte de Supabase acá.
- **ORM:** Drizzle.
- **Cola/jobs (opcional, fase 5+):** Upstash Redis + BullMQ, para generar el ZIP de descarga sin bloquear el server.
- **Pagos (si el SaaS cobra por evento):** Mercado Pago — fuera de alcance de las primeras fases, se agrega cuando el resto funcione.

## 3. Modelo de datos (Supabase / Postgres)

### `organizadores` (o reusar `auth.users` de Supabase Auth directamente)
Cuenta del cliente que paga y crea eventos. Login vía Supabase Auth.

### `eventos`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| organizador_id | uuid | FK a auth.users |
| slug | text unique | usado en la URL pública `/evento/:slug` y en el QR |
| nombre_evento | text | ej: "Los 15 de Fulanita" |
| fecha | date | |
| horario | time | |
| foto_portada_url | text | key en R2 de la foto de portada |
| cantidad_invitados_totales | int | informativo, cuántos invitados espera el organizador |
| limite_invitados_login | int | **tope duro**: cuántos registros de invitados se aceptan. Al llegar al tope, el formulario de registro se cierra ("Cupo de invitados alcanzado") |
| limite_fotos_por_invitado | int | tope de fotos que puede subir cada invitado ya registrado |
| limite_videos_por_invitado | int | tope de videos que puede subir cada invitado ya registrado |
| estado | text | `borrador` / `activo` / `cerrado` |
| created_at | timestamptz | |

### `invitados`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| evento_id | uuid | FK |
| nombre | text | |
| apellido | text | |
| telefono | text | opcional |
| acepto_terminos | boolean | debe ser `true` para crear el registro |
| token_sesion | text | JWT o similar, guardado en el navegador del invitado |
| fotos_subidas | int | contador, se incrementa en cada subida exitosa de foto |
| videos_subidos | int | contador, se incrementa en cada subida exitosa de video |
| created_at | timestamptz | |

> El conteo de `fotos_subidas` / `videos_subidos` vive en la fila del invitado (no se calcula con `COUNT(*)` cada vez) para poder validar el límite con una sola lectura antes de autorizar la próxima subida.

### `archivos`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| evento_id | uuid | FK |
| invitado_id | uuid | FK |
| tipo | text | `foto` / `video` |
| r2_key | text | ubicación real del archivo en el bucket |
| thumbnail_key | text | opcional, para videos o para acelerar la grilla del admin |
| estado | text | `pendiente` / `aprobada` / `oculta` |
| created_at | timestamptz | |

### RLS (Row Level Security)
- `eventos`: el organizador solo ve/edita sus propios eventos (`organizador_id = auth.uid()`).
- `invitados` / `archivos`: el invitado no tiene cuenta Supabase Auth real — el control de acceso a estas tablas se hace **en el backend Hono** (valida el `token_sesion` de invitado), no con RLS de Supabase Auth. El organizador sí puede leer todo lo de sus propios eventos vía RLS.

## 4. Reglas de negocio clave (de la config del evento)

Esto es lo que el organizador carga en el wizard y lo que el backend tiene que hacer cumplir:

1. **`limite_invitados_login`**: antes de crear un nuevo `invitado`, contar cuántos invitados tiene el evento. Si ya llegó al límite, el endpoint de registro devuelve error y el frontend muestra "Cupo de invitados alcanzado, hablá con el organizador".
2. **`limite_fotos_por_invitado`** y **`limite_videos_por_invitado`**: antes de dar una URL prefirmada de R2, el backend chequea `invitado.fotos_subidas < evento.limite_fotos_por_invitado` (o el equivalente para video) según el `tipo` que se quiere subir. Si no hay cupo, no se genera la URL.
3. **`cantidad_invitados_totales`** es solo informativo/analítico (para que el organizador tenga una referencia), no bloquea nada — el que bloquea es `limite_invitados_login`.

## 5. Fases de desarrollo

Cada fase termina en algo que se puede probar de punta a punta antes de pasar a la siguiente. No arrancar la fase N+1 sin criterio de aceptación cumplido en la fase N.

---

### Fase 0 — Setup de base
**Objetivo:** repo y servicios pelados, corriendo.
- [ ] Turborepo con `apps/web` (Next.js) y `apps/api` (Hono).
- [ ] Proyecto Supabase creado, connection string en `.env`.
- [ ] Bucket R2 creado + credenciales de API token con permisos de solo ese bucket.
- [ ] Deploy inicial vacío: Vercel (web) + Railway (api).
- [ ] Dominio o subdominio apuntando (Cloudflare DNS, mismo patrón que usás para `complexa.com.ar`).

**Criterio de aceptación:** un `GET /health` en la API responde 200 desde el dominio público.

---

### Fase 1 — Esquema de datos y Auth del organizador
**Objetivo:** el organizador se puede crear una cuenta, loguearse, y la base ya tiene las tablas.
- [ ] Migraciones Drizzle para `eventos`, `invitados`, `archivos`.
- [ ] RLS activado en `eventos`.
- [ ] Backend: registro (`sign up`) y login (`sign in`) del organizador con Supabase Auth (email + contraseña).
- [ ] **UI — Pantalla de registro del organizador:** nombre, email, contraseña, botón "Crear cuenta", link a login.
- [ ] **UI — Pantalla de login del organizador:** email, contraseña, botón "Entrar", link a registro.
- [ ] Middleware/guard: cualquier ruta del panel del organizador (wizard, moderación) exige sesión activa; si no hay sesión, redirige a login.
- [ ] Endpoint `POST /eventos` que crea un evento en estado `borrador` asociado al organizador logueado.
- [ ] **UI — Pantalla "Mis eventos" (home post-login):** si el organizador no tiene eventos todavía, estado vacío con botón "Crear mi primer evento" → wizard. Si ya tiene, lista de sus eventos con acceso a cada panel de moderación.

**Criterio de aceptación:** un organizador nuevo se registra desde cero (sin que nadie le haya creado la cuenta a mano), cierra sesión, vuelve a entrar con login, y ve la pantalla "Mis eventos" vacía con el botón de crear su primer evento.

---

### Fase 2 — Wizard de creación de evento (SaaS)
**Objetivo:** el organizador carga todos los datos del evento paso a paso y termina con el QR.
- [ ] UI wizard multi-paso (ver detalle del prompt de Stitch más abajo):
  - Paso 1: nombre del evento, fecha, horario.
  - Paso 2: subir foto de portada (sube a R2, guarda `foto_portada_url`).
  - Paso 3: límites — cantidad de invitados totales, límite de invitados con login, fotos por invitado, videos por invitado.
  - Paso 4: revisión y confirmar → evento pasa a `estado = activo`.
- [ ] Al confirmar, generar el `slug` único y el QR (librería tipo `qrcode` apuntando a `tudominio.com/evento/:slug`).
- [ ] Pantalla final: mostrar el QR grande + botón "Descargar QR" (PNG) + botón "Copiar link".

**Criterio de aceptación:** un organizador completa el wizard de punta a punta y descarga un QR que, escaneado, lleva a una landing (aunque esa landing todavía esté vacía — se construye en la fase 3).

---

### Fase 3 — Landing pública + registro de invitado
**Objetivo:** el invitado escanea el QR, ve la landing del evento, y se registra respetando `limite_invitados_login`.
- [ ] Página pública `/evento/:slug`: foto de portada, nombre del evento, fecha/hora, botón "Quiero subir mis fotos".
- [ ] Formulario de registro: nombre, apellido, teléfono (opcional), checkbox de Términos y Condiciones (texto real a definir con vos, pendiente de revisión — **no es asesoramiento legal, conviene que lo revise alguien idóneo antes de producción**).
- [ ] Endpoint `POST /eventos/:slug/invitados`: valida cupo (`limite_invitados_login`) antes de insertar. Si no hay cupo, devuelve 409 con mensaje claro.
- [ ] Al crear el invitado, generar `token_sesion` y devolverlo para que el frontend lo guarde (cookie o localStorage — ojo, en artifacts de Claude no se puede usar localStorage, pero esto es una app real fuera de Claude así que sí aplica ahí).

**Criterio de aceptación:** con el evento en modo `activo` y `limite_invitados_login = 2` de prueba, el tercer intento de registro es rechazado con el mensaje de cupo lleno.

---

### Fase 4 — Subida de fotos/videos con límites por invitado
**Objetivo:** el invitado registrado sube contenido, respetando su cupo individual.
- [ ] Endpoint `POST /eventos/:slug/archivos/solicitar-subida`: recibe `tipo` (foto/video) + token de sesión del invitado, valida cupo (`fotos_subidas` / `videos_subidos` vs límites del evento), devuelve URL prefirmada de R2 (expira en pocos minutos) si hay cupo.
- [ ] Endpoint `POST /eventos/:slug/archivos/confirmar`: el frontend lo llama después de subir el archivo a R2 con éxito. Ahí se inserta la fila en `archivos` y se incrementa el contador correspondiente en `invitados`.
- [ ] UI de subida: botón cámara + botón galería, grilla de "ya subiste esto", contador visible tipo "3 de 10 fotos usadas".
- [ ] Validación de tipo/tamaño real de archivo en frontend y backend (no confiar solo en la extensión).

**Criterio de aceptación:** con `limite_fotos_por_invitado = 3`, al intentar subir la cuarta foto el backend rechaza el pedido de URL prefirmada, y el frontend lo muestra con claridad ("Ya usaste tus 3 fotos").

---

### Fase 5 — Panel de moderación del organizador (multi-pantalla)
**Objetivo:** el organizador ve y gestiona lo que suben sus invitados. Son 4 pantallas separadas, no un dashboard único — cada una con su propósito:

**5.1 — Resumen del evento** (home al entrar a un evento puntual)
- [ ] Tarjetas de estadísticas: invitados registrados / límite, fotos subidas, videos subidos.
- [ ] Accesos directos a "Ver galería" y "Ver invitados".

**5.2 — Galería**
- [ ] Grilla de `archivos` (fotos y videos mezclados, ícono distintivo en las miniaturas de video).
- [ ] Filtros: por invitado, por fecha, por tipo, por estado (pendiente/aprobada/oculta).
- [ ] Al tocar una miniatura, abre la pantalla de detalle (5.3).

**5.3 — Detalle de foto/video**
- [ ] Vista a pantalla completa de un archivo puntual, con nombre del invitado y fecha/hora.
- [ ] Acciones: aprobar / ocultar / eliminar (eliminar borra también el objeto en R2, no solo la fila).
- [ ] Navegación siguiente/anterior (swipe o flechas) sin volver a la grilla — el organizador va a revisar muchas fotos seguidas.

**5.4 — Lista de invitados**
- [ ] Listado con nombre, teléfono, y el conteo de `fotos_subidas`/`videos_subidos` vs los límites del evento.
- [ ] Buscador por nombre.

**Transversal a las 4 pantallas:**
- [ ] Descarga en ZIP de todo lo aprobado (puede ir a una cola BullMQ si el evento es grande, para no bloquear el request).

**Criterio de aceptación:** el organizador entra a "Mis eventos" → elige un evento → ve el resumen → entra a la galería → abre el detalle de una foto → la elimina → confirma que desaparece tanto de la grilla como del bucket R2 → vuelve a la lista de invitados y ve el contador de esa persona actualizado.

---

### Fase 6 — Hardening y seguridad
**Objetivo:** que esto aguante un evento real sin sustos.
- [ ] Rate limiting por IP/invitado en los endpoints de registro y subida.
- [ ] Compresión de imagen en el cliente antes de subir (reduce uso de storage).
- [ ] Expiración corta en las URLs prefirmadas (2-5 min).
- [ ] Logs de auditoría básicos: quién subió qué y cuándo.
- [ ] Chequeo de que las políticas RLS realmente bloquean acceso cruzado entre organizadores (probar con dos cuentas).

---

### Fase 7 — Deploy final y QA con evento real
- [ ] Probar el flujo completo con un evento de prueba y varios celulares distintos (Android/iOS, buena/mala conexión).
- [ ] Confirmar que el proyecto Supabase no se pausa por inactividad antes del evento (cron ping o GitHub Action, mismo patrón que ya usás en otros proyectos tuyos).
- [ ] Revisar consumo real de R2 post-evento vs lo estimado, para calibrar los límites por defecto que le sugerís a futuros organizadores.

---

## 6. Convenciones
- Español para nombres de tablas/columnas de negocio (como está arriba), inglés para código genérico de infraestructura (nombres de funciones, variables internas).
- Un commit por fase mínimo, no mezclar fases en un mismo PR.
- Cada endpoint nuevo necesita su validación de límites ANTES de tocar R2 o la DB — nunca al revés.

## 7. Variables de entorno esperadas
```
APP_NAME=Album
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
PUBLIC_APP_URL=
```

## 8. Fuera de alcance (por ahora)
- Cobro por evento (Mercado Pago) — se agrega cuando el flujo completo funcione gratis.
- Moderación automática de contenido (NSFW detection) — nice-to-have, no bloqueante para el MVP.
- Notificaciones push/email al organizador cuando se acerca al límite de invitados o storage.


## Mañana seguimos acá:
Anotá este mensaje para mañana:

      ---
      Para retomar mañana — Album SaaS, branch implementacion

      Dónde estamos: Ejecutando Task 0.5 (pnpm install + verify + codegraph) en background. Es la última tarea de la Fase 0. Las Fases 0.1–0.4 están todas completas y aprobadas.

    Cómo retomar:
      1. Abrí Claude Code en /home/pia/Escritorio/album
      2. Decile: "Retomá el plan de implementación de Album desde donde quedamos. Revisá el ledger en .superpowers/sdd/progress.md y el git log para saber el estado exacto."

      Lo que Claude va a encontrar:
      - Ledger en .superpowers/sdd/progress.md con todas las tareas completadas marcadas
      - Branch implementacion con commits desde 1ef6aa2 hasta donde haya llegado
      - Plan completo en docs/superpowers/plans/2026-07-19-album-implementation.md
      - Skill activo: superpowers:subagent-driven-development

      Siguiente tarea después de 0.5: Task 1.1 — Drizzle migration + Supabase RLS (vas a necesitar las credenciales de Supabase en .env.local)