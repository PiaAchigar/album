import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { obtenerEvento } from '@/app/(organizador)/actions/eventos.actions'
import { PanelNav } from './_components/PanelNav'

interface Props {
  params: Promise<{ id: string }>
  children: ReactNode
}

function estadoInfo(estado: string) {
  if (estado === 'activo') return { label: 'Activo', variant: 'default' as const }
  if (estado === 'cerrado') return { label: 'Cerrado', variant: 'outline' as const }
  return { label: 'Borrador', variant: 'secondary' as const }
}

export default async function EventoPanelLayout({ params, children }: Props) {
  const { id } = await params
  const evento = await obtenerEvento(id)

  if (!evento) notFound()

  const { label, variant } = estadoInfo(evento.estado)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <Link
          href="/eventos"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Volver a mis eventos"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
          {evento.nombre_evento}
        </h1>
        <Badge variant={variant}>{label}</Badge>
      </header>

      <div className="flex flex-1">
        <PanelNav eventoId={id} />
        <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 md:pb-4">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
