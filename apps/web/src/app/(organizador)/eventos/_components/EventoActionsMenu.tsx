'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, MoreVertical, Trash2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  cambiarEstadoEvento,
  eliminarEvento,
} from '@/app/(organizador)/actions/eventos.actions'

interface Props {
  eventoId: string
  estado: string
}

export function EventoActionsMenu({ eventoId, estado }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleCambiarEstado(nuevoEstado: 'activo' | 'cerrado') {
    startTransition(async () => {
      const result = await cambiarEstadoEvento(eventoId, nuevoEstado)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleEliminar() {
    startTransition(async () => {
      const result = await eliminarEvento(eventoId)
      setDeleteOpen(false)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Acciones del evento"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          {estado === 'activo' && (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => handleCambiarEstado('cerrado')}
            >
              <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
              Cerrar evento
            </DropdownMenuItem>
          )}
          {estado === 'cerrado' && (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => handleCambiarEstado('activo')}
            >
              <Unlock className="mr-2 h-4 w-4" aria-hidden="true" />
              Reactivar evento
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isPending}
            onSelect={(e) => {
              e.preventDefault()
              setDeleteOpen(true)
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Eliminar evento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borra el evento, todos sus invitados y todos sus archivos (fotos y
              videos, tanto de la base de datos como del almacenamiento). No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault()
                handleEliminar()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
