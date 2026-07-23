import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { obtenerEvento } from '@/app/(organizador)/actions/eventos.actions'
import { obtenerEstadisticasEvento } from '@/app/(organizador)/actions/archivos.actions'
import { AlertTriangleIcon, ImageIcon, QrCodeIcon, UsersIcon, VideoIcon } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResumenEventoPage({ params }: Props) {
  const { id } = await params
  const [evento, stats] = await Promise.all([obtenerEvento(id), obtenerEstadisticasEvento(id)])
  if (!evento) notFound()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invitados</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersIcon className="h-5 w-5" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {stats.totalInvitados}
              <span className="text-lg font-normal text-muted-foreground">
                /{evento.limite_invitados_login}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fotos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{stats.totalFotos}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Videos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <VideoIcon className="h-5 w-5" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{stats.totalVideos}</p>
          </CardContent>
        </Card>
      </div>

      {stats.pendientes > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{stats.pendientes} archivos</span> pendientes de
              moderar
            </span>
          </p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            <Link href={`/eventos/${id}/galeria?estado=pendiente`}>Ver pendientes</Link>
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <Button asChild>
          <Link href={`/eventos/${id}/galeria`}>Ver galería</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/eventos/${id}/invitados`}>Ver invitados</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/eventos/${id}/qr`}>
            <QrCodeIcon className="h-4 w-4" aria-hidden="true" />
            Ver QR
          </Link>
        </Button>
      </div>
    </div>
  )
}
