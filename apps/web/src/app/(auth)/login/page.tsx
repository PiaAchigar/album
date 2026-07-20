'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { loginOrganizador } from '@/app/(organizador)/actions/auth.actions'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  // Visual only — Supabase session persistence isn't configurable per-login
  // in this codebase yet. This checkbox is inert and not sent to the server.
  const [staySignedIn, setStaySignedIn] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const result = await loginOrganizador(values)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    router.push('/eventos')
    router.refresh()
  }

  return (
    <div className="ctx-organizador flex min-h-screen flex-col bg-backdrop">
      <OrganizadorTopbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px] rounded-xl border border-border bg-card p-8 shadow-sm sm:p-12">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Ingresar</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Accedé al panel de gestión de tus eventos.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Email
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          type="email"
                          placeholder="vos@ejemplo.com"
                          className="h-12 pl-12"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Contraseña
                      </FormLabel>
                      {/* Inert — no forgot-password flow exists yet. */}
                      <span
                        className="cursor-not-allowed text-xs font-medium text-muted-foreground/60"
                        aria-disabled="true"
                        title="Todavía no disponible"
                      >
                        ¿Olvidaste tu contraseña?
                      </span>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="h-12 pl-12 pr-12"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <label className="flex cursor-pointer items-center gap-3">
                {/* Visual only, not wired to any auth behavior — see comment above. */}
                <Checkbox
                  checked={staySignedIn}
                  onCheckedChange={(checked) => setStaySignedIn(checked === true)}
                />
                <span className="text-sm text-muted-foreground select-none">
                  Mantener sesión iniciada
                </span>
              </label>

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button
                type="submit"
                className="h-12 w-full gap-2 text-sm font-semibold uppercase tracking-widest"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  'Ingresando…'
                ) : (
                  <>
                    Entrar
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-10 border-t border-border pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              ¿No tenés cuenta?{' '}
              <Link href="/registro" className="font-semibold text-primary underline-offset-4 hover:underline">
                Crear cuenta
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
