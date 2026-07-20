'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type AuthResult = { success: true } | { error: string }

export async function registerOrganizador(formData: {
  nombre: string
  email: string
  password: string
}): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: { nombre: formData.nombre },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function loginOrganizador(formData: {
  email: string
  password: string
}): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function logoutOrganizador(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
