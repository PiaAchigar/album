import Link from 'next/link'
import { HardDriveIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const BYTES_GRATIS = 10 * 1024 ** 3 // Cloudflare R2 free tier: 10 GB

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 ** 2)} MB`
  return `${(bytes / 1024 ** 3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} GB`
}

interface Props {
  bytesEvento: number
  bytesCuenta: number
  archivosSinTamano: number
}

export function EspacioUsadoCard({ bytesEvento, bytesCuenta, archivosSinTamano }: Props) {
  const porcentaje = (bytesCuenta / BYTES_GRATIS) * 100
  const estado = porcentaje > 100 ? 'excede' : porcentaje > 80 ? 'justo' : 'ok'

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Espacio usado</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HardDriveIcon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-bold text-foreground">
          {formatBytes(bytesEvento)}
          <span className="ml-2 text-base font-normal text-muted-foreground">en este evento</span>
        </p>

        <div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn(
                'h-full rounded-full',
                estado === 'ok' && 'bg-emerald-500',
                estado === 'justo' && 'bg-amber-500',
                estado === 'excede' && 'bg-destructive',
              )}
              style={{ width: `${Math.max(1, Math.min(100, porcentaje))}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Toda tu cuenta: <strong className="text-foreground">{formatBytes(bytesCuenta)}</strong> de
            10 GB gratis en Cloudflare R2.
          </p>
        </div>

        {estado !== 'ok' && (
          <p
            className={cn(
              'rounded-md p-3 text-sm',
              estado === 'excede' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-800',
            )}
          >
            {estado === 'excede'
              ? 'Superaste los 10 GB gratis: Cloudflare te cobra el excedente. '
              : 'Te estás acercando a los 10 GB gratis. '}
            Descargá el ZIP de tus eventos terminados y borrá esas fotos para liberar espacio.
          </p>
        )}

        {archivosSinTamano > 0 && (
          <p className="text-xs text-muted-foreground">
            {archivosSinTamano === 1
              ? '1 archivo subido antes de esta función no está contado.'
              : `${archivosSinTamano} archivos subidos antes de esta función no están contados.`}{' '}
            El total exacto lo ves en tu{' '}
            <Link
              href="https://dash.cloudflare.com/?to=/:account/r2/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              panel de Cloudflare
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  )
}
