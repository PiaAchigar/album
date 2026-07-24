import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { db } from './db/index.js'
import { sql } from 'drizzle-orm'
import { corsMiddleware } from './middleware/cors.js'
import { createEventosRoutes } from './routes/eventos.routes.js'
import { createArchivosRoutes } from './routes/archivos.routes.js'
import { logger } from './lib/logger.js'

const app = new Hono()

// CORS — allow requests from Next.js frontend
app.use('*', corsMiddleware)

// Health check — verifies DB connectivity with a 3-second timeout
app.get('/health', async (c) => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    )
    await Promise.race([
      db.execute(sql`SELECT 1`),
      timeoutPromise,
    ])
    return c.json({ status: 'ok', db: 'ok' }, 200)
  } catch {
    return c.json({ status: 'degraded', db: 'error' }, 503)
  }
})

app.route('/', createEventosRoutes())
app.route('/', createArchivosRoutes())

// Without this, an unhandled exception inside a route (e.g. jwt.ts throwing
// on a missing/short INVITADO_JWT_SECRET) just becomes a bare 500 with
// nothing in the Railway logs — impossible to diagnose remotely.
app.onError((err, c) => {
  logger.error({ err, path: c.req.path, method: c.req.method }, 'Excepción no manejada')
  return c.json({ error: 'Internal Server Error' }, 500)
})

const port = Number(process.env.PORT ?? 3001)
logger.info({ port, env: process.env.NODE_ENV }, 'API lista')

serve({ fetch: app.fetch, port })

export default app
