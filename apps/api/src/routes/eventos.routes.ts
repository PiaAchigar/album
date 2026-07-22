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

const registroSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  telefono: z.string().max(30).optional(),
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

      // 1. Find evento by slug — must exist and be active
      const [evento] = await db.select().from(eventos).where(eq(eventos.slug, slug))

      if (!evento) {
        return c.json({ error: 'Evento no encontrado' }, 404)
      }

      if (evento.estado !== 'activo') {
        return c.json({ error: 'Este evento no está activo' }, 404)
      }

      // 2. Check capacity BEFORE inserting — count-then-insert is the
      // central business rule for this endpoint (see task brief / CLAUDE.md).
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(invitados)
        .where(eq(invitados.evento_id, evento.id))

      if (currentCount >= evento.limite_invitados_login) {
        logger.warn({ evento_id: evento.id, ip: getIP(c) }, 'Registro rechazado: cupo lleno')
        return c.json(
          { error: 'Cupo de invitados alcanzado, hablá con el organizador' },
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
          telefono: body.telefono ?? null,
          acepto_terminos: true,
          token_sesion: placeholder,
        })
        .returning({ id: invitados.id })

      // 4. Generate the guest JWT now that we have the invitado id
      const token = await signInvitadoToken({
        invitado_id: inserted.id,
        evento_id: evento.id,
      })

      // 5. Persist the real token as token_sesion
      await db.update(invitados).set({ token_sesion: token }).where(eq(invitados.id, inserted.id))

      logger.info({ invitado_id: inserted.id, evento_id: evento.id, ip: getIP(c) }, 'Invitado registrado')

      return c.json({ token, invitado_id: inserted.id }, 201)
    },
  )

  return router
}
