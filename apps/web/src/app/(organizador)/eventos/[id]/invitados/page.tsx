import { notFound } from 'next/navigation'
import { listarInvitados } from '@/app/(organizador)/actions/invitados.actions'
import { obtenerEvento } from '@/app/(organizador)/actions/eventos.actions'
import { InvitadosClient } from './InvitadosClient'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function InvitadosPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams

  const [invitados, evento] = await Promise.all([listarInvitados(id, q), obtenerEvento(id)])

  if (!evento) notFound()

  return (
    <InvitadosClient
      invitados={invitados}
      limiteFotos={evento.limite_fotos_por_invitado}
      limiteVideos={evento.limite_videos_por_invitado}
      search={q ?? ''}
    />
  )
}
