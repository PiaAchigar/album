import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { db } from './db/index.js'
import { sql } from 'drizzle-orm'
import { corsMiddleware } from './middleware/cors.js'
import { createEventosRoutes } from './routes/eventos.routes.js'

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

const port = Number(process.env.PORT ?? 3001)
console.log(`API running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })

export default app
