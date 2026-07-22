'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { estadoInfo } from '@/lib/archivo-estado'
import {
  aprobarArchivo,
  ocultarArchivo,
  eliminarArchivo,
  type ArchivoConInvitado,
} from '@/app/(organizador)/actions/archivos.actions'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

interface Props {
  eventoId: string
  archivo: ArchivoConInvitado
  prevId: string | null
  nextId: string | null
}

function formatearFechaHora(fecha: Date | null) {
  if (!fecha) return ''
  const texto = new Date(fecha).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function DetalleClient({ eventoId, archivo, prevId, nextId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const galeriaPath = `/eventos/${eventoId}/galeria`
  const { label, variant } = estadoInfo(archivo.estado)

  function irAGaleria() {
    router.push(galeriaPath)
  }

  function irA(id: string | null) {
    if (!id) return
    router.push(`${galeriaPath}/${id}`)
  }

  function handleAprobar() {
    startTransition(async () => {
      const result = await aprobarArchivo(archivo.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleOcultar() {
    startTransition(async () => {
      const result = await ocultarArchivo(archivo.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  async function handleEliminarConfirmado() {
    setIsDeleting(true)
    const result = await eliminarArchivo(archivo.id)
    setIsDeleting(false)
    setDeleteOpen(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    router.push(galeriaPath)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {archivo.invitado_nombre} {archivo.invitado_apellido}
          </p>
          <p className="truncate text-xs text-white/60">{formatearFechaHora(archivo.created_at)}</p>
        </div>
        <Badge variant={variant}>{label}</Badge>
        <button
          type="button"
          onClick={irAGaleria}
          aria-label="Cerrar y volver a la galería"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Media area */}
      <div className="relative flex-1 overflow-hidden">
        {archivo.tipo === 'video' ? (
          <video
            controls
            src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
            className="mx-auto h-full max-h-full w-auto max-w-full"
          />
        ) : (
          <Image
            src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
            alt={`Foto de ${archivo.invitado_nombre} ${archivo.invitado_apellido}`}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        )}

        {prevId && (
          <button
            type="button"
            onClick={() => irA(prevId)}
            aria-label="Archivo anterior"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        {nextId && (
          <button
            type="button"
            onClick={() => irA(nextId)}
            aria-label="Archivo siguiente"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black/60 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending || archivo.estado === 'aprobada'}
          onClick={handleAprobar}
          className="border-white/20 bg-transparent text-green-400 hover:bg-green-500/10 hover:text-green-300"
        >
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          Aprobar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || archivo.estado === 'oculta'}
          onClick={handleOcultar}
          className="border-white/20 bg-transparent text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
        >
          <EyeOff className="h-4 w-4" aria-hidden="true" />
          Ocultar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => setDeleteOpen(true)}
          className="border-white/20 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Eliminar
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borra el archivo de forma permanente, tanto de la galería como del
              almacenamiento. No se puede deshacer.
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
