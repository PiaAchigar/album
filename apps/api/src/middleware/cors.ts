import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = process.env.API_CORS_ORIGIN ?? 'http://localhost:3000'
    // Allow exact match or all origins in development
    if (allowed === '*' || origin === allowed) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})
