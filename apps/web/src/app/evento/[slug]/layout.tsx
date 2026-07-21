import { Playfair_Display } from 'next/font/google'
import type { ReactNode } from 'react'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export default function EventoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ctx-invitado ${playfair.variable} min-h-screen`}>
      {children}
    </div>
  )
}
