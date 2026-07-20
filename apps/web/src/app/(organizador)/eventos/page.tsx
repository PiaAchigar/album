import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarEventos } from '@/app/(organizador)/actions/eventos.actions'
import { logoutOrganizador } from '@/app/(organizador)/actions/auth.actions'
import { CalendarIcon, PlusIcon } from 'lucide-react'

export default async function EventosPage() {
  const misEventos = await listarEventos()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Mis eventos</h1>
        <form action={logoutOrganizador}>
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </div>

      {misEventos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <CalendarIcon className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">Todavía no tenés eventos</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Creá tu primer evento y compartí el QR con tus invitados.
          </p>
          <Button asChild>
            <Link href="/eventos/nuevo">
              <PlusIcon className="mr-2 h-4 w-4" />
              Crear mi primer evento
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button asChild size="sm">
              <Link href="/eventos/nuevo">
                <PlusIcon className="mr-2 h-4 w-4" />
                Nuevo evento
              </Link>
            </Button>
          </div>
          {misEventos.map((evento) => (
            <Card key={evento.id} className="transition-shadow hover:shadow-md">
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
    </div>
  )
}
