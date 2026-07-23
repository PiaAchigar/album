import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { CalendarDays, Camera, Clock3 } from 'lucide-react'
import { db } from '@/lib/db'
import { eventos } from '@album/database'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ slug: string }>
}

function formatFecha(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`)
  const texto = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // toLocaleDateString returns an all-lowercase string in es-AR (e.g.
  // "miércoles 3 de julio de 2026"). Capitalize only the first letter —
  // do NOT use Tailwind's `capitalize` utility here, it title-cases every
  // word ("De Julio De") which was already found and fixed for the
  // organizer's event list (see commit bdd4f59).
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function formatHorario(horario: string): string {
  // horario is stored as HH:MM or HH:MM:SS
  return horario.slice(0, 5)
}

export default async function EventoLandingPage({ params }: Props) {
  const { slug } = await params

  const [evento] = await db
    .select()
    .from(eventos)
    .where(eq(eventos.slug, slug))

  if (!evento) notFound()

  const portadaUrl = evento.foto_portada_url
    ? `${process.env.R2_PUBLIC_URL}/${evento.foto_portada_url}`
    : null

  if (evento.estado !== 'activo') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-foreground">
          {evento.nombre_evento}
        </h1>
        <p className="text-muted-foreground">
          Este evento no está activo en este momento.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/*
        Fixed top app bar — mirrors the mockup's TopAppBar, minus the close
        (X) icon. There's nowhere for it to navigate to (a guest lands here
        straight from the QR code, no parent screen to dismiss back to), so
        it's omitted rather than shipped as a dead click — same call as
        OrganizadorTopbar's documented precedent for dropping chrome that
        has no real destination yet.
      */}
      <header className="fixed top-0 z-30 flex h-12 w-full items-center justify-center bg-background/80 px-4 backdrop-blur-md">
        <h2 className="truncate font-[family-name:var(--font-playfair)] text-lg font-bold text-primary">
          {evento.nombre_evento}
        </h2>
      </header>

      <main className="flex-1 pt-12">
        {/* Hero */}
        <section className="relative flex h-[60vh] w-full items-end overflow-hidden sm:h-[70vh]">
          {portadaUrl ? (
            <Image
              src={portadaUrl}
              alt={`Foto de portada de ${evento.nombre_evento}`}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-yellow-200" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          <div className="relative z-10 w-full px-4 pb-8">
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-bold leading-tight text-foreground">
              {evento.nombre_evento}
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>{formatFecha(evento.fecha)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>{formatHorario(evento.horario)} hs</span>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action — pulled up over the hero edge, like the mockup */}
        <section className="relative z-20 -mt-6 px-4 pb-10">
          <Button
            asChild
            size="lg"
            className="h-16 w-full gap-3 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            <Link href={`/e/${slug}/registro`}>
              <Camera className="h-5 w-5" aria-hidden="true" />
              Quiero subir mis fotos
            </Link>
          </Button>
        </section>
      </main>
    </div>
  )
}
