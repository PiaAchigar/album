# Spec: Reingreso de invitado por teléfono

**Fecha:** 2026-07-24
**Estado:** Aprobado por la usuaria (brainstorming), pendiente de plan de implementación.

## 1. Contexto

Un invitado se registra hoy vía `POST /eventos/:slug/invitados` (`apps/api/src/routes/eventos.routes.ts`), que crea una fila en `invitados` y devuelve un `token_sesion` (JWT) que el frontend guarda en `localStorage` (`apps/web/src/hooks/useInvitado.ts`, claves `album_token_${slug}` / `album_invitado_${slug}`). Ese token es la única forma de acceso — no hay cuenta real (ver CLAUDE.md, sección 1).

Problema: si el invitado cambia de dispositivo, borra datos del navegador, o simplemente pierde el link, no tiene forma de recuperar acceso a su cupo — solo puede volver a `/e/:slug/registro` y crear un invitado nuevo, empezando su cupo de fotos/videos de cero (y potencialmente chocando contra `limite_invitados_login` si el evento ya está lleno).

Esta spec agrega un camino de reingreso por número de teléfono, sin contraseña — decisión tomada en brainstorming: el álbum es de bajo riesgo (fotos de una fiesta, no datos sensibles) y pedirle una contraseña a un invitado casual es fricción que no se justifica.

## 2. Teléfono pasa a ser obligatorio (solo a nivel de validación)

`invitados.telefono` en `packages/database/src/schema.ts` sigue siendo `text('telefono')` nullable — **no hay migración de schema**. Ya existen filas en producción con `telefono` nulo (invitados de prueba tipo `CurlTest`/`Debug*` generados durante el debugging de los bugs anteriores), y un `NOT NULL` real rompería contra esos datos.

En su lugar, se exige a nivel de validación Zod en ambos lados:
- Backend: `registroSchema` en `eventos.routes.ts` cambia `telefono: z.string().max(30).optional()` a `telefono: z.string().min(1, 'El teléfono es obligatorio').max(30)`.
- Frontend: `schema` en `apps/web/src/app/e/[slug]/registro/page.tsx` cambia `telefono: z.string().max(30).optional().or(z.literal(''))` a `telefono: z.string().min(1, 'El teléfono es obligatorio').max(30)`.

Esto solo afecta invitados nuevos. Los invitados existentes con `telefono` nulo simplemente no van a poder usar el reingreso por teléfono hasta que se registren de nuevo — limitación conocida, no bloqueante.

## 3. Normalización y unicidad de teléfono

Nueva función `normalizarTelefono(telefono: string): string` en `apps/api/src/lib/telefono.ts` — saca todo lo que no sea dígito (`/\D/g` → `''`), para que `"099 123-456"` y `"0991233456"` comparen igual. Se usa en dos puntos:

1. **Al registrar** (`POST /eventos/:slug/invitados`): antes del insert, se busca si ya existe un invitado en el mismo `evento_id` cuyo `telefono` normalizado coincida con el normalizado del body. Si existe, se rechaza con **409** y mensaje `"Ese teléfono ya está registrado en este evento. Si ya te registraste, usá 'Entrá con tu teléfono' en la pantalla anterior."` — sin insertar nada.
2. **Al reingresar** (sección 4): mismo normalizado, usado para buscar la fila existente.

No se agrega índice único en DB ni columna `telefono_normalizado` — el chequeo es "buscar antes de insertar", mismo patrón que ya usa el chequeo de cupo (`currentCount >= evento.limite_invitados_login`) unas líneas arriba en el mismo handler. A la escala de un evento (cientos de invitados como mucho) no se justifica una columna ni índice extra — decisión YAGNI explícita.

## 4. Endpoint nuevo: `POST /eventos/:slug/invitados/reingresar`

En `apps/api/src/routes/eventos.routes.ts`, mismo router que ya expone el registro.

- **Body:** `{ telefono: string }` (Zod: `z.object({ telefono: z.string().min(1) })`).
- **Middleware:** `registroRateLimitMiddleware` (la misma que ya protege el registro — 10 req/min por IP) para no dejar que alguien pruebe números al voleo y le robe la sesión a otro invitado.
- **Lógica:**
  1. Busca `evento` por `slug`. Si no existe o no está `activo` → 404 (mismos mensajes que ya usa el registro).
  2. Normaliza el `telefono` del body.
  3. Busca en `invitados` por `evento_id` + `telefono` normalizado (comparando ambos lados con `normalizarTelefono` — el valor guardado en DB no está pre-normalizado, así que se normaliza en la query en JS después de traer los candidatos del evento, no en SQL).
  4. Si no hay match → **404** `{ error: 'No encontramos ese teléfono registrado en este evento. ¿Ya te registraste? Probá el formulario de registro.' }`.
  5. Si hay match → firma un JWT nuevo con `signInvitadoToken({ invitado_id, evento_id })` (función ya existente en `apps/api/src/lib/jwt.ts`, sin cambios) y devuelve **200** `{ token, invitado_id }` — misma forma que ya devuelve el registro (201), para que el frontend reutilice el mismo manejo de éxito.
- No se pisa el `token_sesion` guardado en la fila `invitados` (a diferencia del registro, que sí persiste el token ahí) — ese campo documenta el token *original* de creación; reingresos sucesivos solo devuelven JWTs nuevos al cliente sin tocar la fila. El JWT es válido por sí mismo (30 días, ya seteado en `signInvitadoToken`) independientemente de lo que diga esa columna.

## 5. Frontend: pantalla de reingreso

Nueva ruta `apps/web/src/app/e/[slug]/reingresar/page.tsx`, mismo patrón visual que `registro/page.tsx` (header fijo con X para volver a `/e/:slug`, título con la tipografía Playfair, `Form`/`FormField` de shadcn).

- **Campos:** selector de país (mismo array `PAISES` que registro, copiado o extraído a un módulo compartido — ver nota de simplificación abajo) + teléfono. El país es puramente cosmético (cambia el placeholder); no se envía al backend ni participa en el matching.
- **Botón:** "Entrar".
- **Éxito:** mismo `localStorage.setItem(album_token_${slug}, token)` / `album_invitado_${slug}` que ya hace registro, luego `router.push('/e/${slug}/subir')`.
- **Error (404):** muestra el mensaje del backend inline, igual que registro.
- **Nota de simplificación:** el array `PAISES` (UY/AR/PY con sus placeholders) está hoy hardcodeado dentro de `registro/page.tsx`. Se extrae a `apps/web/src/lib/paises.ts` para no duplicarlo entre las dos pantallas.

En `registro/page.tsx`, debajo del botón "Unirme al álbum", se agrega un link:
```
¿Ya te registraste?
Entrá con tu teléfono
```
que navega a `/e/${slug}/reingresar`.

## 6. Fix de paso: el 409 del frontend ignora el body

Hoy, en `registro/page.tsx`, el manejo de errores tiene un caso especial:
```ts
if (res.status === 409) {
  setServerError('Cupo de invitados alcanzado, hablá con el organizador.')
  return
}
```
Esto hardcodea el mensaje sin mirar el body. Con esta spec, un 409 puede significar dos cosas distintas (cupo lleno **o** teléfono duplicado) — hace falta distinguirlas. Se elimina el caso especial y el 409 pasa a tratarse igual que cualquier otro `!res.ok`: se lee `body.error` y se muestra tal cual lo manda el backend. El backend ya devuelve el texto correcto en ambos casos (sección 3 y el mensaje de cupo ya existente), así que no se pierde información — se saca una duplicación de un mensaje que ya vive en el backend.

## 7. Testing

- `apps/api/src/routes/eventos.routes.test.ts` (ya existente): agregar casos para
  - registro rechaza teléfono duplicado en el mismo evento (409) pero permite el mismo teléfono en eventos distintos,
  - registro rechaza body sin `telefono` (400, validación Zod),
  - `POST /reingresar` devuelve 200 + token válido para un teléfono existente,
  - `POST /reingresar` devuelve 404 para un teléfono que no existe en ese evento,
  - `POST /reingresar` normaliza formato (`"099 123-456"` matchea contra `"0991233456"` guardado).
- Frontend: verificación manual en el browser (registro → reingreso con el mismo teléfono → llega a `/subir` con los contadores correctos), no hay suite de tests de componentes en este repo para estas pantallas todavía (mismo criterio que ya se usó en Fase 3).

## 8. Fuera de alcance

- Recuperación de acceso para invitados creados *antes* de este cambio con `telefono` nulo.
- Cualquier verificación real de identidad (SMS OTP, etc.) — el teléfono es un identificador de conveniencia, no una prueba de propiedad del número.
- Editar el teléfono de un invitado ya creado.
