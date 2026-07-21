import { notFound } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { CalendarCheck2 } from 'lucide-react'
import { obtenerEvento } from '@/app/(organizador)/actions/eventos.actions'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { QRActions } from './_components/QRActions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function QRPage({ params }: Props) {
  const { id } = await params
  const evento = await obtenerEvento(id)

  if (!evento) notFound()

  const eventUrl = `${process.env.PUBLIC_APP_URL ?? 'https://www.album.com.ar'}/evento/${evento.slug}`

  const qrDataUrl = await QRCode.toDataURL(eventUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  })

  return (
    <div className="flex min-h-screen flex-col">
      <OrganizadorTopbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
              Evento activado
            </span>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                Compartí tu evento
              </h1>
              <p className="text-base text-muted-foreground">
                El código QR de <span className="font-semibold text-foreground">{evento.nombre_evento}</span> ya está
                listo. Tus invitados lo escanean para subir sus fotos y videos.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Link del evento
              </p>
              <div className="flex items-center rounded-lg border border-border bg-secondary/40 px-4 py-3">
                <span className="truncate text-sm text-foreground">{eventUrl}</span>
              </div>
            </div>

            <QRActions qrDataUrl={qrDataUrl} eventUrl={eventUrl} nombreEvento={evento.nombre_evento} />

            <Link
              href="/eventos"
              className="block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Ir a mis eventos
            </Link>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
              <div className="inline-block rounded-xl border border-border bg-white p-4 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`Código QR para ${evento.nombre_evento}`}
                  width={280}
                  height={280}
                  className="block"
                />
              </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-lg font-semibold text-foreground">{evento.nombre_evento}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{evento.fecha}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
