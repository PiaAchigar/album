import { createMiddleware } from 'hono/factory'
import { verifyInvitadoToken, type InvitadoJWTPayload } from '../lib/jwt.js'

type Env = {
  Variables: {
    invitado: InvitadoJWTPayload
  }
}

export const jwtInvitadoMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token de sesión requerido' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verifyInvitadoToken(token)
    c.set('invitado', payload)
    return next()
  } catch {
    return c.json({ error: 'Token de sesión inválido o expirado' }, 401)
  }
})
