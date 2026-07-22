# QA Checklist — Album

Ejecutar antes de cada evento real. Marcar cada ítem al completarlo.
Testers: al menos 1 Android Chrome + 1 iOS Safari.

---

## Bloque 1 — Organizador: cuenta y login

- [ ] 1.1 Abrir `https://www.album.com.ar/registro`. Completar nombre, email, contraseña. Hacer click en "Crear cuenta".
- [ ] 1.2 Verificar que redirige a `/eventos` con estado vacío y botón "Crear mi primer evento".
- [ ] 1.3 Hacer click en "Cerrar sesión". Verificar que redirige a `/login`.
- [ ] 1.4 Volver a entrar con email + contraseña → `/eventos` vacío nuevamente. ✓

---

## Bloque 2 — Wizard de creación de evento

- [ ] 2.1 Hacer click en "Crear mi primer evento". Verificar que abre el wizard en el Paso 1.
- [ ] 2.2 **Paso 1:** ingresar nombre del evento, fecha y horario. Hacer click en "Siguiente".
- [ ] 2.3 **Paso 2:** subir foto de portada (mínimo 1 MB). Verificar que la preview se muestra y el botón "Siguiente" se habilita.
- [ ] 2.4 **Paso 3:** configurar límites: `limite_invitados_login = 2`, `limite_fotos_por_invitado = 3`, `limite_videos_por_invitado = 1`. Hacer click en "Siguiente".
- [ ] 2.5 **Paso 4 (revisión):** verificar que todos los datos ingresados se muestran correctamente. Hacer click en "Confirmar y activar evento".
- [ ] 2.6 Verificar que aparece la pantalla del QR con: el QR grande, el link del evento, botón "Descargar QR" y botón "Copiar link". ✓

---

## Bloque 3 — QR y landing del evento

- [ ] 3.1 Hacer click en "Descargar QR" → verificar que descarga un PNG con el QR legible.
- [ ] 3.2 Hacer click en "Copiar link" → pegar en una nueva pestaña → verificar que abre `/evento/:slug` con la foto de portada, el nombre del evento y la fecha/hora correctos.
- [ ] 3.3 **Con Android Chrome:** escanear el QR con la cámara del celular → verificar que abre la landing del evento correctamente.
- [ ] 3.4 **Con iOS Safari:** escanear el QR → verificar que abre la landing. Confirmar que el botón "Quiero subir mis fotos" es visible sin scroll. ✓

---

## Bloque 4 — Registro de invitados y cupo

- [ ] 4.1 Desde el celular Android, hacer click en "Quiero subir mis fotos" → completar nombre, apellido, teléfono (opcional), tildar T&C → hacer click en "Registrarme". Verificar que redirige a la pantalla de subida.
- [ ] 4.2 Repetir desde el celular iOS (segundo invitado). Verificar que también funciona. ✓ (2 de 2 registros completados)
- [ ] 4.3 Intentar un tercer registro (desde cualquier dispositivo o pestaña nueva del browser). Verificar que el formulario muestra el mensaje: **"Cupo de invitados alcanzado, hablá con el organizador"** y no permite continuar. ✓

---

## Bloque 5 — Subida de fotos y límites

- [ ] 5.1 Como **Invitado 1** (Android): subir 1 foto desde galería. Verificar que el contador muestra "1 de 3 fotos usadas". Verificar que la foto aparece en la grilla de subidas.
- [ ] 5.2 Subir 2 fotos más (total 3). Verificar que el contador muestra "3 de 3 fotos usadas" y el botón de subir foto queda deshabilitado o muestra mensaje de cupo completo.
- [ ] 5.3 Intentar subir una cuarta foto. Verificar que el backend responde con el mensaje **"Ya usaste tus 3 fotos"** y no se genera URL prefirmada. Verificar que no hay nueva fila en la tabla `archivos` (chequear en Supabase Studio).
- [ ] 5.4 Como **Invitado 1**: subir 1 video. Verificar contador de videos "1 de 1 videos usados". Intentar subir un segundo video → debe rechazarse. ✓

---

## Bloque 6 — Panel de moderación del organizador

- [ ] 6.1 Desde el panel del organizador, ir a "Mis eventos" → abrir el evento de prueba → verificar que el **Resumen** muestra: 2 invitados registrados, 3 fotos subidas, 1 video subido.
- [ ] 6.2 Ir a **Galería** → verificar que aparecen las 3 fotos y 1 video en la grilla. Verificar que el video tiene un ícono distintivo sobre la miniatura.
- [ ] 6.3 Aplicar filtro por tipo "foto" → verificar que solo aparecen 3 fotos.
- [ ] 6.4 Hacer click en la primera foto → abre **Detalle** a pantalla completa con nombre del invitado y fecha/hora de subida.
- [ ] 6.5 En el Detalle: hacer click en "Aprobar" → verificar que el estado del archivo cambia a `aprobada` (badge verde).
- [ ] 6.6 Navegar a la siguiente foto (botón/flecha/swipe) sin volver a la grilla → verificar que carga la segunda foto.
- [ ] 6.7 Hacer click en "Ocultar" en la segunda foto → verificar que el estado cambia a `oculta`.
- [ ] 6.8 Hacer click en "Eliminar" en la tercera foto → confirmar el diálogo de confirmación → verificar que:
  - a. La foto desaparece de la Galería (al volver a la grilla ya no está).
  - b. El objeto en R2 ya no existe (abrir el Cloudflare dashboard → R2 → bucket → buscar la `r2_key` de esa foto → no debe aparecer).
  - c. El campo `fotos_subidas` del Invitado 1 bajó de 3 a 2 (verificar en la pantalla de Invitados o en Supabase Studio).
- [ ] 6.9 Ir a **Invitados** → verificar que Invitado 1 muestra "2 fotos / 1 video" y Invitado 2 muestra "0 fotos / 0 videos" (o lo que haya subido en las pruebas). ✓

---

## Bloque 7 — Compresión y performance

- [ ] 7.1 Abrir Chrome DevTools → Network. Seleccionar una foto de ≥5 MB para subir. Verificar que en el Network tab el PUT a R2 pesa ≤2 MB.
- [ ] 7.2 Verificar que durante la compresión aparece el texto "Comprimiendo imagen..." en la UI y el botón de subida está deshabilitado.
- [ ] 7.3 **Simulación de 3G:** en Chrome DevTools → Network → throttling → "Slow 3G". Subir una foto. Verificar que la UI no se congela y hay feedback visible de progreso o estado de subida.

---

## Bloque 8 — Seguridad y aislamiento

- [ ] 8.1 **Rate limiting:** desde una terminal, correr `for i in $(seq 1 12); do curl -s -X POST https://api.album.com.ar/eventos/<slug>/invitados -H 'Content-Type: application/json' -d '{"nombre":"Test","apellido":"Test","acepto_terminos":true}' | jq .error; done`. Las primeras 10 respuestas deben ser `null` (o el error de cupo/validación), la 11ª y 12ª deben devolver `"Demasiadas solicitudes, esperá un minuto"`.
- [ ] 8.2 **RLS:** con dos cuentas de organizador distintas (dos ventanas del browser), verificar que cada una solo ve sus propios eventos en "Mis eventos".
- [ ] 8.3 Verificar que las URLs prefirmadas de R2 expiran: copiar una `upload_url` → esperar 6 minutos → intentar hacer un PUT → debe rechazarse con error de R2 (403 o 404).

---

## Resultado final

| Bloque | Estado | Notas |
|--------|--------|-------|
| 1 — Auth organizador | ⬜ | |
| 2 — Wizard | ⬜ | |
| 3 — QR y landing | ⬜ | |
| 4 — Registro invitados | ⬜ | |
| 5 — Subida y límites | ⬜ | |
| 6 — Moderación | ⬜ | |
| 7 — Compresión / perf | ⬜ | |
| 8 — Seguridad | ⬜ | |
