'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { SearchIcon, UsersIcon } from 'lucide-react'
import type { InvitadoConConteos } from '@/app/(organizador)/actions/invitados.actions'

interface Props {
  invitados: InvitadoConConteos[]
  limiteFotos: number
  limiteVideos: number
  search: string
}

function formatearFecha(fecha: Date) {
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function InvitadosClient({ invitados, limiteFotos, limiteVideos, search }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [term, setTerm] = useState(search)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  function handleChange(value: string) {
    setTerm(value)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    }, 300)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Invitados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {invitados.length} {invitados.length === 1 ? 'invitado' : 'invitados'}
        </p>
      </div>

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={term}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Buscar por nombre o apellido..."
          className="pl-9"
        />
      </div>

      {invitados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UsersIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">No hay invitados</h2>
          <p className="text-sm text-muted-foreground">
            {search
              ? 'Ningún invitado coincide con esta búsqueda.'
              : 'Todavía no se registró ningún invitado.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {invitados.map((invitado) => (
            <div
              key={invitado.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-foreground">
                  {invitado.nombre} {invitado.apellido}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {invitado.telefono ? invitado.telefono : 'Sin teléfono'}
                  {invitado.created_at ? ` · ${formatearFecha(invitado.created_at)}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm text-muted-foreground">
                <p>
                  {invitado.fotos_subidas}/{limiteFotos} fotos
                </p>
                <p>
                  {invitado.videos_subidos}/{limiteVideos} videos
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
