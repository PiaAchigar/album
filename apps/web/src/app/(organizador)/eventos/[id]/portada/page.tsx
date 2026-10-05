import { notFound } from 'next/navigation'
import { obtenerEvento } from '@/app/(organizador)/actions/eventos.actions'
import { obtenerUrlPortada } from '@/lib/portada'
import { PortadaEditor } from './PortadaEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PortadaEventoPage({ params }: Props) {
  const { id } = await params
  const evento = await obtenerEvento(id)
  if (!evento) notFound()

  const portadaUrl = evento.foto_portada_url ? await obtenerUrlPortada(evento.slug) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Foto de portada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Es lo primero que ven tus invitados al escanear el QR.
        </p>
      </div>

      <PortadaEditor
        eventoId={evento.id}
        nombreEvento={evento.nombre_evento}
        portadaUrl={portadaUrl}
      />
    </div>
  )
}
