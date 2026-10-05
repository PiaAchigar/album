// La API genera las keys de portada como `eventos/<eventoId>/portada/<nanoid>.<ext>`
// (ver getPortadaPresignedUpload en apps/api/src/lib/r2.ts). Solo se acepta
// guardar una key con esa forma, para que nadie pueda apuntar la portada a
// otro archivo del bucket (por ejemplo, una foto de un invitado).
export function esKeyDePortadaDelEvento(eventoId: string, r2Key: string): boolean {
  const prefijo = `eventos/${eventoId}/portada/`
  if (!r2Key.startsWith(prefijo)) return false

  const archivo = r2Key.slice(prefijo.length)
  return archivo.length > 0 && !archivo.includes('/') && !archivo.includes('..')
}

/**
 * Pide a la API una URL firmada (de vida corta) para leer la portada del
 * evento. Devuelve null si el evento no tiene portada o la API falla.
 */
export async function obtenerUrlPortada(slug: string): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const res = await fetch(`${apiUrl}/eventos/${slug}/portada-url`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { url: string }
    return data.url
  } catch {
    return null
  }
}
