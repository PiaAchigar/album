import { notFound } from 'next/navigation'
import { obtenerArchivoDetalle } from '@/app/(organizador)/actions/archivos.actions'
import { DetalleClient } from './DetalleClient'

interface Props {
  params: Promise<{ id: string; archivoId: string }>
}

export default async function ArchivoDetallePage({ params }: Props) {
  const { id, archivoId } = await params

  const detalle = await obtenerArchivoDetalle(archivoId)
  if (!detalle) notFound()

  const { archivo, prevId, nextId } = detalle

  return (
    <DetalleClient eventoId={id} archivo={archivo} prevId={prevId} nextId={nextId} />
  )
}
