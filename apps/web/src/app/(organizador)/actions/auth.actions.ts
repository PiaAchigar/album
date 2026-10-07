'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type RegisterResult = { success: true; organizador_id: string } | { error: string }
type AuthResult = { success: true } | { error: string }

// Supabase devuelve mensajes en inglés (o, si el request tarda o falla a
// medio camino, un body vacío que termina en un mensaje inútil tipo "{}").
// Nunca mostramos error.message crudo al usuario — lo mapeamos a algo
// legible en español, y cualquier caso no reconocido cae en un genérico.
function mensajeAuthAmigable(mensajeOriginal: string | undefined): string {
  const m = (mensajeOriginal ?? '').toLowerCase()

  if (m.includes('user already registered') || m.includes('already registered')) {
    return 'Ya existe una cuenta con ese email. Probá iniciar sesión.'
  }
  if (m.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.'
  }
  if (m.includes('email not confirmed')) {
    return 'Todavía no confirmaste tu email — revisá tu bandeja de entrada.'
  }
  if (m.includes('password') && (m.includes('short') || m.includes('at least'))) {
    return 'La contraseña es demasiado corta.'
  }
  if (m.includes('rate limit')) {
    return 'Demasiados intentos. Esperá un momento y volvé a intentar.'
  }
  // m.length < 3 cubre el caso "{}" / "" — un mensaje sin contenido útil,
  // típico de una respuesta cortada o vacía (timeout, red inestable).
  if (!m || m.length < 3) {
    return 'No pudimos conectar con el servidor de autenticación. Probá de nuevo en unos segundos.'
  }
  return mensajeOriginal ?? 'Ocurrió un error inesperado.'
}

export async function registerOrganizador(formData: {
  nombre: string
  email: string
  password: string
}): Promise<RegisterResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: { nombre: formData.nombre },
      },
    })

    if (error) {
      console.error('[registerOrganizador]', error)
      return { error: mensajeAuthAmigable(error.message) }
    }

    if (!data.user) {
      console.error('[registerOrganizador] signUp sin error pero sin user')
      return { error: mensajeAuthAmigable(undefined) }
    }

    return { success: true, organizador_id: data.user.id }
  } catch (err) {
    console.error('[registerOrganizador] excepción no manejada', err)
    return { error: mensajeAuthAmigable(undefined) }
  }
}

export async function loginOrganizador(formData: {
  email: string
  password: string
}): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (error) {
      console.error('[loginOrganizador]', error)
      return { error: mensajeAuthAmigable(error.message) }
    }

    return { success: true }
  } catch (err) {
    console.error('[loginOrganizador] excepción no manejada', err)
    return { error: mensajeAuthAmigable(undefined) }
  }
}

/**
 * Sends the "reset password" email. Always reports success (unless the
 * request itself fails) so the form doesn't reveal which emails have an
 * account. The link lands on /auth/confirm, which opens a session and
 * forwards to /restablecer.
 */
export async function solicitarRecuperacion(email: string): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const appUrl = process.env.PUBLIC_APP_URL ?? 'https://www.album.com.ar'

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/confirm?next=/restablecer`,
    })

    if (error && error.message.toLowerCase().includes('rate limit')) {
      return { error: mensajeAuthAmigable(error.message) }
    }
    if (error) console.error('[solicitarRecuperacion]', error)

    return { success: true }
  } catch (err) {
    console.error('[solicitarRecuperacion] excepción no manejada', err)
    return { error: mensajeAuthAmigable(undefined) }
  }
}

/** Sets a new password for the session opened by the recovery link. */
export async function actualizarContrasena(password: string): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'El link venció o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".' }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      console.error('[actualizarContrasena]', error)
      if (error.message.toLowerCase().includes('different from the old')) {
        return { error: 'La contraseña nueva tiene que ser distinta de la anterior.' }
      }
      return { error: mensajeAuthAmigable(error.message) }
    }

    return { success: true }
  } catch (err) {
    console.error('[actualizarContrasena] excepción no manejada', err)
    return { error: mensajeAuthAmigable(undefined) }
  }
}

export async function logoutOrganizador(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
