'use client'

import { useState } from 'react'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { WizardProgress } from './_components/WizardProgress'
import { Paso1DatosBasicos } from './_steps/Paso1DatosBasicos'
import { Paso2FotoPortada } from './_steps/Paso2FotoPortada'
import { Paso3Limites } from './_steps/Paso3Limites'
import { Paso4Revision } from './_steps/Paso4Revision'

export interface WizardData {
  eventoId?: string
  nombre_evento?: string
  fecha?: string
  horario?: string
  foto_portada_r2Key?: string
  cantidad_invitados_totales?: number
  limite_invitados_login?: number
  limite_fotos_por_invitado?: number
  limite_videos_por_invitado?: number
}

const STEP_TITLES: Record<number, string> = {
  1: 'Datos básicos',
  2: 'Foto de portada',
  3: 'Límites del evento',
  4: 'Revisión final',
}

export default function NuevoEventoPage() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({})

  function updateData(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  return (
    <div className="flex min-h-screen flex-col">
      <OrganizadorTopbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Paso {step} de 4
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            {STEP_TITLES[step]}
          </h1>
        </div>

        <div className="mb-10">
          <WizardProgress currentStep={step} />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
          {step === 1 && (
            <Paso1DatosBasicos
              defaultValues={{
                nombre_evento: data.nombre_evento,
                fecha: data.fecha,
                horario: data.horario,
              }}
              onSuccess={(result) => {
                updateData(result)
                setStep(2)
              }}
            />
          )}
          {step === 2 && (
            <Paso2FotoPortada
              eventoId={data.eventoId!}
              onSuccess={(r2Key) => {
                updateData({ foto_portada_r2Key: r2Key })
                setStep(3)
              }}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Paso3Limites
              eventoId={data.eventoId!}
              defaultValues={{
                cantidad_invitados_totales: data.cantidad_invitados_totales,
                limite_invitados_login: data.limite_invitados_login,
                limite_fotos_por_invitado: data.limite_fotos_por_invitado,
                limite_videos_por_invitado: data.limite_videos_por_invitado,
              }}
              onSuccess={(limits) => {
                updateData(limits)
                setStep(4)
              }}
            />
          )}
          {step === 4 && <Paso4Revision data={data} onBack={() => setStep(3)} />}
        </div>
      </main>
    </div>
  )
}
