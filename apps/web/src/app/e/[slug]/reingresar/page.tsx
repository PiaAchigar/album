'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Heart, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PAISES } from '@/lib/paises'
import { apiClient, ApiError } from '@/lib/api-client'

const schema = z.object({
  pais: z.enum(['UY', 'AR', 'PY']),
  telefono: z.string().min(1, 'El teléfono es obligatorio').max(30),
})

type FormValues = z.infer<typeof schema>

interface Props {
  params: Promise<{ slug: string }>
}

export default function ReingresarPage({ params }: Props) {
  const { slug } = use(params)
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pais: 'AR',
      telefono: '',
    },
  })

  const paisSeleccionado = form.watch('pais')
  const placeholderTelefono =
    PAISES.find((p) => p.value === paisSeleccionado)?.placeholder ?? PAISES[1].placeholder

  async function onSubmit(values: FormValues) {
    setServerError(null)

    try {
      const { token, invitado_id } = await apiClient(slug).reingresar(values.telefono)

      localStorage.setItem(`album_token_${slug}`, token)
      localStorage.setItem(`album_invitado_${slug}`, invitado_id)

      router.push(`/e/${slug}/subir`)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo conectar. Verificá tu conexión e intentá de nuevo.'
      setServerError(message)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-backdrop">
      <header className="fixed top-0 z-30 flex h-12 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-md">
        <Link
          href={`/e/${slug}/registro`}
          aria-label="Volver al registro"
          className="flex h-8 w-8 items-center justify-center text-primary transition-opacity active:opacity-70"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h2 className="truncate font-[family-name:var(--font-playfair)] text-lg font-bold text-primary">
          Entrá con tu teléfono
        </h2>
        <div className="w-8" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-20">
        <div className="relative mb-10 text-center">
          <Heart
            className="pointer-events-none absolute -left-1 -top-4 h-14 w-14 -rotate-12 text-primary/10"
            aria-hidden="true"
            fill="currentColor"
          />
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-foreground">
            ¡Hola de nuevo!
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-muted-foreground">
            Ingresá el teléfono con el que te registraste para volver a acceder a tus fotos.
          </p>
        </div>

        {serverError && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 shadow-sm">
            <Info className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium text-destructive">{serverError}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="pais"
                render={({ field }) => (
                  <FormItem className="w-[7.5rem] shrink-0">
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      País
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.value} value={pais.value}>
                            {pais.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Teléfono
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder={placeholderTelefono}
                        autoComplete="tel"
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-full text-sm font-bold uppercase tracking-widest shadow-md"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                'Entrando…'
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  )
}
