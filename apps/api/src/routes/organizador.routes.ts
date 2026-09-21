import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { organizadorStorageConfig, eventos, archivos } from '@album/database'
import { authOrganizadorMiddleware } from '../middleware/auth-organizador.js'
import { encryptSecret, decryptSecret } from '../lib/crypto.js'
import {
  buildS3Client,
  testR2Credentials,
  getS3ClientForOrganizador,
  getPortadaPresignedUpload,
  getPresignedReadUrl,
  deleteR2Object,
  StorageNoConfiguradoError,
} from '../lib/r2.js'
import { logger } from '../lib/logger.js'

type Env = { Variables: { organizador_id: string } }

const storageConfigSchema = z.object({
  r2_account_id: z.string().min(1),
  r2_access_key_id: z.string().min(1),
  r2_secret_access_key: z.string().min(1),
  r2_bucket_name: z.string().min(1),
})

export function createOrganizadorRoutes() {
  const router = new Hono<Env>()

  // ─── POST /organizador/storage-config ──────────────────────
  router.post(
    '/organizador/storage-config',
    authOrganizadorMiddleware,
    zValidator('json', storageConfigSchema),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const body = c.req.valid('json')

      const clientInfo = buildS3Client({
        accountId: body.r2_account_id,
        accessKeyId: body.r2_access_key_id,
        secretAccessKey: body.r2_secret_access_key,
        bucket: body.r2_bucket_name,
      })

      try {
        await testR2Credentials(clientInfo)
      } catch (err) {
        logger.warn({ err, organizadorId }, 'Validación de credenciales R2 falló')
        return c.json(
          {
            error:
              'No pudimos conectarnos a tu bucket con esas credenciales. Revisá el Account ID, las keys y el nombre del bucket.',
          },
          422,
        )
      }

      const accountId = encryptSecret(body.r2_account_id)
      const accessKeyId = encryptSecret(body.r2_access_key_id)
      const secretAccessKey = encryptSecret(body.r2_secret_access_key)
      const bucketName = encryptSecret(body.r2_bucket_name)
      const now = new Date()

      const values = {
        organizador_id: organizadorId,
        r2_account_id_cipher: accountId.cipher,
        r2_account_id_iv: accountId.iv,
        r2_account_id_tag: accountId.tag,
        r2_access_key_id_cipher: accessKeyId.cipher,
        r2_access_key_id_iv: accessKeyId.iv,
        r2_access_key_id_tag: accessKeyId.tag,
        r2_secret_access_key_cipher: secretAccessKey.cipher,
        r2_secret_access_key_iv: secretAccessKey.iv,
        r2_secret_access_key_tag: secretAccessKey.tag,
        r2_bucket_name_cipher: bucketName.cipher,
        r2_bucket_name_iv: bucketName.iv,
        r2_bucket_name_tag: bucketName.tag,
        verificado_at: now,
      }

      await db
        .insert(organizadorStorageConfig)
        .values(values)
        .onConflictDoUpdate({
          target: organizadorStorageConfig.organizador_id,
          set: { ...values, updated_at: now },
        })

      logger.info({ organizadorId }, 'Credenciales R2 guardadas y verificadas')
      return c.json({ success: true }, 200)
    },
  )

  // ─── GET /organizador/storage-config/status ────────────────
  router.get('/organizador/storage-config/status', authOrganizadorMiddleware, async (c) => {
    const organizadorId = c.get('organizador_id')

    const [row] = await db
      .select({
        verificado_at: organizadorStorageConfig.verificado_at,
        bucketCipher: organizadorStorageConfig.r2_bucket_name_cipher,
        bucketIv: organizadorStorageConfig.r2_bucket_name_iv,
        bucketTag: organizadorStorageConfig.r2_bucket_name_tag,
        accessKeyCipher: organizadorStorageConfig.r2_access_key_id_cipher,
        accessKeyIv: organizadorStorageConfig.r2_access_key_id_iv,
        accessKeyTag: organizadorStorageConfig.r2_access_key_id_tag,
      })
      .from(organizadorStorageConfig)
      .where(eq(organizadorStorageConfig.organizador_id, organizadorId))
      .limit(1)

    if (!row || !row.verificado_at) {
      return c.json({ configurado: false as const }, 200)
    }

    const bucket = decryptSecret({ cipher: row.bucketCipher, iv: row.bucketIv, tag: row.bucketTag })
    const accessKeyId = decryptSecret({
      cipher: row.accessKeyCipher,
      iv: row.accessKeyIv,
      tag: row.accessKeyTag,
    })

    return c.json(
      { configurado: true as const, bucket, terminaEn: accessKeyId.slice(-4) },
      200,
    )
  })

  // ─── POST /organizador/eventos/:id/portada/solicitar-subida ─
  router.post(
    '/organizador/eventos/:id/portada/solicitar-subida',
    authOrganizadorMiddleware,
    zValidator('json', z.object({ extension: z.string().min(1).max(10) })),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const { id: eventoId } = c.req.param()
      const { extension } = c.req.valid('json')

      const [evento] = await db
        .select({ id: eventos.id })
        .from(eventos)
        .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))
        .limit(1)

      if (!evento) return c.json({ error: 'Evento no encontrado' }, 404)

      try {
        const clientInfo = await getS3ClientForOrganizador(organizadorId)
        const ext = extension.toLowerCase().replace(/^\./, '')
        const { uploadUrl, r2Key } = await getPortadaPresignedUpload(clientInfo, eventoId, ext)
        return c.json({ uploadUrl, r2Key }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
        }
        throw err
      }
    },
  )

  // ─── POST /organizador/archivos/urls-lectura ───────────────
  router.post(
    '/organizador/archivos/urls-lectura',
    authOrganizadorMiddleware,
    zValidator('json', z.object({ archivo_ids: z.array(z.string()).min(1).max(200) })),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const { archivo_ids } = c.req.valid('json')

      const rows = await db
        .select({ id: archivos.id, r2_key: archivos.r2_key })
        .from(archivos)
        .innerJoin(eventos, eq(archivos.evento_id, eventos.id))
        .where(and(inArray(archivos.id, archivo_ids), eq(eventos.organizador_id, organizadorId)))

      if (rows.length === 0) return c.json({ urls: {} }, 200)

      try {
        const clientInfo = await getS3ClientForOrganizador(organizadorId)
        const urls: Record<string, string> = {}
        for (const row of rows) {
          urls[row.id] = await getPresignedReadUrl(clientInfo, row.r2_key)
        }
        return c.json({ urls }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
        }
        throw err
      }
    },
  )

  // ─── DELETE /organizador/archivos ──────────────────────────
  router.delete(
    '/organizador/archivos',
    authOrganizadorMiddleware,
    zValidator('json', z.object({ archivo_ids: z.array(z.string()).min(1).max(200) })),
    async (c) => {
      const organizadorId = c.get('organizador_id')
      const { archivo_ids } = c.req.valid('json')

      const rows = await db
        .select({ id: archivos.id, r2_key: archivos.r2_key })
        .from(archivos)
        .innerJoin(eventos, eq(archivos.evento_id, eventos.id))
        .where(and(inArray(archivos.id, archivo_ids), eq(eventos.organizador_id, organizadorId)))

      if (rows.length === 0) return c.json({ success: true as const }, 200)

      try {
        const clientInfo = await getS3ClientForOrganizador(organizadorId)
        for (const row of rows) {
          await deleteR2Object(clientInfo, row.r2_key)
        }
        return c.json({ success: true as const }, 200)
      } catch (err) {
        if (err instanceof StorageNoConfiguradoError) {
          return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
        }
        throw err
      }
    },
  )

  // ─── DELETE /organizador/eventos/:id/archivos-r2 ───────────
  router.delete('/organizador/eventos/:id/archivos-r2', authOrganizadorMiddleware, async (c) => {
    const organizadorId = c.get('organizador_id')
    const { id: eventoId } = c.req.param()

    const [evento] = await db
      .select({ id: eventos.id, foto_portada_url: eventos.foto_portada_url })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))
      .limit(1)

    if (!evento) return c.json({ error: 'Evento no encontrado' }, 404)

    const archivosDelEvento = await db
      .select({ r2_key: archivos.r2_key })
      .from(archivos)
      .where(eq(archivos.evento_id, eventoId))

    const keys = archivosDelEvento.map((a) => a.r2_key)
    if (evento.foto_portada_url) keys.push(evento.foto_portada_url)

    if (keys.length === 0) return c.json({ success: true as const }, 200)

    try {
      const clientInfo = await getS3ClientForOrganizador(organizadorId)
      for (const key of keys) {
        await deleteR2Object(clientInfo, key)
      }
      return c.json({ success: true as const }, 200)
    } catch (err) {
      if (err instanceof StorageNoConfiguradoError) {
        return c.json({ error: 'Todavía no configuraste tu storage de R2' }, 409)
      }
      throw err
    }
  })

  return router
}
