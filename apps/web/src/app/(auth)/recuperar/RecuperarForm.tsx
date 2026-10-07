'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { KeyRound, Mail, MailCheck } from 'lucide-react'
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
import { solicitarRecuperacion } from '@/app/(organizador)/actions/auth.actions'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type Values = z.infer<typeof schema>

export function RecuperarForm({ linkVencido }: { linkVencido: boolean }) {
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: Values) {
    setServerError(null)
    const result = await solicitarRecuperacion(values.email)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    setEnviadoA(values.email)
  }

  if (enviadoA) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MailCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Revisá tu email</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Si <strong className="text-foreground">{enviadoA}</strong> tiene una cuenta en Album, te
          mandamos un link para elegir una contraseña nueva. Vence en 1 hora.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          ¿No te llegó? Fijate en la carpeta de spam o promociones.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Volver a ingresar
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <KeyRound className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Recuperar contraseña</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Escribí el email de tu cuenta y te mandamos un link para elegir una contraseña nueva.
        </p>
      </div>

      {linkVencido && (
        <p className="mb-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Ese link venció o ya se usó. Pedí uno nuevo acá abajo.
        </p>
      )}

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
                      autoComplete="email"
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

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button
            type="submit"
            className="h-12 w-full text-sm font-semibold uppercase tracking-widest"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Enviando…' : 'Mandarme el link'}
          </Button>
        </form>
      </Form>

      <div className="mt-10 border-t border-border pt-8 text-center">
        <Link href="/login" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      </div>
    </>
  )
}
