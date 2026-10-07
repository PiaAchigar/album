
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Album',
  description: 'Condiciones de uso de Album para organizadores e invitados.',
}

// Draft text — pending review by someone qualified before relying on it
// legally (see CLAUDE.md, Fase 3).
export default function TerminosPage() {
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

        <h1 className="text-3xl font-bold text-foreground">Términos y Condiciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 6 de octubre de 2026</p>

        <div className="mt-8 space-y-8 text-foreground">
          <p>
            <strong>Album</strong> es una plataforma desarrollada por Complexa IA que permite a
            quien organiza un evento recolectar las fotos y videos que sacan sus invitados, a
            través de un código QR. Al usar Album aceptás estos términos.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Organizadores</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Para crear eventos necesitás una cuenta con un email válido. Sos responsable de
                mantener tu contraseña segura y de la actividad que ocurra en tu cuenta.
              </li>
              <li>
                Sos responsable del evento que creás, de compartir el QR solo con tus invitados y
                de moderar el contenido que se sube a tu álbum.
              </li>
              <li>
                Las fotos y videos se guardan en el almacenamiento que configurás en tu cuenta.
                Podés aprobarlos, ocultarlos, eliminarlos o descargarlos cuando quieras.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Invitados</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Para subir contenido te pedimos nombre, apellido y, si querés, tu teléfono. No
                hace falta crear una cuenta.
              </li>
              <li>
                Al subir fotos o videos autorizás que se muestren en el álbum del evento y que el
                organizador pueda verlos, moderarlos, descargarlos y compartirlos con los demás
                asistentes.
              </li>
              <li>
                Cada evento puede tener un límite de invitados y de fotos y videos por persona,
                definido por el organizador.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Contenido permitido</h2>
            <p className="mt-2">
              Solo podés subir fotos y videos que hayas sacado vos o que tengas derecho a compartir.
              No está permitido subir contenido ilegal, violento, sexual, discriminatorio o que
              afecte la privacidad de otras personas. El organizador o Album pueden eliminar
              cualquier contenido que no cumpla estas reglas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Datos personales</h2>
            <p className="mt-2">
              Usamos tus datos solo para que Album funcione: identificar quién subió cada archivo y
              permitir al organizador gestionar su evento. No vendemos tus datos. Podés pedir que
              los corrijamos o eliminemos escribiendo a{' '}
              <a
                href="mailto:complexa.ia@gmail.com"
                className="text-primary underline underline-offset-2"
              >
                complexa.ia@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Donaciones</h2>
            <p className="mt-2">
              Album es gratuito. Las donaciones son voluntarias y se rigen por la{' '}
              <Link
                href="/politicas/donaciones"
                className="text-primary underline underline-offset-2"
              >
                Política de donaciones
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Limitación de responsabilidad</h2>
            <p className="mt-2">
              Album se ofrece tal como está. Hacemos lo posible para que funcione bien y para
              proteger el contenido, pero no podemos garantizar que el servicio esté siempre
              disponible ni libre de errores. Te recomendamos que el organizador descargue el
              álbum al terminar el evento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Cambios y contacto</h2>
            <p className="mt-2">
              Podemos actualizar estos términos; la fecha de arriba indica la última versión. Ante
              cualquier duda, escribinos a{' '}
              <a
                href="mailto:complexa.ia@gmail.com"
                className="text-primary underline underline-offset-2"
              >
                complexa.ia@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
