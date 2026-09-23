import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { donaciones } from '@album/database'
import { crearPreferenciaDonacion } from '../lib/mercadopago.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { logger } from '../lib/logger.js'
import { getIP } from '../lib/ip.js'

const donacionRateLimitMiddleware = createRateLimiter(10, 60_000, 'donacion')

const crearDonacionSchema = z.object({
  monto: z
    .number({ invalid_type_error: 'El monto es obligatorio' })
    .int('El monto debe ser un número entero')
    .positive('El monto debe ser mayor a 0'),
  origen: z.enum(['landing', 'registro_organizador']),
  organizador_id: z.string().uuid().optional(),
})

export function createDonacionesRoutes() {
  const router = new Hono()

  router.post(
    '/donaciones',
    donacionRateLimitMiddleware,
    zValidator('json', crearDonacionSchema),
    async (c) => {
      const body = c.req.valid('json')
      const donacionId = randomUUID()

      try {
        const { preferenceId, initPoint } = await crearPreferenciaDonacion({
          monto: body.monto,
          donacionId,
        })

        await db.insert(donaciones).values({
          id: donacionId,
          monto: body.monto,
          origen: body.origen,
          organizador_id: body.organizador_id ?? null,
          estado: 'pendiente',
          mp_preference_id: preferenceId,
        })

        logger.info(
          { donacion_id: donacionId, monto: body.monto, origen: body.origen },
          'Preferencia de donación creada',
        )

        return c.json({ init_point: initPoint }, 201)
      } catch (err) {
        logger.error(
          { err, donacion_id: donacionId, ip: getIP(c) },
          'Error creando preferencia de Mercado Pago',
        )
        return c.json(
          { error: 'No pudimos iniciar el pago, probá de nuevo en unos segundos' },
          502,
        )
      }
    },
  )

  return router
}