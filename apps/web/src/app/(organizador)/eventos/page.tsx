import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarEventos } from '@/app/(organizador)/actions/eventos.actions'
import { logoutOrganizador } from '@/app/(organizador)/actions/auth.actions'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { CalendarIcon, PlusIcon } from 'lucide-react'

export default async function EventosPage() {
  const misEventos = await listarEventos()

  return (
    <div className="flex min-h-screen flex-col">
      <OrganizadorTopbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Mis eventos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestioná tus eventos y sus galerías.
            </p>
          </div>
          <form action={logoutOrganizador}>
            <Button variant="outline" size="sm" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </div>

        {misEventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 text-center shadow-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CalendarIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Todavía no tenés eventos
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Creá tu primer evento y compartí el QR con tus invitados.
            </p>
            <Button asChild className="h-12 gap-2 text-sm font-semibold uppercase tracking-widest">
              <Link href="/eventos/nuevo">
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                Crear mi primer evento
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button asChild size="sm" className="gap-2">
                <Link href="/eventos/nuevo">
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  Nuevo evento
                </Link>
              </Button>
            </div>
            {misEventos.map((evento) => (
              <Card key={evento.id} className="border-border shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{evento.nombre_evento}</CardTitle>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        evento.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : evento.estado === 'cerrado'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {evento.estado}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>{evento.fecha} — {evento.horario}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
