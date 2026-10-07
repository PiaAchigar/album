import { SiteFooter } from '@/components/site-footer'

export default function OrganizadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // has-[[data-panel-nav]]: on mobile the event panel's bottom nav is fixed,
  // so reserve its height below the footer to keep the footer visible.
  return (
    <div className="ctx-organizador flex min-h-screen flex-col bg-backdrop text-foreground has-[[data-panel-nav]]:pb-16 md:has-[[data-panel-nav]]:pb-0">
      {children}
      <SiteFooter />
    </div>
  )
}
