import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'

interface Props {
  /** Optional element on the right edge (e.g. a "Ingresar" link on public pages). */
  action?: ReactNode
}

/**
 * Shared top app bar for the organizer-facing surfaces (landing, login,
 * registro, eventos). The right slot is opt-in so
 * auth screens don't show a link to themselves.
 */
export function OrganizadorTopbar({ action }: Props) {
  return (
    <header className="flex h-20 w-full shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm sm:px-12">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" />
        <span className="text-2xl font-bold tracking-tight text-primary">Album</span>
      </div>
      {action}
    </header>
  )
}
