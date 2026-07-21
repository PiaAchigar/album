'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarIcon, Clock, PartyPopper } from 'lucide-react'
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
import { crearEvento } from '@/app/(organizador)/actions/eventos.actions'
import type { WizardData } from '../page'

const schema = z.object({
  nombre_evento: z.string().min(1, 'El nombre es obligatorio').max(120),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  horario: z.string().min(1, 'El horario es obligatorio'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues: Partial<FormValues>
  onSuccess: (data: Pick<WizardData, 'eventoId' | 'nombre_evento' | 'fecha' | 'horario'>) => void
}

export function Paso1DatosBasicos({ defaultValues, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre_evento: defaultValues.nombre_evento ?? '',
      fecha: defaultValues.fecha ?? '',
      horario: defaultValues.horario ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const result = await crearEvento(values)

    if ('error' in result) {
      setServerError(result.error)
      return
    }

    onSuccess({
      eventoId: result.id,
      nombre_evento: values.nombre_evento,
      fecha: values.fecha,
      horario: values.horario,
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PartyPopper className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Identidad del evento</h2>
          <p className="text-sm text-muted-foreground">
            Contanos qué estás organizando y cuándo va a ser.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="nombre_evento"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Nombre del evento
                </FormLabel>
                <FormControl>
                  <Input placeholder="ej: Los 15 de Valentina" className="h-12" {...field} />
                </FormControl>
                <p className="text-xs italic text-muted-foreground">
                  Este nombre lo van a ver tus invitados al escanear el QR.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Fecha del evento
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <CalendarIcon
                        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input type="date" className="h-12 pl-12" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="horario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Horario de inicio
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Clock
                        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input type="time" className="h-12 pl-12" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button variant="outline" className="h-12" asChild>
              <Link href="/eventos">Cancelar</Link>
            </Button>
            <Button
              type="submit"
              className="h-12 flex-1 gap-2 text-sm font-semibold uppercase tracking-widest sm:flex-none sm:px-8"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Guardando…' : 'Siguiente paso →'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
