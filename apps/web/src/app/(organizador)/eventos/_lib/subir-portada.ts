import { actualizarPortada } from '@/app/(organizador)/actions/eventos.actions'
import { solicitarPresignedPortada } from '@/app/(organizador)/eventos/nuevo/actions'

export const PORTADA_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
export const PORTADA_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic']
export const PORTADA_MAX_SIZE_MB = 10
export const PORTADA_ACCEPT = [...PORTADA_ALLOWED_TYPES, ...PORTADA_ALLOWED_EXTENSIONS].join(',')

/** Devuelve el mensaje de error para mostrar, o null si el archivo sirve como portada. */
export function validarArchivoPortada(file: File): string | null {
  const hasAllowedExtension = PORTADA_ALLOWED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  )

  if (!PORTADA_ALLOWED_TYPES.includes(file.type) && !hasAllowedExtension) {
    return 'Solo se admiten imágenes JPG, PNG, WebP o HEIC.'
  }

  if (file.size > PORTADA_MAX_SIZE_MB * 1024 * 1024) {
    return `La imagen no puede superar los ${PORTADA_MAX_SIZE_MB} MB.`
  }

  return null
}

/**
 * Sube el archivo al bucket R2 del organizador con una URL prefirmada y
 * guarda la key como portada del evento. Devuelve la key guardada.
 */
export async function subirPortada(eventoId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const { uploadUrl, r2Key } = await solicitarPresignedPortada(eventoId, extension)

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })

  if (!res.ok) {
    throw new Error(`R2 respondió ${res.status}`)
  }

  await actualizarPortada(eventoId, r2Key)
  return r2Key
}
