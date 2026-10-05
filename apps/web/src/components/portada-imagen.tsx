'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'

interface Props {
  src: string | null
  alt: string
  fallback: ReactNode
  className?: string
  priority?: boolean
  unoptimized?: boolean
}

/**
 * Imagen de portada que muestra `fallback` si no hay URL o si el archivo no
 * carga (por ejemplo, la key existe en la base pero el objeto ya no está en
 * R2), en lugar del ícono de imagen rota del navegador.
 */
export function PortadaImagen({ src, alt, fallback, className, priority, unoptimized }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) return <>{fallback}</>

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      priority={priority}
      unoptimized={unoptimized}
      onError={() => setFailedSrc(src)}
    />
  )
}
