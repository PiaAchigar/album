import type { Metadata } from 'next'
import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { RestablecerForm } from './RestablecerForm'

export const metadata: Metadata = {
  title: 'Elegí tu nueva contraseña — Album',
}

// Reached from the recovery email via /auth/confirm, which opens the session.
export default async function RestablecerPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="ctx-organizador flex flex-1 flex-col bg-backdrop">
      <OrganizadorTopbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px] rounded-xl border border-border bg-card p-8 shadow-sm sm:p-12">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LockKeyhole className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Nueva contraseña</h1>
            {user?.email && (
              <p className="mt-2 text-base text-muted-foreground">
                Para la cuenta <strong className="text-foreground">{user.email}</strong>
              </p>
            )}
          </div>

          {user ? (
            <RestablecerForm />
          ) : (
            <div className="text-center">
              <p className="text-base text-muted-foreground">
                Para cambiar tu contraseña, abrí el link que te mandamos por email. Si venció o
                ya lo usaste, pedí uno nuevo.
              </p>
              <Link
                href="/recuperar"
                className="mt-6 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Pedir un link nuevo
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
