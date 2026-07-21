'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Images, UserCheck, Users, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actualizarLimites } from '@/app/(organizador)/actions/eventos.actions'
import type { WizardData } from '../page'

type LimitsData = Pick<
  WizardData,
  | 'cantidad_invitados_totales'
  | 'limite_invitados_login'
  | 'limite_fotos_por_invitado'
  | 'limite_videos_por_invitado'
>

interface StepperCardProps {
  icon: LucideIcon
  label: string
  description: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

function StepperCard({
  icon: Icon,
  label,
  description,
  value,
  min = 0,
  max = 9999,
  onChange,
}: StepperCardProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center justify-between rounded-md border border-border">
        <button
          type="button"
          aria-label={`Reducir ${label}`}
          className="flex h-12 w-12 items-center justify-center text-xl font-medium text-foreground transition hover:bg-muted disabled:opacity-40"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          −
        </button>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          className="flex h-12 w-12 items-center justify-center text-xl font-medium text-foreground transition hover:bg-muted disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  )
}

interface Props {
  eventoId: string
  defaultValues: LimitsData
  onSuccess: (data: LimitsData) => void
}

export function Paso3Limites({ eventoId, defaultValues, onSuccess }: Props) {
  const [values, setValues] = useState<Required<LimitsData>>({
    cantidad_invitados_totales: defaultValues.cantidad_invitados_totales ?? 100,
    limite_invitados_login: defaultValues.limite_invitados_login ?? 100,
    limite_fotos_por_invitado: defaultValues.limite_fotos_por_invitado ?? 10,
    limite_videos_por_invitado: defaultValues.limite_videos_por_invitado ?? 2,
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof typeof values) {
    return (val: number) => setValues((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit() {
    if (values.limite_invitados_login > values.cantidad_invitados_totales) {
      setError(
        'El límite de invitados con registro no puede superar la cantidad total de invitados.',
      )
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await actualizarLimites(eventoId, values)
      onSuccess(values)
    } catch {
      setError('No se pudieron guardar los límites. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Límites del evento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurá cuántas personas pueden registrarse y cuánto contenido puede subir cada una.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StepperCard
          icon={Users}
          label="Invitados esperados"
          description="Cantidad total que esperás. Es solo informativo, no bloquea nada."
          value={values.cantidad_invitados_totales}
          min={1}
          onChange={set('cantidad_invitados_totales')}
        />
        <StepperCard
          icon={UserCheck}
          label="Límite de registros"
          description="Tope duro: cuántos invitados pueden registrarse para subir fotos."
          value={values.limite_invitados_login}
          min={1}
          onChange={set('limite_invitados_login')}
        />
        <StepperCard
          icon={Images}
          label="Fotos por invitado"
          description="Máximo de fotos que puede subir cada invitado registrado."
          value={values.limite_fotos_por_invitado}
          min={0}
          onChange={set('limite_fotos_por_invitado')}
        />
        <StepperCard
          icon={Video}
          label="Videos por invitado"
          description="Máximo de videos que puede subir cada invitado registrado."
          value={values.limite_videos_por_invitado}
          min={0}
          onChange={set('limite_videos_por_invitado')}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end border-t border-border pt-6">
        <Button
          className="h-12 w-full gap-2 text-sm font-semibold uppercase tracking-widest sm:w-auto sm:px-8"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Guardando…' : 'Siguiente paso →'}
        </Button>
      </div>
    </div>
  )
}
