import { BookOpen } from 'lucide-react'

/**
 * Shared top app bar for the organizer-facing surfaces (login, registro,
 * eventos). Deliberately brand-only: the mockups' "Support"/"Terms" nav
 * links are omitted because those pages don't exist yet (see task-1.3R
 * brief — YAGNI, avoids dead links).
 */
export function OrganizadorTopbar() {
  return (
    <header className="flex h-20 w-full shrink-0 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm sm:px-12">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" />
        <span className="text-2xl font-bold tracking-tight text-primary">Album</span>
      </div>
    </header>
  )
}
