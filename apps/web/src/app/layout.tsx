import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const DESCRIPTION =
  'Todas las fotos de tu fiesta, en un solo álbum. Tus invitados escanean un QR y suben lo que vivieron.'

export const metadata: Metadata = {
  // Absolute base so shared-link previews (opengraph-image) resolve to the
  // public domain instead of localhost.
  metadataBase: new URL(process.env.PUBLIC_APP_URL ?? 'https://www.album.com.ar'),
  title: 'Album',
  description: DESCRIPTION,
  openGraph: {
    title: 'Album',
    description: DESCRIPTION,
    siteName: 'Album',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Album',
    description: DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
