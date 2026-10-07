import Link from 'next/link'
import { Camera, Check, HardDrive, QrCode, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectorDonacion } from '@/components/selector-donacion'
import { SiteFooter } from '@/components/site-footer'
import { OrganizadorTopbar } from '@/components/organizador-topbar'

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
        <section className="bg-primary px-4 py-20 text-center text-primary-foreground">
          <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Los recuerdos de tu evento, en un solo lugar.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Album junta las fotos y videos que sacan tus invitados durante la fiesta, con un
            simple código QR. Gratis, sin límite de eventos.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/registro">Crear cuenta gratis</Link>
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
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-foreground">Cómo funciona</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <QrCode className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Creás tu evento</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Configurás los límites y recibís un QR listo para imprimir o compartir.
              </p>
            </div>
            <div className="text-center">
              <Camera className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Tus invitados suben fotos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Escanean el QR, se registran en segundos y suben fotos y videos desde el celular.
              </p>
            </div>
            <div className="text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Vos moderás todo</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Aprobás, ocultás o eliminás lo que suben, y descargás todo en un ZIP.
              </p>
            </div>
          </div>
        </section>

        {/* Almacenamiento propio (Cloudflare R2) */}
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-secondary/40 p-6 sm:p-10">
            <div className="flex items-center gap-3">
              <HardDrive className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                Antes de empezar: tu propio almacenamiento
              </h2>
            </div>
            <p className="mt-4 text-muted-foreground">
              Album no guarda las fotos en un servidor nuestro: las guarda en{' '}
              <strong className="text-foreground">tu propia cuenta de Cloudflare R2</strong>, un
              servicio de almacenamiento en la nube. Por eso, para crear eventos vas a necesitar
              tus credenciales de R2.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">Las fotos son tuyas:</strong> quedan en tu
                  cuenta y nadie más tiene acceso.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">Gratis hasta 10 GB</strong>, que alcanzan
                  para miles de fotos. Cloudflare te pide una tarjeta al activar R2, pero no te
                  cobra nada mientras no pases ese límite.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">Se configura una sola vez</strong>, en unos
                  10 minutos, y te sirve para todos tus eventos.
                </span>
              </li>
            </ul>
            <Button asChild className="mt-6">
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