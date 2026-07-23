# Spec: Eliminar/Inactivar evento, Reproducción automática y Eliminar rápido en Galería

**Fecha:** 2026-07-23
**Estado:** Aprobado por la usuaria (brainstorming), pendiente de plan de implementación.

## 1. Contexto

El panel del organizador (`apps/web`, Fases 0–7 ya completas) tiene hoy:

- `Mis eventos` (`eventos/page.tsx`): lista de eventos del organizador, sin acciones de borrado/inactivación.
- `Galería` (`eventos/[id]/galeria/GaleriaClient.tsx`): grilla de archivos con filtros, sin reproducción automática ni borrado desde la miniatura.
- Flujo de moderación (Fase 5): archivos suben con `estado = 'pendiente'` y el organizador los pasa a `aprobada`/`oculta` desde el detalle (`DetalleClient.tsx`).

Esta spec agrega tres features sobre esa base, más un cambio de comportamiento que las tres comparten.

## 2. Cambio de comportamiento base: archivos entran ya "aprobada"

Hoy `POST /eventos/:slug/archivos/confirmar` (`apps/api/src/routes/archivos.routes.ts`) inserta cada archivo con `estado: 'pendiente'`. Pasa a insertarlo con `estado: 'aprobada'`.

- La acción **"Ocultar"** que ya existe en `DetalleClient.tsx` (pasa `estado` a `'oculta'`) sigue siendo la única forma de sacar una foto/video de circulación, y ahora además la excluye del carrusel de reproducción automática (sección 4).
- El valor `'pendiente'` se mantiene en el schema (no se toca `packages/database/src/schema.ts`) por compatibilidad con filas viejas y con el filtro "Pendiente" que ya existe en `GaleriaClient.tsx`, pero ningún flujo nuevo lo genera.
- El botón "Aprobar" del detalle sigue funcionando (queda disponible para filas legacy en `pendiente`), simplemente deja de ser el paso obligatorio de todo archivo nuevo.
- Los 51 tests de `apps/api` que asumen `estado: 'pendiente'` en la confirmación de subida (`archivos.routes.test.ts`) se actualizan a `'aprobada'`.

## 3. Eliminar / Inactivar evento (`Mis eventos`)

### 3.1 Inactivar (reutiliza `estado`)

El schema de `eventos` ya tiene `estado: 'borrador' | 'activo' | 'cerrado'`, y tanto la landing pública como el endpoint de subida ya bloquean todo lo que no sea `'activo'` (`evento.estado !== 'activo'` en `apps/web/src/app/e/[slug]/page.tsx`, `apps/web/src/app/e/[slug]/subir/page.tsx`, y en `apps/api/src/routes/{eventos,archivos}.routes.ts`). No hace falta tocar esos guards.

- Nueva función `cambiarEstadoEvento(eventoId: string, nuevoEstado: 'activo' | 'cerrado')` en `eventos.actions.ts`. Verifica ownership (mismo patrón `getOrganizadorId` + `where(eq(eventos.organizador_id, ...))` ya usado en el archivo) y solo permite alternar entre `activo` y `cerrado` — no toca eventos en `borrador` (el wizard sigue siendo el único camino hacia `activo` la primera vez).
- En la UI, el toggle se etiqueta **"Cerrar evento"** cuando `estado === 'activo'`, y **"Reactivar evento"** cuando `estado === 'cerrado'`. No aparece para eventos en `borrador`.

### 3.2 Eliminar (borrado permanente en cascada)

- Nueva función `eliminarEvento(eventoId: string)` en `eventos.actions.ts`:
  1. Verifica ownership.
  2. Trae todos los `archivos` del evento (`r2_key`) + `foto_portada_url` del evento.
  3. Borra en R2 todos esos objetos en paralelo (`Promise.all` de `deleteR2Object`, ya existe en `apps/web/src/lib/r2.ts`).
  4. Borra filas en orden `archivos` → `invitados` → `eventos` (respeta las FKs de `packages/database/src/schema.ts`).
  5. Si el borrado de R2 falla para algún objeto, no se continúa con el borrado de DB (mismo principio de orden crítico que ya usa `eliminarArchivo`: storage primero, DB después, para no dejar filas huérfanas apuntando a objetos que sí lograron borrarse).
- UI: en cada `Card` de `eventos/page.tsx` se agrega un menú `DropdownMenu` (ícono `⋮` de `lucide-react`, componente shadcn a instalar — el paquete `@radix-ui/react-dropdown-menu` ya es una dependencia del proyecto) con dos ítems: el toggle de 3.1 y **"Eliminar evento"**.
- "Eliminar evento" abre un `AlertDialog` (mismo patrón que `DetalleClient.tsx`) con texto explícito: borra el evento, sus invitados y todos sus archivos (DB + R2), acción irreversible.
- El trigger del menú y del diálogo deben frenar la propagación del click (`e.stopPropagation()` / `e.preventDefault()`) para no disparar el `Link` que envuelve toda la `Card` y navega al panel del evento.
- Tras eliminar, `revalidatePath('/eventos', 'page')` y el usuario permanece en `Mis eventos` (la card desaparece de la lista).

## 4. Reproducción automática (Galería)

Sigue el mockup ya existente en el repo (`design_web_album/autoreproducci_n_web/`, `design_album_mobile_first/autoreproducci_n_mobile/code.html`), que fue diseñado exactamente para esta pantalla ("Slideshow — Organizer View"): modal fullscreen oscuro, imagen centrada, pie con "Compartido por {nombre invitado}" (sin badge de estado — a diferencia del detalle, acá nunca se muestra "Pendiente"/"Aprobada"/etc.), controles anterior / pausa-play / siguiente, contador "n / total", barra de progreso, botón X para cerrar. Flechas de teclado (`←`/`→`) también navegan.

- Botón **"Reproducir"** en `GaleriaClient.tsx`, junto al título "Galería". Visible solo si hay al menos un archivo con `estado === 'aprobada'` en el evento (independientemente de los filtros de grilla activos).
- El carrusel es una vista independiente de los filtros de la grilla: siempre usa **todos** los archivos `aprobada` del evento, no los que estén filtrados en pantalla en ese momento.
- Fotos: 5000ms por slide con avance automático (barra de progreso lineal, igual al mockup).
- Videos: autoplay + muted, el video controla su propio avance (avanza al `ended`); si por algún motivo no dispara `ended` en un tiempo razonable, un timeout de seguridad de 15s fuerza el avance para que el carrusel nunca quede trabado.
- Controles manuales (anterior/siguiente/play-pause) disponibles en todo momento; pausar detiene el avance automático y el video en reproducción.
- Nuevo componente cliente `apps/web/src/app/(organizador)/eventos/[id]/galeria/_components/ReproduccionModal.tsx`. Recibe como prop la lista de archivos ya cargada por el server component de la página (mismo `ArchivoConInvitado[]`, filtrado a `estado === 'aprobada'` antes de pasarlo) — no dispara una query nueva a la DB.

## 5. Eliminar rápido desde la miniatura (Galería)

- En `GaleriaClient.tsx`, cada thumbnail suma un botón con ícono `Trash2` (mismo ícono que ya usa `DetalleClient.tsx`) en una esquina superior, sobre un fondo semitransparente para legibilidad.
- Visibilidad: on-hover en desktop (mismo patrón que ya usa el overlay con el nombre del invitado), siempre visible en viewports táctiles (no hay hover en mobile) — se resuelve con `opacity-0 group-hover:opacity-100` + un breakpoint que lo fuerza visible por debajo de `sm`, igual al criterio ya usado para el badge de estado.
- Click: `e.stopPropagation()` + `e.preventDefault()` (el thumbnail es un `Link` a la vista de detalle), abre un `AlertDialog` de confirmación chico (mismo texto que ya usa `DetalleClient.tsx`: "Esta acción borra el archivo de forma permanente... No se puede deshacer").
- Confirmar llama a `eliminarArchivo(archivoId)`, que **ya existe** en `archivos.actions.ts` (orden R2 → DB → contador de invitado, verificado en vivo en la Fase 5). No se toca esa función.

## 6. Fuera de alcance

- No se agrega un estado nuevo distinto de `activo`/`cerrado`/`borrador` — "inactivar" reutiliza `cerrado`.
- No se renombra la acción "Ocultar" existente ni su ícono/label — la usuaria confirmó que "desactivar del carrusel" es la misma acción.
- No se cambia el flujo de moderación pendiente→aprobar en sí (sigue existiendo, solo deja de ser el estado inicial de las subidas nuevas).
- No hay confirmación "escribí el nombre del evento" para eliminar evento — el `AlertDialog` estándar del proyecto alcanza, mismo nivel de fricción que ya se usa para eliminar un archivo individual.
- No se implementa deshacer/papelera para nada de esto — todos los borrados son permanentes, consistente con `eliminarArchivo` ya existente.

## 7. Testing

- `apps/api`: actualizar `archivos.routes.test.ts` para esperar `estado: 'aprobada'` en la inserción de `/archivos/confirmar`.
- `apps/web`: sin suite de tests de componentes hoy (no se agrega una nueva — consistente con el resto del proyecto, que valida vía `typecheck` + `build` + verificación manual/acceptance checklist, como en las Fases 4–5).
- Acceptance checklist manual al final del plan (mismo patrón que Fase 5.7): crear evento de prueba, subir archivos (confirmar que entran `aprobada`), reproducir carrusel, ocultar uno y confirmar que sale del carrusel, borrar uno desde la miniatura, cerrar/reactivar el evento, eliminar el evento y confirmar en Supabase + R2 que no queda nada.
