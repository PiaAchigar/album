import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eventos, invitados, archivos } from '@album/database'
import { getInvitadoPresignedUpload } from '../lib/r2.js'
import { uploadRateLimitMiddleware } from '../middleware/rate-limit.js'
import { jwtInvitadoMiddleware } from '../middleware/jwt-invitado.js'
import { logger } from '../lib/logger.js'

const ALLOWED_EXTENSIONS: Record<'foto' | 'video', string[]> = {
  foto: ['jpg', 'jpeg', 'png', 'heic', 'webp'],
  video: ['mp4', 'mov', 'avi', 'webm'],
}

export function createArchivosRoutes() {
  const app = new Hono()

  app.post(
    '/eventos/:slug/archivos/solicitar-subida',
    uploadRateLimitMiddleware,
    jwtInvitadoMiddleware,
    zValidator(
      'json',
      z.object({
        tipo: z.enum(['foto', 'video']),
        extension: z.string().min(1).max(10),
      }),
    ),
    async (c) => {
      const { slug } = c.req.param()
      const { tipo, extension } = c.req.valid('json')
      const { invitado_id, evento_id } = c.get('invitado')

      const ext = extension.toLowerCase().replace(/^\./, '')
      if (!ALLOWED_EXTENSIONS[tipo].includes(ext)) {
        return c.json(
          {
            error: `Extensión no permitida para ${tipo}. Permitidas: ${ALLOWED_EXTENSIONS[tipo].join(', ')}`,
          },
          400,
        )
      }

      const [evento] = await db
        .select()
        .from(eventos)
        .where(eq(eventos.slug, slug))
        .limit(1)

      if (!evento) return c.json({ error: 'Evento no encontrado' }, 404)
      if (evento.estado !== 'activo') {
        return c.json({ error: 'El evento no está activo' }, 403)
      }
      if (evento_id !== evento.id) {
        return c.json({ error: 'Token no válido para este evento' }, 403)
      }

      const [invitado] = await db
        .select()
        .from(invitados)
        .where(eq(invitados.id, invitado_id))
        .limit(1)

      if (!invitado) return c.json({ error: 'Invitado no encontrado' }, 404)

      // Central correctness requirement: the limit check MUST happen before
      // any presigned URL is generated — never grant upload access first and
      // validate after.
      if (tipo === 'foto') {
        if (invitado.fotos_subidas >= evento.limite_fotos_por_invitado) {
          logger.warn(
            { invitado_id, tipo, evento_id: evento.id },
            'Subida rechazada: cupo de archivos agotado',
          )
          return c.json(
            { error: `Ya usaste tus ${evento.limite_fotos_por_invitado} fotos` },
            403,
          )
        }
      } else {
        if (invitado.videos_subidos >= evento.limite_videos_por_invitado) {
          logger.warn(
            { invitado_id, tipo, evento_id: evento.id },
            'Subida rechazada: cupo de archivos agotado',
          )
          return c.json(
            { error: `Ya usaste tus ${evento.limite_videos_por_invitado} videos` },
            403,
          )
        }
      }

      const { uploadUrl, r2Key } = await getInvitadoPresignedUpload(
        evento.id,
        invitado_id,
        ext,
      )
      logger.info({ invitado_id, tipo, evento_id: evento.id }, 'Presigned URL generada')
      return c.json({ upload_url: uploadUrl, r2_key: r2Key }, 200)
    },
  )

  app.post(
    '/eventos/:slug/archivos/confirmar',
    uploadRateLimitMiddleware,
    jwtInvitadoMiddleware,
    zValidator(
      'json',
      z.object({
        r2_key: z.string().min(1),
        tipo: z.enum(['foto', 'video']),
        extension: z.string().min(1).max(10),
      }),
    ),
    async (c) => {
      const { slug } = c.req.param()
      const { r2_key, tipo } = c.req.valid('json')
      const { invitado_id, evento_id } = c.get('invitado')

      const [evento] = await db
        .select()
        .from(eventos)
        .where(eq(eventos.slug, slug))
        .limit(1)

      if (!evento) return c.json({ error: 'Evento no encontrado' }, 404)
      if (evento.estado !== 'activo') {
        return c.json({ error: 'El evento no está activo' }, 403)
      }
      if (evento_id !== evento.id) {
        return c.json({ error: 'Token no válido para este evento' }, 403)
      }

      const expectedPrefix = `eventos/${evento.id}/${invitado_id}/`
      if (!r2_key.startsWith(expectedPrefix)) {
        return c.json({ error: 'r2_key no válida' }, 403)
      }

      const [inserted] = await db
        .insert(archivos)
        .values({
          evento_id: evento.id,
          invitado_id,
          tipo,
          r2_key,
          estado: 'pendiente',
        })
        .returning({ id: archivos.id })

      logger.info({ archivo_id: inserted.id, r2_key, invitado_id }, 'Archivo confirmado en DB')

      if (tipo === 'foto') {
        await db
          .update(invitados)
          .set({ fotos_subidas: sql`${invitados.fotos_subidas} + 1` })
          .where(eq(invitados.id, invitado_id))
      } else {
        await db
          .update(invitados)
          .set({ videos_subidos: sql`${invitados.videos_subidos} + 1` })
          .where(eq(invitados.id, invitado_id))
      }

      return c.json({ archivo_id: inserted.id }, 201)
    },
  )

  return app
}
