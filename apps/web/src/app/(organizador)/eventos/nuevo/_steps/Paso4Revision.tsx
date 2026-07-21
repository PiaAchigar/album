'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck2, ImagePlus, Info, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { activarEvento } from '@/app/(organizador)/actions/eventos.actions'
import type { WizardData } from '../page'

interface Props {
  data: WizardData
  onBack: () => void
}

function Row({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value ?? '—'}</span>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CalendarCheck2
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

export function Paso4Revision({ data, onBack }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!data.eventoId) return
    setError(null)
    setSubmitting(true)

    try {
      const result = await activarEvento(data.eventoId)

      if ('error' in result) {
        setError(result.error)
        return
      }

      router.push(`/eventos/${data.eventoId}/qr`)
    } catch {
      setError('Ocurrió un error al activar el evento. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Revisá los datos antes de activar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Una vez confirmado, generamos tu código QR para compartir con los invitados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard icon={CalendarCheck2} title="Datos del evento">
          <Row label="Nombre" value={data.nombre_evento} />
          <Row label="Fecha" value={data.fecha} />
          <Row label="Horario" value={data.horario} />
        </SummaryCard>

        <SummaryCard icon={ImagePlus} title="Portada">
          <Row
            label="Foto de portada"
            value={data.foto_portada_r2Key ? 'Cargada' : 'Sin foto'}
          />
        </SummaryCard>

        <SummaryCard icon={SlidersHorizontal} title="Límites">
          <Row label="Invitados esperados" value={data.cantidad_invitados_totales} />
          <Row label="Límite de registros" value={data.limite_invitados_login} />
          <Row label="Fotos por invitado" value={data.limite_fotos_por_invitado} />
          <Row label="Videos por invitado" value={data.limite_videos_por_invitado} />
        </SummaryCard>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-secondary/60 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Al confirmar, tu evento pasa a estado <span className="font-semibold text-foreground">activo</span> y
          vas a poder compartir el QR con tus invitados.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" className="h-12" onClick={onBack} disabled={submitting}>
          ← Volver
        </Button>
        <Button
          className="h-12 flex-1 gap-2 text-sm font-semibold uppercase tracking-widest sm:flex-none sm:px-8"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? 'Activando…' : 'Confirmar y generar QR'}
        </Button>
      </div>
    </div>
  )
}
