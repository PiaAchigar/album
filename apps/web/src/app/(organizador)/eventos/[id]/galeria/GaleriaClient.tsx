'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Download, ImageIcon, Play, Trash2 } from 'lucide-react'
import {
  eliminarArchivo,
  type ArchivoConInvitado,
} from '@/app/(organizador)/actions/archivos.actions'
import type { InvitadoConConteos } from '@/app/(organizador)/actions/invitados.actions'
import { estadoInfo } from '@/lib/archivo-estado'
import { ReproduccionModal } from './_components/ReproduccionModal'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

// Sentinel value for shadcn's <Select>, que no admite value="" en SelectItem.
// Se mapea de vuelta a `undefined` (sin filtro) al construir la URL.
const SIN_FILTRO = 'todos'

interface Filters {
  invitadoId?: string
  tipo?: string
  estado?: string
}

interface Props {
  eventoId: string
  archivos: ArchivoConInvitado[]
  archivosAprobados: ArchivoConInvitado[]
  invitados: InvitadoConConteos[]
  filters: Filters
}

export function GaleriaClient({
  eventoId,
  archivos,
  archivosAprobados,
  invitados,
  filters,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isDownloading, setIsDownloading] = useState(false)
  const [reproduccionAbierta, setReproduccionAbierta] = useState(false)

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === SIN_FILTRO) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleEliminar(archivoId: string) {
    startTransition(async () => {
      const result = await eliminarArchivo(archivoId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  async function handleDescargar() {
    setIsDownloading(true)
    try {
      const response = await fetch(`/api/eventos/${eventoId}/galeria/descargar-zip`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al descargar galería')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `galeria-${eventoId}.zip`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Descarga iniciada')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al descargar galería'
      toast.error(message)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Galería</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'}
          </p>
        </div>
        {archivosAprobados.length > 0 && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={isDownloading}
              onClick={handleDescargar}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => setReproduccionAbierta(true)}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Reproducir
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={filters.tipo ?? SIN_FILTRO} onValueChange={(v) => updateFilter('tipo', v)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los tipos</SelectItem>
            <SelectItem value="foto">Fotos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.estado ?? SIN_FILTRO}
          onValueChange={(v) => updateFilter('estado', v)}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="oculta">Oculta</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.invitadoId ?? SIN_FILTRO}
          onValueChange={(v) => updateFilter('invitadoId', v)}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Invitado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los invitados</SelectItem>
            {invitados.map((invitado) => (
              <SelectItem key={invitado.id} value={invitado.id}>
                {invitado.nombre} {invitado.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {archivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">No hay archivos</h2>
          <p className="text-sm text-muted-foreground">
            Todavía no hay fotos ni videos que coincidan con estos filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {archivos.map((archivo) => {
            const { label, variant } = estadoInfo(archivo.estado)
            return (
              <div
                key={archivo.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
              >
                <Link
                  href={`/eventos/${eventoId}/galeria/${archivo.id}`}
                  className="absolute inset-0 z-0 block"
                >
                  {archivo.tipo === 'video' ? (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-4xl">
                      🎬
                    </div>
                  ) : (
                    <Image
                      src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
                      alt={`Foto de ${archivo.invitado_nombre} ${archivo.invitado_apellido}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-sm font-medium text-white">
                      {archivo.invitado_nombre} {archivo.invitado_apellido}
                    </p>
                  </div>
                </Link>

                <div className="absolute right-2 top-2 z-20">
                  <Badge variant={variant}>{label}</Badge>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isPending}
                      aria-label="Eliminar archivo"
                      className="absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-destructive disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción borra el archivo de forma permanente, tanto de la galería
                        como del almacenamiento. No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault()
                          handleEliminar(archivo.id)
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )
          })}
        </div>
      )}

      {reproduccionAbierta && (
        <ReproduccionModal
          archivos={archivosAprobados}
          onClose={() => setReproduccionAbierta(false)}
        />
      )}
    </div>
  )
}
