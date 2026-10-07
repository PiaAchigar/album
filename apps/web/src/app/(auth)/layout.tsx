import { SiteFooter } from '@/components/site-footer'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ctx-organizador flex min-h-screen flex-col bg-backdrop">
      {children}
      <SiteFooter />
    </div>
  )
}
