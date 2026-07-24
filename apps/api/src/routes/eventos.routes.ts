import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eventos, invitados } from '@album/database'
import { signInvitadoToken } from '../lib/jwt.js'
import { registroRateLimitMiddleware } from '../middleware/rate-limit.js'
import { logger } from '../lib/logger.js'
import { getIP } from '../lib/ip.js'
import { normalizarTelefono } from '../lib/telefono.js'

const registroSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  telefono: z.string().min(1, 'El teléfono es obligatorio').max(30),
  acepto_terminos: z.literal(true, {
    errorMap: () => ({ message: 'Debés aceptar los Términos y Condiciones' }),
  }),
})

export function createEventosRoutes() {
  const router = new Hono()

  router.post(
    '/eventos/:slug/invitados',
    registroRateLimitMiddleware,
    zValidator('json', registroSchema),
    async (c) => {
      const { slug } = c.req.param()
      const body = c.req.valid('json')

      console.log('[POST /eventos/:slug/invitados] start', { slug, ip: getIP(c) })

      // 1. Find evento by slug — must exist and be active
      const [evento] = await db.select().from(eventos).where(eq(eventos.slug, slug))

      if (!evento) {
        console.log('[POST /eventos/:slug/invitados] evento no encontrado', { slug })
        return c.json({ error: 'Evento no encontrado' }, 404)
      }

      if (evento.estado !== 'activo') {
        console.log('[POST /eventos/:slug/invitados] evento no activo', {
          slug,
          estado: evento.estado,
        })
        return c.json({ error: 'Este evento no está activo' }, 404)
      }

      console.log('[POST /eventos/:slug/invitados] evento encontrado', { evento_id: evento.id })

      // 2. Check capacity BEFORE inserting — count-then-insert is the
      // central business rule for this endpoint (see task brief / CLAUDE.md).
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(invitados)
        .where(eq(invitados.evento_id, evento.id))

      console.log('[POST /eventos/:slug/invitados] cupo', {
        currentCount,
        limite: evento.limite_invitados_login,
      })

      if (currentCount >= evento.limite_invitados_login) {
        logger.warn({ evento_id: evento.id, ip: getIP(c) }, 'Registro rechazado: cupo lleno')
        return c.json(
          { error: 'Cupo de invitados alcanzado, hablá con el organizador' },
          409,
        )
      }

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

      // 3. Insert invitado with a placeholder token_sesion — the real JWT
      // needs the invitado's own id (issued below), so a temporary unique
      // value satisfies the NOT NULL UNIQUE constraint until step 5.
      const placeholder = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const [inserted] = await db
        .insert(invitados)
        .values({
          evento_id: evento.id,
          nombre: body.nombre,
          apellido: body.apellido,
          telefono: body.telefono,
          acepto_terminos: true,
          token_sesion: placeholder,
        })
        .returning({ id: invitados.id })

      console.log('[POST /eventos/:slug/invitados] invitado insertado (placeholder)', {
        invitado_id: inserted.id,
      })

      // 4. Generate the guest JWT now that we have the invitado id
      console.log('[POST /eventos/:slug/invitados] firmando JWT', {
        secretPresente: Boolean(process.env.INVITADO_JWT_SECRET),
        secretLength: process.env.INVITADO_JWT_SECRET?.length ?? 0,
      })
      const token = await signInvitadoToken({
        invitado_id: inserted.id,
        evento_id: evento.id,
      })
      console.log('[POST /eventos/:slug/invitados] JWT firmado OK')

      // 5. Persist the real token as token_sesion
      await db.update(invitados).set({ token_sesion: token }).where(eq(invitados.id, inserted.id))

      console.log('[POST /eventos/:slug/invitados] token_sesion persistido')

      logger.info({ invitado_id: inserted.id, evento_id: evento.id, ip: getIP(c) }, 'Invitado registrado')

      return c.json({ token, invitado_id: inserted.id }, 201)
    },
  )

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

  return router
}
