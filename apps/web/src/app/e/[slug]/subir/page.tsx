import { db } from '@/lib/db'
import { eventos } from '@album/database'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { SubirClient } from './SubirClient'

interface Props { params: Promise<{ slug: string }> }

export default async function SubirPage({ params }: Props) {
  const { slug } = await params
  const [evento] = await db
    .select({
      id: eventos.id,
      nombre_evento: eventos.nombre_evento,
      limite_fotos_por_invitado: eventos.limite_fotos_por_invitado,
      limite_videos_por_invitado: eventos.limite_videos_por_invitado,
      estado: eventos.estado,
    })
    .from(eventos)
    .where(eq(eventos.slug, slug))
    .limit(1)

  if (!evento || evento.estado !== 'activo') notFound()

  return (
    <SubirClient
      slug={slug}
      eventoId={evento.id}
      nombreEvento={evento.nombre_evento}
      limiteFotos={evento.limite_fotos_por_invitado}
      limiteVideos={evento.limite_videos_por_invitado}
    />
  )
}
