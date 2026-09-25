import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { donaciones } from '@album/database'
import { crearPreferenciaDonacion, obtenerPago } from '../lib/mercadopago.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { verificarFirmaWebhook } from '../lib/mercadopago-signature.js'
import { eq } from 'drizzle-orm'
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

  router.post('/donaciones/webhook', async (c) => {
    const body = await c.req.json().catch(() => null)

    if (!body || typeof body !== 'object' || body.type !== 'payment' || !body.data?.id) {
      return c.json({ ok: true }, 200)
    }

    const dataId = String(body.data.id)
    const xSignature = c.req.header('x-signature')
    const xRequestId = c.req.header('x-request-id')

    const firmaValida = verificarFirmaWebhook({ xSignature, xRequestId }, dataId)
    if (!firmaValida) {
      logger.warn({ dataId, ip: getIP(c) }, 'Webhook de Mercado Pago con firma inválida')
      return c.json({ error: 'Firma inválida' }, 401)
    }

    const pago = await obtenerPago(dataId)

    if (!pago.external_reference) {
      logger.warn({ dataId }, 'Pago de Mercado Pago sin external_reference')
      return c.json({ ok: true }, 200)
    }

    const nuevoEstado = pago.status === 'approved' ? 'aprobada' : 'rechazada'

    await db
      .update(donaciones)
      .set({ estado: nuevoEstado, mp_payment_id: pago.id })
      .where(eq(donaciones.id, pago.external_reference))

    logger.info(
      { donacion_id: pago.external_reference, estado: nuevoEstado, mp_payment_id: pago.id },
      'Donación actualizada desde webhook',
    )

    return c.json({ ok: true }, 200)
  })

  return router
}