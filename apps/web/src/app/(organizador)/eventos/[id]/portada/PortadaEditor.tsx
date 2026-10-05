'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, ImageOff, Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PortadaImagen } from '@/components/portada-imagen'
import {
  PORTADA_ACCEPT,
  PORTADA_MAX_SIZE_MB,
  subirPortada,
  validarArchivoPortada,
} from '../../_lib/subir-portada'

interface Props {
  eventoId: string
  nombreEvento: string
  portadaUrl: string | null
}

export function PortadaEditor({ eventoId, nombreEvento, portadaUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Preview local de la imagen recién subida: se muestra al instante sin
  // esperar una nueva URL firmada de la API.
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function processFile(file: File) {
    setError(null)
    setSuccess(false)

    const validationError = validarArchivoPortada(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    try {
      await subirPortada(eventoId, file)
      setPreview(URL.createObjectURL(file))
      setSuccess(true)
    } catch (err) {
      console.error('[PortadaEditor] upload error', err)
      setError('No se pudo subir la imagen. Intentá de nuevo.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const tienePortada = Boolean(preview ?? portadaUrl)

  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
        <PortadaImagen
          key={preview ?? portadaUrl ?? 'vacia'}
          src={preview ?? portadaUrl}
          alt={`Foto de portada de ${nombreEvento}`}
          className="object-cover"
          unoptimized={Boolean(preview)}
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <ImageOff className="h-8 w-8" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Este evento no tiene portada</p>
              <p className="text-sm">Tus invitados ven un fondo de color en su lugar.</p>
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          className="h-11 gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? 'Subiendo…' : tienePortada ? 'Cambiar portada' : 'Subir portada'}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP o HEIC · máximo {PORTADA_MAX_SIZE_MB} MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PORTADA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void processFile(file)
        }}
      />

      {success && (
        <p className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Portada actualizada. Tus invitados ya la ven al escanear el QR.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
