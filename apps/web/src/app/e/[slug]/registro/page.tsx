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
import { Checkbox } from '@/components/ui/checkbox'
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

const schema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100),
  pais: z.enum(['UY', 'AR', 'PY']),
  telefono: z.string().max(30).optional().or(z.literal('')),
  acepto_terminos: z.literal(true, {
    errorMap: () => ({ message: 'Tenés que aceptar los Términos y Condiciones para continuar' }),
  }),
})

type FormValues = z.infer<typeof schema>

interface Props {
  params: Promise<{ slug: string }>
}

export default function RegistroPage({ params }: Props) {
  const { slug } = use(params)
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      apellido: '',
      pais: 'AR',
      telefono: '',
      acepto_terminos: undefined as unknown as true,
    },
  })

  const paisSeleccionado = form.watch('pais')
  const placeholderTelefono =
    PAISES.find((p) => p.value === paisSeleccionado)?.placeholder ?? PAISES[1].placeholder

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const url = `${apiUrl}/eventos/${slug}/invitados`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: values.nombre,
          apellido: values.apellido,
          telefono: values.telefono || undefined,
          acepto_terminos: true,
        }),
      })

      console.log('[registro] response received', {
        status: res.status,
        ok: res.ok,
        url: res.url,
      })

      if (res.status === 409) {
        console.warn('[registro] rejected: cupo lleno')
        setServerError('Cupo de invitados alcanzado, hablá con el organizador.')
        return
      }

      if (!res.ok) {
        const rawText = await res.clone().text().catch(() => '<no se pudo leer el body>')
        const body = await res.json().catch(() => ({}))
        console.error('[registro] respuesta no-ok', {
          status: res.status,
          rawText,
        })
        setServerError((body as { error?: string }).error ?? 'Ocurrió un error. Intentá de nuevo.')
        return
      }

      const { token, invitado_id } = (await res.json()) as {
        token: string
        invitado_id: string
      }

      console.log('[registro] registro exitoso', { invitado_id })

      localStorage.setItem(`album_token_${slug}`, token)
      localStorage.setItem(`album_invitado_${slug}`, invitado_id)

      router.push(`/e/${slug}/subir`)
    } catch (err) {
      console.error('[registro] fetch threw (network/CORS)', err)
      setServerError('No se pudo conectar. Verificá tu conexión e intentá de nuevo.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-backdrop">
      {/*
        Fixed top app bar, mirroring the landing page's header (see
        evento/[slug]/page.tsx). Unlike the landing page, this screen has a
        real "back" destination — the event landing the guest came from —
        so the close (X) affordance is included here rather than dropped.
      */}
      <header className="fixed top-0 z-30 flex h-12 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-md">
        <Link
          href={`/e/${slug}`}
          aria-label="Volver al evento"
          className="flex h-8 w-8 items-center justify-center text-primary transition-opacity active:opacity-70"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h2 className="truncate font-[family-name:var(--font-playfair)] text-lg font-bold text-primary">
          Registrate
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
            Registrate
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-muted-foreground">
            Ingresá tus datos para poder subir tus fotos y videos.
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
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Nombre
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej. Julián"
                      autoComplete="given-name"
                      className="h-12 rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apellido"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Apellido
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej. Rodríguez"
                      autoComplete="family-name"
                      className="h-12 rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Teléfono
                      </FormLabel>
                      <span className="text-[11px] italic text-muted-foreground/70">Opcional</span>
                    </div>
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

            <FormField
              control={form.control}
              name="acepto_terminos"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 py-2">
                  <FormControl>
                    <Checkbox
                      className="mt-0.5 h-5 w-5"
                      checked={field.value === true}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true ? true : undefined)
                      }
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer text-sm font-normal text-foreground">
                      Acepto los{' '}
                      <a
                        href="/terminos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-primary hover:underline"
                      >
                        Términos y Condiciones
                      </a>{' '}
                      y autorizo el uso de mis fotos y videos en el álbum del evento.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-full text-sm font-bold uppercase tracking-widest shadow-md"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                'Registrando…'
              ) : (
                <>
                  Unirme al álbum
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
