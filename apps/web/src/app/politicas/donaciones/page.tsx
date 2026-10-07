import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Política de Donaciones — Album',
  description: 'Cómo funcionan las donaciones voluntarias en Album.',
}

export default function PoliticaDonacionesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </Link>

        <h1 className="text-3xl font-bold text-foreground">Política de Donaciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 22 de septiembre de 2026</p>

        <div className="mt-8 space-y-8 text-foreground">
          <p>
            <strong>Album es un proyecto de uso gratuito.</strong> Cualquier persona puede usar la
            plataforma completa — creación de eventos, recolección de fotos y videos por QR, panel
            de moderación — sin costo, utilizando sus propias credenciales de almacenamiento
            (Cloudflare R2). El acceso, registro y uso de Album nunca están condicionados a
            realizar una donación.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Las donaciones son voluntarias</h2>
            <p className="mt-2">
              Si querés donar, podés elegir uno de los montos sugeridos o ingresar el monto que
              prefieras. La donación:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>No es un pago por un servicio ni una suscripción.</li>
              <li>
                No otorga acceso a funciones adicionales, soporte prioritario ni ningún beneficio
                distinto al de cualquier otro usuario de Album.
              </li>
              <li>
                No genera ninguna obligación de nuestra parte hacia quien dona, más allá del
                agradecimiento.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Procesamiento del pago</h2>
            <p className="mt-2">
              Las donaciones se procesan a través de Mercado Pago. Album no almacena datos de
              tarjetas ni de medios de pago — esa información es gestionada directamente por
              Mercado Pago conforme a sus propias políticas de seguridad y privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Reembolsos</h2>
            <p className="mt-2">
              Por tratarse de una donación voluntaria y no de la compra de un producto o servicio,
              las donaciones no son reembolsables, salvo error evidente en la operación (por
              ejemplo, un cobro duplicado o un monto equivocado), que podés reportarnos a{' '}
              <a
                href="mailto:complexa.ia@gmail.com"
                className="text-primary underline underline-offset-2"
              >
                complexa.ia@gmail.com
              </a>{' '}
              para resolverlo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Uso de los fondos</h2>
            <p className="mt-2">
              Los montos donados se destinan a sostener los costos de mantenimiento e
              infraestructura del proyecto (hosting, dominio, servicios de terceros).
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
