import Link from 'next/link'
import { Camera, QrCode, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectorDonacion } from '@/components/selector-donacion'

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
    </div>
  )
}