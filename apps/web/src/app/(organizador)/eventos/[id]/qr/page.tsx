import { notFound } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  CalendarCheck2,
  Lightbulb,
  MessageCircle,
  Monitor,
  Printer,
  ScanLine,
  Mic,
  type LucideIcon,
} from 'lucide-react'
import { obtenerEvento } from '@/app/(organizador)/actions/eventos.actions'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { QRActions } from './_components/QRActions'

const CONSEJOS_QR: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: ScanLine,
    titulo: 'Probalo antes de imprimir',
    texto: 'Escanealo con tu celular y fijate que abra la página de tu evento. Mejor no te registres: ocuparías un lugar del cupo de invitados.',
  },
  {
    icon: Printer,
    titulo: 'Ponelo en cada mesa',
    texto: 'Imprimilo de al menos 5 × 5 cm, en un cartelito o portarretrato, con una frase tipo "¡Subí tus fotos de la fiesta!".',
  },
  {
    icon: Monitor,
    titulo: 'Mostralo en la pantalla del salón',
    texto: 'Si hay proyector o pantalla, pasalo entre canción y canción: es el lugar donde más gente lo ve a la vez.',
  },
  {
    icon: MessageCircle,
    titulo: 'Mandá el link al grupo',
    texto: 'Compartí el link en el grupo de WhatsApp del evento, antes y también al día siguiente, para las fotos que quedaron en los celulares.',
  },
  {
    icon: Mic,
    titulo: 'Que lo anuncien',
    texto: 'Pedile al DJ o al animador que lo mencione en algún momento de la noche. Un recordatorio en vivo hace la diferencia.',
  },
]

interface Props {
  params: Promise<{ id: string }>
}

export default async function QRPage({ params }: Props) {
  const { id } = await params
  const evento = await obtenerEvento(id)

  if (!evento) notFound()

  const eventUrl = `${process.env.PUBLIC_APP_URL ?? 'https://www.album.com.ar'}/e/${evento.slug}`

  const qrDataUrl = await QRCode.toDataURL(eventUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  })

  return (
    <div className="flex flex-1 flex-col">
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

        <section className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Ideas para que todos lo usen
          </h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2">
            {CONSEJOS_QR.map(({ icon: Icon, titulo, texto }) => (
              <li key={titulo} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
