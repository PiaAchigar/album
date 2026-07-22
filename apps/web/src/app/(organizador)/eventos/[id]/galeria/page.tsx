import { listarArchivos } from '@/app/(organizador)/actions/archivos.actions'
import { listarInvitados } from '@/app/(organizador)/actions/invitados.actions'
import { GaleriaClient } from './GaleriaClient'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ invitadoId?: string; tipo?: string; estado?: string }>
}

export default async function GaleriaPage({ params, searchParams }: Props) {
  const { id } = await params
  const { invitadoId, tipo, estado } = await searchParams

  const [archivos, invitados] = await Promise.all([
    listarArchivos(id, { invitadoId, tipo, estado }),
    listarInvitados(id),
  ])

  return (
    <GaleriaClient
      eventoId={id}
      archivos={archivos}
      invitados={invitados}
      filters={{ invitadoId, tipo, estado }}
    />
  )
}
