import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Landing point for links in Supabase Auth emails (password recovery,
 * signup confirmation). Opens a session and forwards to `next`.
 *
 * Two link formats are accepted:
 * - `?token_hash=…&type=…` — our custom email templates. Works even if the
 *   email is opened on a different device than the one that asked for it.
 * - `?code=…` — Supabase's default templates (PKCE). Only works in the same
 *   browser that requested the email.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  // Only allow relative paths, so the link can't bounce users to another site.
  const nextParam = searchParams.get('next') ?? '/eventos'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/eventos'

  const supabase = await createSupabaseServerClient()

  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) console.error('[auth/confirm] verifyOtp', error)
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) console.error('[auth/confirm] exchangeCodeForSession', error)
    ok = !error
  }

  if (!ok) {
    const destino = type === 'recovery' || next === '/restablecer' ? '/recuperar' : '/login'
    return NextResponse.redirect(new URL(`${destino}?error=link`, origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
