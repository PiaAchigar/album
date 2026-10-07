import type { LucideIcon } from 'lucide-react'
import { Camera, Heart, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Brand palette shared by the landing and the Open Graph image
 * (app/opengraph-image.tsx): gold and pink come from the guest theme.
 */
export const BRAND_COLORS = {
  gold: '#D4AF37',
  pink: '#FBCFE8',
  slate: '#94A3B8',
} as const

function Polaroid({
  color,
  icon: Icon,
  className,
}: {
  color: string
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'absolute flex w-[44%] flex-col rounded-lg bg-white p-[4%] pb-[13%] shadow-2xl',
        className,
      )}
    >
      <div
        className="flex aspect-square items-center justify-center rounded-sm"
        style={{ background: color }}
      >
        <Icon className="h-1/3 w-1/3 text-white/70" strokeWidth={1.5} aria-hidden="true" />
      </div>
    </div>
  )
}

/** The three tilted "photos" from the share image, as a decorative illustration. */
export function PolaroidStack({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-[1.3/1] w-full', className)} aria-hidden="true">
      <Polaroid color={BRAND_COLORS.pink} icon={Heart} className="right-[6%] top-0 rotate-[10deg]" />
      <Polaroid color={BRAND_COLORS.gold} icon={PartyPopper} className="left-[2%] top-[18%] -rotate-[8deg]" />
      <Polaroid color={BRAND_COLORS.slate} icon={Camera} className="bottom-0 right-[2%] -rotate-[3deg]" />
    </div>
  )
}
