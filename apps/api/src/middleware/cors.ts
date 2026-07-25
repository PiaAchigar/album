import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: (origin) => {
    const raw = process.env.API_CORS_ORIGIN ?? 'http://localhost:3000'
    // API_CORS_ORIGIN accepts a single origin, "*", or a comma-separated
    // list (e.g. apex + www domain) — allow exact match against any entry.
    const allowed = raw.split(',').map((entry) => entry.trim())
    if (allowed.includes('*') || allowed.includes(origin)) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
