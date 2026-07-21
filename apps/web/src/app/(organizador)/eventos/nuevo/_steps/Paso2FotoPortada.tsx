'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, ImagePlus, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actualizarPortada } from '@/app/(organizador)/actions/eventos.actions'
import { solicitarPresignedPortada } from '../actions'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE_MB = 10

interface Props {
  eventoId: string
  onSuccess: (r2Key: string) => void
  onSkip: () => void
}

export function Paso2FotoPortada({ eventoId, onSuccess, onSkip }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [r2Key, setR2Key] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function processFile(file: File) {
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se admiten imágenes JPG, PNG, WebP o HEIC.')
      return
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`La imagen no puede superar los ${MAX_SIZE_MB} MB.`)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    setUploading(true)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const { uploadUrl, r2Key: key } = await solicitarPresignedPortada(eventoId, extension)

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!res.ok) {
        throw new Error(`R2 respondió ${res.status}`)
      }

      await actualizarPortada(eventoId, key)
      setR2Key(key)
    } catch (err) {
      console.error('[Paso2FotoPortada] upload error', err)
      setError('No se pudo subir la imagen. Intentá de nuevo.')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  function handleContinue() {
    if (r2Key) onSuccess(r2Key)
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="space-y-4 rounded-lg border border-border bg-secondary/40 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Foto de portada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Es lo primero que ven tus invitados al escanear el QR. Elegí una imagen que represente tu evento.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              JPG, PNG, WebP o HEIC
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Tamaño máximo: {MAX_SIZE_MB} MB
            </li>
          </ul>
        </div>

        <div
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/30 bg-muted/20 hover:border-primary/50'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          role="button"
          aria-label="Seleccionar foto de portada"
        >
          {preview ? (
            <div className="relative h-56 w-full max-w-sm overflow-hidden rounded-lg">
              <Image src={preview} alt="Portada" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="text-base font-semibold text-foreground">Arrastrá tu portada acá</p>
              <p className="text-sm">O hacé clic para elegirla desde tu computadora</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploading && <p className="text-sm text-muted-foreground">Subiendo imagen…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
        <Button variant="outline" className="h-12" onClick={onSkip} disabled={uploading}>
          Omitir por ahora
        </Button>
        <Button
          className="h-12 flex-1 gap-2 text-sm font-semibold uppercase tracking-widest sm:flex-none sm:px-8"
          onClick={handleContinue}
          disabled={!r2Key || uploading}
        >
          Siguiente paso →
        </Button>
      </div>
    </div>
  )
}
