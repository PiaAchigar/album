import Link from 'next/link'

/**
 * Footer for every non-guest surface (landing, auth, organizer panel,
 * legal pages).
 */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="ctx-organizador shrink-0 bg-primary px-4 py-6 text-primary-foreground sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center text-sm text-primary-foreground/70 sm:flex-row sm:justify-between sm:text-left">
        <p>
          © {year} Album · Hecho por{' '}
          <a
            href="https://www.complexa.com.ar"
            target="_blank"
            rel="noopener"
            className="font-medium text-primary-foreground underline-offset-4 hover:underline"
          >
            Complexa IA
          </a>
        </p>
        <nav aria-label="Legales" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/terminos" className="underline-offset-4 hover:text-primary-foreground hover:underline">
            Términos y Condiciones
          </Link>
          <Link
            href="/politicas/donaciones"
            className="underline-offset-4 hover:text-primary-foreground hover:underline"
          >
            Política de donaciones
          </Link>
        </nav>
      </div>
    </footer>
  )
}

/**
 * Minimal footer for guest screens (/e/[slug]/*). Opens in a new tab so a
 * guest mid-upload never loses their place.
 */
export function InvitadoFooter() {
  return (
    <footer className="shrink-0 px-4 py-4 text-center text-xs text-muted-foreground">
      <Link
        href="/"
        target="_blank"
        rel="noopener"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Hecho con <span className="font-semibold">Album</span>
      </Link>
    </footer>
  )
}
