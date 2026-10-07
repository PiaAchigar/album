import Link from 'next/link'
import { Camera, Check, HardDrive, QrCode, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectorDonacion } from '@/components/selector-donacion'
import { SiteFooter } from '@/components/site-footer'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { BRAND_COLORS, PolaroidStack } from '@/components/polaroid-stack'

const PASOS = [
  {
    titulo: 'Creás tu evento',
    texto: 'Configurás los límites y recibís un QR listo para imprimir o compartir.',
    icon: QrCode,
    color: BRAND_COLORS.gold,
    rotate: 'sm:-rotate-2',
  },
  {
    titulo: 'Tus invitados suben fotos',
    texto: 'Escanean el QR, se registran en segundos y suben fotos y videos desde el celular.',
    icon: Camera,
    color: '#F472B6', // deeper pink so the white icon stays readable
    rotate: 'sm:rotate-1',
  },
  {
    titulo: 'Vos moderás todo',
    texto: 'Aprobás, ocultás o eliminás lo que suben, y descargás todo en un ZIP.',
    icon: ShieldCheck,
    color: '#64748B',
    rotate: 'sm:-rotate-1',
  },
]

interface Props {
  searchParams: Promise<{ donacion?: string }>
}

const MENSAJES_DONACION: Record<string, string> = {
  aprobada: '¡Gracias por tu donación! Ya se acreditó.',
  pendiente: 'Tu donación está pendiente de confirmación.',
  rechazada: 'No pudimos procesar tu donación. Podés intentar de nuevo cuando quieras.',
}

export default async function HomePage({ searchParams }: Props) {
  const { donacion } = await searchParams
  const mensajeDonacion = donacion ? MENSAJES_DONACION[donacion] : null

  return (
    <div className="ctx-organizador flex min-h-screen flex-col">
      <OrganizadorTopbar
        action={
          <Button asChild variant="outline">
            <Link href="/login">Ingresar</Link>
          </Button>
        }
      />
      <main className="flex-1">
        {mensajeDonacion && (
          <div className="bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">
            {mensajeDonacion}
          </div>
        )}

        {/* Hero */}
        <section className="overflow-hidden bg-primary px-4 py-16 text-primary-foreground sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_1fr]">
            <div className="text-center md:text-left">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-primary"
                style={{ background: BRAND_COLORS.gold }}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                100% gratis
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Todas las fotos de tu fiesta, en un solo álbum.
              </h1>
              <div
                className="mx-auto mt-6 h-1.5 w-20 rounded-full md:mx-0"
                style={{ background: BRAND_COLORS.gold }}
                aria-hidden="true"
              />
              <p className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/80 md:mx-0">
                Tus invitados escanean un QR y suben las fotos y videos que sacaron. Vos los
                tenés todos juntos, sin perseguir a nadie por WhatsApp.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
                <Button asChild size="lg" variant="secondary" className="font-semibold">
                  <Link href="/registro">Crear mi cuenta gratis</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link href="/login">Ya tengo cuenta</Link>
                </Button>
              </div>
              <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-primary-foreground/80 md:justify-start">
                {['Sin costo', 'Sin suscripción', 'Eventos ilimitados'].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4" style={{ color: BRAND_COLORS.gold }} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <PolaroidStack className="mx-auto max-w-[280px] sm:max-w-sm md:max-w-md" />
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h2 className="text-center text-3xl font-bold text-foreground">Cómo funciona</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
            Tres pasos y listo. Vos disfrutás la fiesta, Album junta los recuerdos.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
            {PASOS.map(({ titulo, texto, icon: Icon, color, rotate }, i) => (
              <li
                key={titulo}
                className={`rounded-xl bg-white p-4 pb-6 shadow-lg ring-1 ring-border transition-transform duration-300 hover:rotate-0 hover:scale-[1.03] ${rotate}`}
              >
                <div
                  className="relative flex aspect-[16/9] items-center justify-center rounded-lg sm:aspect-[4/3]"
                  style={{ background: color }}
                >
                  <Icon className="h-14 w-14 text-white" strokeWidth={1.75} aria-hidden="true" />
                  <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-bold text-primary shadow">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Almacenamiento propio (Cloudflare R2) */}
        <section className="bg-primary px-4 py-16 text-primary-foreground sm:py-20">
          <div className="mx-auto max-w-3xl rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 sm:p-10">
            <div className="flex items-center gap-3">
              <HardDrive className="h-7 w-7 shrink-0" style={{ color: BRAND_COLORS.gold }} aria-hidden="true" />
              <h2 className="text-xl font-bold text-primary-foreground sm:text-2xl">
                Antes de empezar: tu propio almacenamiento
              </h2>
            </div>
            <p className="mt-4 text-primary-foreground/80">
              Album no guarda las fotos en un servidor nuestro: las guarda en{' '}
              <strong className="text-primary-foreground">tu propia cuenta de Cloudflare R2</strong>, un
              servicio de almacenamiento en la nube. Por eso, para crear eventos vas a necesitar
              tus credenciales de R2.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND_COLORS.gold }} aria-hidden="true" />
                <span>
                  <strong className="text-primary-foreground">Las fotos son tuyas:</strong> quedan en tu
                  cuenta y nadie más tiene acceso.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND_COLORS.gold }} aria-hidden="true" />
                <span>
                  <strong className="text-primary-foreground">Gratis hasta 10 GB</strong>, que alcanzan
                  para miles de fotos. Cloudflare te pide una tarjeta al activar R2, pero no te
                  cobra nada mientras no pases ese límite.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND_COLORS.gold }} aria-hidden="true" />
                <span>
                  <strong className="text-primary-foreground">Se configura una sola vez</strong>, en unos
                  10 minutos, y te sirve para todos tus eventos.
                </span>
              </li>
            </ul>
            <Button asChild variant="secondary" className="mt-6 font-semibold">
              <Link href="/guia-almacenamiento">Ver guía paso a paso</Link>
            </Button>
          </div>
        </section>

        {/* Donación */}
        <section className="bg-backdrop px-4 py-16">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-2xl font-bold text-foreground">¿Te sirvió Album?</h2>
            <p className="mt-2 text-muted-foreground">
              Es gratis y siempre lo va a ser. Si querés bancar el proyecto, cualquier donación
              ayuda — es totalmente voluntaria.
            </p>
            <div className="mt-6">
              <SelectorDonacion origen="landing" />
            </div>
            <Link
              href="/politicas/donaciones"
              className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Ver política de donaciones
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}