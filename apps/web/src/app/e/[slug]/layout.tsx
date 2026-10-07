import { Playfair_Display } from 'next/font/google'
import type { ReactNode } from 'react'
import { InvitadoFooter } from '@/components/site-footer'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export default function EventoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ctx-invitado ${playfair.variable} flex min-h-screen flex-col bg-backdrop`}>
      {children}
      <InvitadoFooter />
    </div>
  )
}
