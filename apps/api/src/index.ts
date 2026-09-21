import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger as honoRequestLogger } from 'hono/logger'
import { db } from './db/index.js'
import { sql } from 'drizzle-orm'
import { corsMiddleware } from './middleware/cors.js'
import { createEventosRoutes } from './routes/eventos.routes.js'
import { createArchivosRoutes } from './routes/archivos.routes.js'
import { createOrganizadorRoutes } from './routes/organizador.routes.js'
import { logger } from './lib/logger.js'

const app = new Hono()

// CORS — allow requests from Next.js frontend
app.use('*', corsMiddleware)

// Loguea cada request entrante en tiempo real (método, path, status, ms) —
// sin esto, solo se veían los logger.info/warn explícitos de cada ruta,
// nada para requests que no loguean nada por su cuenta (ej. un 404 en una
// ruta que no existe, o un request que nunca llega a ejecutar el handler).
app.use('*', honoRequestLogger((message, ...rest) => logger.debug([message, ...rest].join(' '))))

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
app.route('/', createOrganizadorRoutes())

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
