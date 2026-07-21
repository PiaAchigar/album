'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartBar, Images, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  eventoId: string
}

/**
 * Shared nav for the event panel (Resumen / Galería / Invitados). Renders
 * both the desktop side rail and the mobile bottom tab bar since they share
 * the same links + active-state logic — split only by responsive classes.
 */
export function PanelNav({ eventoId }: Props) {
  const pathname = usePathname()

  const resumenHref = `/eventos/${eventoId}`
  const items = [
    { href: resumenHref, label: 'Resumen', icon: ChartBar },
    { href: `${resumenHref}/galeria`, label: 'Galería', icon: Images },
    { href: `${resumenHref}/invitados`, label: 'Invitados', icon: Users },
  ]

  const isActive = (href: string) =>
    href === resumenHref ? pathname === href : pathname.startsWith(href)

  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <nav className="sticky top-16 flex flex-col gap-1 p-4">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/95 py-2 backdrop-blur-sm md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md px-4 py-1 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
