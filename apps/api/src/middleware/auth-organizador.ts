import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'

type Env = {
  Variables: {
    organizador_id: string
  }
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, serviceRoleKey)
}

export const authOrganizadorMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Sesión de organizador requerida' }, 401)
  }

  const token = authHeader.slice(7)
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return c.json({ error: 'Sesión inválida o expirada' }, 401)
  }

  c.set('organizador_id', data.user.id)
  return next()
})
