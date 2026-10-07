import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CreditCard, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { SiteFooter } from '@/components/site-footer'
import { CopiarBoton } from './CopiarBoton'

export const metadata: Metadata = {
  title: 'Guía: configurar tu almacenamiento — Album',
  description: 'Paso a paso para crear tu cuenta de Cloudflare R2 y conectarla con Album.',
}

// Browser uploads go straight from the guest's phone to the organizer's
// bucket via presigned URLs, so the bucket must allow cross-origin PUT.
// "*" keeps it working across domains; each upload still needs a URL
// signed by our API that expires in 5 minutes.
const CORS_POLICY = `[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]`

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  )
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <li className="relative rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {numero}
        </span>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </li>
  )
}

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
)

export default function GuiaAlmacenamientoPage() {
  return (
    <div className="ctx-organizador flex min-h-screen flex-col bg-backdrop">
      <OrganizadorTopbar
        action={
          <Button asChild variant="outline">
            <Link href="/login">Ingresar</Link>
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Cómo configurar tu almacenamiento
        </h1>
        <p className="mt-3 text-muted-foreground">
          Album guarda las fotos y videos de tus eventos en tu propia cuenta de{' '}
          <B>Cloudflare R2</B>. Esta guía te lleva desde cero hasta tener los 4 datos que Album te
          pide: <B>Account ID</B>, <B>Access Key ID</B>, <B>Secret Access Key</B> y{' '}
          <B>nombre del bucket</B>. Lo hacés una sola vez y te tarda unos 10 minutos.
        </p>

        <div className="mt-6 flex gap-3 rounded-xl border border-border bg-card p-5">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Sobre la tarjeta de crédito</p>
            <p className="mt-1">
              Para activar R2, Cloudflare te va a pedir una tarjeta de crédito o débito (o PayPal).
              Es un requisito de ellos para habilitar el servicio, <B>no un cobro</B>. El plan
              gratuito incluye <B>10 GB de almacenamiento por mes</B>, y mientras no lo superes no
              te cobran nada. Como referencia, 10 GB alcanzan para unas 3.000 a 5.000 fotos de
              celular, o bastante menos si tus invitados suben muchos videos. Si algún mes pasás
              ese límite, Cloudflare te cobra solo el excedente, que es de centavos de dólar por GB.
            </p>
          </div>
        </div>

        <ol className="mt-10 space-y-6">
          <Paso numero={1} titulo="Creá tu cuenta de Cloudflare">
            <p>
              Entrá a <ExtLink href="https://dash.cloudflare.com/sign-up">dash.cloudflare.com/sign-up</ExtLink>{' '}
              y registrate con tu email y una contraseña. Si ya tenés cuenta, simplemente{' '}
              <ExtLink href="https://dash.cloudflare.com/login">iniciá sesión</ExtLink>.
            </p>
            <p>
              Cloudflare te manda un email para <B>verificar tu dirección</B>: abrilo y tocá el
              link antes de seguir, porque sin la verificación no te deja activar R2.
            </p>
            <p>
              Si al entrar te ofrece &quot;agregar un dominio&quot; o &quot;conectar un sitio&quot;, podés
              saltearlo: para Album no necesitás ningún dominio.
            </p>
          </Paso>

          <Paso numero={2} titulo="Activá R2 (acá te pide la tarjeta)">
            <p>
              En el menú de la izquierda, abrí <B>Storage &amp; databases</B> y elegí{' '}
              <B>R2 object storage</B>. También podés ir directo con{' '}
              <ExtLink href="https://dash.cloudflare.com/?to=/:account/r2/overview">este link</ExtLink>.
            </p>
            <p>
              La primera vez vas a ver un botón para activar R2 (puede decir{' '}
              <B>&quot;Purchase R2 Plan&quot;</B> o <B>&quot;Add R2 subscription&quot;</B>). Tocalo, cargá
              tu tarjeta o PayPal y confirmá. El plan que se activa es el gratuito: como explicamos
              arriba, no te cobran nada mientras no superes los 10 GB.
            </p>
          </Paso>

          <Paso numero={3} titulo="Creá tu bucket">
            <p>
              Un <B>bucket</B> es la &quot;carpeta&quot; donde se van a guardar todas las fotos y videos.
              En la pantalla de R2 tocá <B>Create bucket</B>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <B>Bucket name:</B> elegí un nombre en minúsculas, sin espacios ni tildes, por
                ejemplo <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">album-fotos</code>.
                Anotalo, porque es uno de los 4 datos que vas a cargar en Album.
              </li>
              <li>
                <B>Location:</B> dejá <B>Automatic</B>.
              </li>
              <li>
                <B>Default storage class:</B> dejá <B>Standard</B>.
              </li>
            </ul>
            <p>
              Tocá <B>Create bucket</B> para terminar.
            </p>
          </Paso>

          <Paso numero={4} titulo="Permití que los celulares de tus invitados suban fotos (CORS)">
            <p>
              Las fotos viajan directo desde el celular de cada invitado a tu bucket. Para que
              Cloudflare lo permita, hay que agregar una regla llamada <B>CORS</B>. Suena técnico,
              pero es copiar y pegar:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Entrá a tu bucket y abrí la pestaña <B>Settings</B>.</li>
              <li>
                Buscá la sección <B>CORS Policy</B> y tocá <B>Add CORS policy</B> (o{' '}
                <B>Edit</B>).
              </li>
              <li>Borrá lo que aparezca en el editor, pegá este texto y guardá con <B>Save</B>:</li>
            </ol>
            <div className="rounded-lg border border-border bg-secondary/60">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-widest">Regla CORS</span>
                <CopiarBoton texto={CORS_POLICY} />
              </div>
              <pre className="overflow-x-auto p-4 text-xs text-foreground">{CORS_POLICY}</pre>
            </div>
            <div className="flex gap-2 rounded-lg bg-secondary/60 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p>
                Si te salteás este paso, Album va a aceptar tus credenciales igual, pero tus
                invitados van a ver un error al intentar subir fotos.
              </p>
            </div>
          </Paso>

          <Paso numero={5} titulo="Creá las llaves de acceso (API token)">
            <p>
              Ahora vas a crear las llaves que Album usa para guardar fotos en tu bucket. Volvé a
              la pantalla principal de <B>R2 object storage</B>; a la derecha (o abajo, en
              celular) vas a ver la sección <B>API</B> o <B>API Tokens</B>. Tocá{' '}
              <B>Manage API tokens</B> y después <B>Create Account API token</B>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <B>Token name:</B> cualquier nombre que te sirva para reconocerlo, por ejemplo{' '}
                <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">album</code>.
              </li>
              <li>
                <B>Permissions:</B> elegí <B>Object Read &amp; Write</B> (leer y escribir archivos).
                No hace falta &quot;Admin&quot;.
              </li>
              <li>
                <B>Specify bucket(s):</B> elegí <B>Apply to specific buckets only</B> y
                seleccioná el bucket que creaste en el paso 3. Así las llaves solo sirven para ese
                bucket y para nada más de tu cuenta.
              </li>
              <li>
                <B>TTL</B> (vencimiento): dejá <B>Forever</B>. Si le ponés fecha de vencimiento,
                el día que venza Album deja de poder guardar fotos.
              </li>
            </ul>
            <p>
              Tocá <B>Create API Token</B>.
            </p>
          </Paso>

          <Paso numero={6} titulo="Copiá tus datos (¡ojo, la clave secreta se muestra una sola vez!)">
            <p>
              Cloudflare te muestra una pantalla con varios valores. Copiá estos dos y guardalos en
              un lugar seguro, como un gestor de contraseñas o una nota privada:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <B>Access Key ID</B>
              </li>
              <li>
                <B>Secret Access Key</B>: Cloudflare <B>no te la vuelve a mostrar</B>. Si la
                perdés, no pasa nada grave: borrás ese token y creás uno nuevo repitiendo el paso
                5.
              </li>
            </ul>
            <p>
              Te falta el <B>Account ID</B>. Lo encontrás en la pantalla principal de R2, en la
              sección <B>Account Details</B> (a la derecha), o en la dirección de tu navegador:
              es el código largo de letras y números que aparece justo después de{' '}
              <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">dash.cloudflare.com/</code>.
            </p>
            <p>
              Esa pantalla también muestra un &quot;Token value&quot; y un endpoint
              &quot;S3&quot;: <B>no los necesitás</B> para Album.
            </p>
          </Paso>

          <Paso numero={7} titulo="Cargá los datos en Album">
            <p>
              Entrá a Album con tu cuenta. La primera vez te lleva directo a{' '}
              <B>Configurá tu almacenamiento</B> (si ya lo habías hecho, está en{' '}
              <Link href="/configuracion/storage" className="font-medium text-primary underline underline-offset-2">
                Configuración de almacenamiento
              </Link>
              ). Completá los 4 campos:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><B>Account ID</B> (paso 6)</li>
              <li><B>Access Key ID</B> (paso 6)</li>
              <li><B>Secret Access Key</B> (paso 6)</li>
              <li><B>Nombre del bucket</B> (paso 3)</li>
            </ul>
            <p>
              Tocá <B>Guardar y verificar</B>. Album hace una prueba: guarda un archivo chiquito en
              tu bucket y lo borra enseguida. Si sale bien, ya podés crear tu primer evento. Tus
              credenciales se guardan cifradas.
            </p>
          </Paso>
        </ol>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Si algo no funciona</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <B>&quot;No pudimos conectarnos a tu bucket&quot;</B> al guardar: revisá que no haya
              espacios de más al copiar, que el nombre del bucket esté escrito igual que en
              Cloudflare, y que el token tenga permiso <B>Object Read &amp; Write</B> sobre ese
              bucket.
            </li>
            <li>
              <B>Los invitados no pueden subir fotos:</B> casi siempre es la regla CORS del paso 4.
              Revisá que esté guardada en el bucket correcto.
            </li>
            <li>
              <B>No encontrás un botón:</B> Cloudflare cambia a veces los nombres y la ubicación
              de las opciones. Buscá la palabra clave (por ejemplo &quot;R2&quot;, &quot;CORS&quot; o
              &quot;API token&quot;) en el buscador del panel de Cloudflare.
            </li>
            <li>
              ¿Seguís trabado? Escribinos a{' '}
              <a href="mailto:complexa.ia@gmail.com" className="font-medium text-primary underline underline-offset-2">
                complexa.ia@gmail.com
              </a>
              .
            </li>
          </ul>
        </section>

        <div className="mt-10 text-center">
          <Button asChild size="lg">
            <Link href="/registro">Crear mi cuenta en Album</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
