'use client'

import { HardDrive, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

// Rough sizes used for the estimate. Photos are compressed in the guest's
// browser before upload (max 2048px / 2 MB — see e/[slug]/subir), so they
// usually land around 0.5–1 MB. Videos are uploaded as-is: a 30 s phone
// video in 1080p is ~60 MB (4K is roughly 3x that).
const MB_POR_FOTO = 1
const MB_POR_VIDEO = 60
const MB_GRATIS = 10 * 1024 // Cloudflare R2 free tier: 10 GB

function formatGB(mb: number) {
  const gb = mb / 1024
  return gb < 1
    ? `${Math.round(mb)} MB`
    : `${gb.toLocaleString('es-AR', { maximumFractionDigits: 1 })} GB`
}

const n = (value: number) => value.toLocaleString('es-AR')

interface Props {
  registros: number
  fotosPorInvitado: number
  videosPorInvitado: number
}

export function EstimadorAlmacenamiento({ registros, fotosPorInvitado, videosPorInvitado }: Props) {
  const totalFotos = registros * fotosPorInvitado
  const totalVideos = registros * videosPorInvitado
  const mbFotos = totalFotos * MB_POR_FOTO
  const mbVideos = totalVideos * MB_POR_VIDEO
  const mbTotal = mbFotos + mbVideos
  const porcentaje = (mbTotal / MB_GRATIS) * 100

  const estado = porcentaje > 100 ? 'excede' : porcentaje > 70 ? 'justo' : 'ok'

  // How many videos per guest fit in the free 10 GB, keeping the photo limit.
  const mbLibresPorInvitado = registros > 0 ? MB_GRATIS / registros - fotosPorInvitado * MB_POR_FOTO : 0
  const videosQueEntran = Math.max(0, Math.floor(mbLibresPorInvitado / MB_POR_VIDEO))
  const fotosSinVideos = registros > 0 ? Math.floor(MB_GRATIS / MB_POR_FOTO / registros) : 0

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HardDrive className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">Espacio estimado</p>
          <p className="text-sm text-muted-foreground">
            Si cada invitado usa todo su cupo (en la práctica suele ser menos).
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">{formatGB(mbTotal)}</span>
          <span className="text-sm text-muted-foreground">de 10 GB gratis</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              estado === 'ok' && 'bg-emerald-500',
              estado === 'justo' && 'bg-amber-500',
              estado === 'excede' && 'bg-destructive',
            )}
            style={{ width: `${Math.min(100, porcentaje)}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Hasta {n(totalFotos)} fotos (~{formatGB(mbFotos)}) y {n(totalVideos)} videos (~
          {formatGB(mbVideos)}).
        </p>
      </div>

      {estado === 'excede' && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Con estos límites podrías pasarte de los 10 GB gratis de Cloudflare, y te cobrarían el
          excedente (unos centavos de dólar por GB por mes).{' '}
          {videosPorInvitado > videosQueEntran &&
            (videosQueEntran > 0
              ? `Para entrar en el plan gratis, bajá a ${videosQueEntran} ${videosQueEntran === 1 ? 'video' : 'videos'} por invitado.`
              : `Para entrar en el plan gratis, probá sin videos: así cada invitado puede subir hasta ${n(fotosSinVideos)} fotos.`)}
        </p>
      )}
      {estado === 'justo' && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-800">
          Estás cerca del límite gratis. Recordá que los 10 GB son para todos tus eventos juntos.
        </p>
      )}

      <details className="group rounded-md bg-secondary/60 p-3 text-sm text-muted-foreground">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground">
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
          ¿Cuánto pesa cada cosa?
          <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Ver</span>
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Una foto pesa alrededor de 1 MB.</strong> Album
            achica cada foto antes de subirla, sin que se note en el celular, así que en 10 GB te
            entran unas <strong className="text-foreground">10.000 fotos</strong>. Por ejemplo:
            1.000 invitados con 10 fotos cada uno, o 2.000 con 5.
          </li>
          <li>
            <strong className="text-foreground">Un video de 30 segundos pesa unos 60 MB</strong>,
            lo mismo que 60 fotos. Si está grabado en 4K, pesa unas 3 veces más. Cada video puede
            pesar hasta 200 MB.
          </li>
          <li>
            <strong className="text-foreground">Fotos de iPhone:</strong> las &quot;Live
            Photos&quot; graban un pedacito de video, pero al subirlas a Album se sube solo la
            foto, así que pesan como una foto común.
          </li>
          <li>
            <strong className="text-foreground">Los 10 GB son para toda tu cuenta</strong>, no
            por evento. Si ya descargaste el álbum de un evento viejo, borrar sus fotos te libera
            espacio para el próximo.
          </li>
        </ul>
      </details>
    </div>
  )
}
