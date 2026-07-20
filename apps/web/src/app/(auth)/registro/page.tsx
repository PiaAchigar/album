'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Images, Lock, Mail, User, Users } from 'lucide-react'
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
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { registerOrganizador } from '@/app/(organizador)/actions/auth.actions'

const registroSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

type RegistroValues = z.infer<typeof registroSchema>

export default function RegistroPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<RegistroValues>({
    resolver: zodResolver(registroSchema),
    defaultValues: { nombre: '', email: '', password: '' },
  })

  async function onSubmit(values: RegistroValues) {
    setServerError(null)
    const result = await registerOrganizador(values)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    // Supabase sends a confirmation email by default.
    // If email confirmation is disabled in Supabase settings, redirect directly.
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="ctx-organizador flex min-h-screen flex-col bg-backdrop">
        <OrganizadorTopbar />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
            <h1 className="text-2xl font-bold tracking-tight text-primary">¡Cuenta creada!</h1>
            <p className="mt-3 text-muted-foreground">
              Revisá tu email para confirmar la cuenta y después ingresá desde{' '}
              <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                aquí
              </Link>
              .
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="ctx-organizador flex min-h-screen flex-col">
      <OrganizadorTopbar />
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Marketing panel — decorative, hidden on narrow viewports (mobile-first). */}
        <section className="relative hidden overflow-hidden bg-primary lg:flex lg:w-7/12 lg:flex-col lg:justify-center lg:p-16">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-slate-800 to-slate-900" />
          <div className="relative z-10 max-w-xl text-primary-foreground">
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Organizá tu evento con Album.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-primary-foreground/80">
              Sumate a los organizadores que usan Album para reunir los recuerdos de sus
              invitados, moderar la galería y compartir todo en un solo lugar.
            </p>
            <div className="mt-12 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-md">
                <Images className="mb-3 h-5 w-5 text-primary-foreground" aria-hidden="true" />
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  Galerías inteligentes
                </h3>
                <p className="text-xs text-primary-foreground/70">
                  Fotos y videos organizados automáticamente a medida que suben tus invitados.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-md">
                <Users className="mb-3 h-5 w-5 text-primary-foreground" aria-hidden="true" />
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  Gestión de invitados
                </h3>
                <p className="text-xs text-primary-foreground/70">
                  Registro simple para todos tus invitados, sin fricción.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Form panel */}
        <section className="flex flex-1 flex-col items-center justify-center bg-backdrop px-4 py-12 lg:w-5/12">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <h1 className="text-3xl font-bold tracking-tight text-primary">Empezá a organizar</h1>
              <p className="mt-2 text-muted-foreground">
                Creá tu cuenta de organizador para gestionar tus eventos y galerías.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Nombre completo
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input placeholder="Tu nombre" className="h-12 pl-12" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Contraseña
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock
                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            type="password"
                            placeholder="Mínimo 8 caracteres"
                            className="h-12 pl-12"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {serverError && <p className="text-sm text-destructive">{serverError}</p>}

                <Button
                  type="submit"
                  className="h-12 w-full gap-2 text-sm font-semibold uppercase tracking-widest"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    'Creando cuenta…'
                  ) : (
                    <>
                      Crear cuenta
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                Ingresar
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
