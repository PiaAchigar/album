'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Check, Images, Trash2, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { useInvitado } from '@/hooks/useInvitado'
import { apiClient, ApiError } from '@/lib/api-client'
import { obtenerContadoresInvitado } from '@/app/(organizador)/actions/invitados.actions'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

interface Props {
  slug: string
  eventoId: string
  nombreEvento: string
  limiteFotos: number
  limiteVideos: number
}

type Tipo = 'foto' | 'video'
type ItemStatus = 'compressing' | 'uploading' | 'done' | 'error'

interface UploadItem {
  id: string
  archivoId: string | null
  tipo: Tipo
  previewUrl: string | null
  r2Key: string | null
  progress: number
  status: ItemStatus
}

interface Counters {
  fotos: number
  videos: number
}

const ALLOWED_MIME: Record<Tipo, string[]> = {
  foto: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/avi', 'video/webm'],
}

// The API only accepts extensions from this exact set (see
// apps/api/src/routes/archivos.routes.ts ALLOWED_EXTENSIONS). Deriving the
// extension from the MIME type — rather than trusting the filename — keeps
// us aligned with that allowlist regardless of what the OS/browser named
// the file (camera captures in particular are inconsistent about this).
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/avi': 'avi',
  'video/webm': 'webm',
}

const MAX_BYTES: Record<Tipo, number> = {
  foto: 20 * 1024 * 1024,
  video: 200 * 1024 * 1024,
}

const MAX_LABEL: Record<Tipo, string> = {
  foto: '20 MB',
  video: '200 MB',
}

function tipoFromMime(mime: string): Tipo | null {
  if (mime.startsWith('image/')) return 'foto'
  if (mime.startsWith('video/')) return 'video'
  return null
}

/** PUTs `file` to a presigned R2 URL, reporting upload progress via XHR. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`No se pudo subir el archivo (HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('No se pudo conectar para subir el archivo'))
    xhr.send(file)
  })
}

export function SubirClient({ slug, nombreEvento, limiteFotos, limiteVideos }: Props) {
  const router = useRouter()
  const { token, invitadoId, isLoaded } = useInvitado(slug)

  const [counters, setCountersState] = useState<Counters | null>(null)
  const countersRef = useRef<Counters>({ fotos: 0, videos: 0 })
  const [nombre, setNombre] = useState<string | null>(null)

  const [items, setItems] = useState<UploadItem[]>([])
  const itemsRef = useRef<UploadItem[]>([])

  const [deleteTarget, setDeleteTarget] = useState<UploadItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Guests without a session token never reach this screen directly — send
  // them back to registro. Wait for isLoaded so we don't redirect before
  // localStorage has actually been read.
  useEffect(() => {
    if (isLoaded && !token) {
      router.replace(`/e/${slug}/registro`)
    }
  }, [isLoaded, token, router, slug])

  useEffect(() => {
    if (!invitadoId) return
    let cancelled = false

    obtenerContadoresInvitado(invitadoId)
      .then((row) => {
        if (cancelled) return
        const next: Counters = row
          ? { fotos: row.fotos_subidas, videos: row.videos_subidos }
          : { fotos: 0, videos: 0 }
        countersRef.current = next
        setCountersState(next)
        if (row) {
          setNombre(row.nombre.split(' ')[0])
        } else {
          toast.error('No pudimos cargar tus contadores. Los límites podrían no reflejarse bien.')
        }
      })
      .catch(() => {
        if (cancelled) return
        countersRef.current = { fotos: 0, videos: 0 }
        setCountersState(countersRef.current)
        toast.error('No pudimos cargar tus contadores. Los límites podrían no reflejarse bien.')
      })

    return () => {
      cancelled = true
    }
  }, [invitadoId])

  // Load the guest's previously uploaded files once on mount, so "Tus
  // recuerdos" survives a page reload instead of only showing whatever was
  // uploaded in the current browser session.
  useEffect(() => {
    if (!token) return
    let cancelled = false

    apiClient(slug)
      .misArchivos()
      .then(({ archivos: rows }) => {
        if (cancelled) return
        setItems((prev) => [
          ...rows.map(
            (row): UploadItem => ({
              id: row.id,
              archivoId: row.id,
              tipo: row.tipo,
              previewUrl: null,
              r2Key: row.r2_key,
              progress: 100,
              status: 'done',
            })
          ),
          ...prev,
        ])
      })
      .catch(() => {
        if (!cancelled) toast.error('No pudimos cargar tus fotos y videos anteriores.')
      })

    return () => {
      cancelled = true
    }
  }, [token, slug])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Release object URLs on unmount only — reading previews from the ref
  // avoids re-running this effect (and revoking live previews) every time
  // `items` changes during an upload.
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

  function setCounters(next: Counters) {
    countersRef.current = next
    setCountersState(next)
  }

  async function uploadFile(file: File, tipo: Tipo) {
    const id =
      typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    const previewUrl = tipo === 'foto' ? URL.createObjectURL(file) : null

    setItems((prev) => [
      ...prev,
      {
        id,
        archivoId: null,
        tipo,
        previewUrl,
        r2Key: null,
        progress: 0,
        status: tipo === 'foto' ? 'compressing' : 'uploading',
      },
    ])

    let uploadableFile = file
    if (tipo === 'foto') {
      try {
        const compressedBlob = await imageCompression(file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
          fileType: file.type,
        })
        uploadableFile = new File([compressedBlob], file.name, { type: file.type })
      } catch {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'error' } : it)))
        toast.error('No se pudo comprimir la imagen. Intentá de nuevo.')
        return
      }
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'uploading' } : it)))
    }

    try {
      const extension = MIME_TO_EXT[file.type]
      const { upload_url, r2_key } = await apiClient(slug).solicitarSubida(tipo, extension)

      await putWithProgress(upload_url, uploadableFile, (pct) => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress: pct } : it)))
      })

      const { archivo_id } = await apiClient(slug).confirmarSubida(r2_key, tipo, extension)

      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, archivoId: archivo_id, r2Key: r2_key, status: 'done', progress: 100 }
            : it
        )
      )
      setCounters({
        fotos: countersRef.current.fotos + (tipo === 'foto' ? 1 : 0),
        videos: countersRef.current.videos + (tipo === 'video' ? 1 : 0),
      })
    } catch (err) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'error' } : it)))
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo subir el archivo. Intentá de nuevo.'
      toast.error(message)
    }
  }

  async function handleEliminarConfirmado() {
    if (!deleteTarget?.archivoId) return

    setIsDeleting(true)
    try {
      await apiClient(slug).eliminarArchivo(deleteTarget.archivoId)

      if (deleteTarget.previewUrl) URL.revokeObjectURL(deleteTarget.previewUrl)
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id))
      setCounters({
        fotos: countersRef.current.fotos - (deleteTarget.tipo === 'foto' ? 1 : 0),
        videos: countersRef.current.videos - (deleteTarget.tipo === 'video' ? 1 : 0),
      })
      setDeleteTarget(null)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo eliminar el archivo. Intentá de nuevo.'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  async function processFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const warned = new Set<Tipo>()

    for (const file of Array.from(fileList)) {
      const tipo = tipoFromMime(file.type)

      if (!tipo || !ALLOWED_MIME[tipo].includes(file.type)) {
        toast.error(`Formato no soportado${file.type ? `: ${file.type}` : ''}.`)
        continue
      }

      if (file.size > MAX_BYTES[tipo]) {
        toast.error(
          `${tipo === 'foto' ? 'La foto' : 'El video'} supera el tamaño máximo permitido (${MAX_LABEL[tipo]}).`
        )
        continue
      }

      const limite = tipo === 'foto' ? limiteFotos : limiteVideos
      const usados = tipo === 'foto' ? countersRef.current.fotos : countersRef.current.videos

      if (usados >= limite) {
        if (!warned.has(tipo)) {
          toast.error(`Ya usaste tus ${limite} ${tipo === 'foto' ? 'fotos' : 'videos'}.`)
          warned.add(tipo)
        }
        continue
      }

      // Sequential on purpose: each upload's success updates countersRef
      // before the next file in the batch is checked against the limit.
      await uploadFile(file, tipo)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    void processFiles(e.target.files)
    e.target.value = ''
  }

  if (!isLoaded || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-backdrop">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    )
  }

  const countersLoaded = counters !== null
  const fotosUsadas = counters?.fotos ?? 0
  const videosUsadas = counters?.videos ?? 0
  const fotoAtLimit = fotosUsadas >= limiteFotos
  const videoAtLimit = videosUsadas >= limiteVideos

  return (
    <div className="flex min-h-screen flex-col bg-backdrop">
      <header className="fixed top-0 z-30 flex h-12 w-full items-center justify-between bg-background/80 px-4 backdrop-blur-md">
        <Link
          href={`/e/${slug}`}
          aria-label="Volver al evento"
          className="flex h-8 w-8 items-center justify-center text-primary transition-opacity active:opacity-70"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h2 className="truncate font-[family-name:var(--font-playfair)] text-lg font-bold text-primary">
          {nombreEvento}
        </h2>
        <div className="w-8" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-16">
        {/* Counters */}
        {nombre && (
          <h2 className="mb-4 font-[family-name:var(--font-playfair)] text-xl font-bold text-foreground">
            Hola {nombre}
          </h2>
        )}
        <section className="mt-6 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Fotos
              </span>
              <span className="text-xs font-bold text-primary">
                {countersLoaded ? `${fotosUsadas} de ${limiteFotos} fotos usadas` : 'Cargando…'}
              </span>
            </div>
            <Progress
              value={countersLoaded ? Math.min(100, (fotosUsadas / Math.max(limiteFotos, 1)) * 100) : 0}
              className="h-1.5"
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Videos
              </span>
              <span className="text-xs font-bold text-primary">
                {countersLoaded ? `${videosUsadas} de ${limiteVideos} videos usados` : 'Cargando…'}
              </span>
            </div>
            <Progress
              value={countersLoaded ? Math.min(100, (videosUsadas / Math.max(limiteVideos, 1)) * 100) : 0}
              className="h-1.5"
            />
          </div>
        </section>

        {/* Action buttons */}
        <section className="mt-6 grid grid-cols-2 gap-4">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={!countersLoaded || fotoAtLimit}
            className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground shadow-md transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <Camera className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest">Sacar foto</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={!countersLoaded || (fotoAtLimit && videoAtLimit)}
            className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-secondary text-primary shadow-sm transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <Images className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest">Elegir de galería</span>
          </button>
        </section>

        {/* Uploaded grid */}
        <section className="mt-8">
          <h2 className="mb-4 font-[family-name:var(--font-playfair)] text-xl font-bold text-foreground">
            Tus recuerdos
          </h2>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no subiste nada. Sacá una foto o elegí una de tu galería.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-sm"
                >
                  {item.tipo === 'foto' && (item.previewUrl || item.r2Key) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl ?? `${R2_PUBLIC_URL}/${item.r2Key}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl" aria-hidden="true">
                      🎬
                    </div>
                  )}

                  {item.status === 'compressing' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                      <span className="animate-pulse text-[11px] font-semibold text-muted-foreground">
                        Comprimiendo…
                      </span>
                    </div>
                  )}

                  {item.status === 'uploading' && (
                    <div className="absolute inset-x-0 bottom-0 bg-background/80 p-1.5">
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  )}

                  {item.status === 'done' && (
                    <>
                      <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </div>
                      {item.archivoId && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          aria-label="Eliminar"
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}

                  {item.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-center text-[11px] font-semibold text-white">
                      Error al subir
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borra tu foto o video de forma permanente. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                handleEliminarConfirmado()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
