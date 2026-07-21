'use client'

import { useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  qrDataUrl: string
  eventUrl: string
  nombreEvento: string
}

export function QRActions({ qrDataUrl, eventUrl, nombreEvento }: Props) {
  const [copied, setCopied] = useState(false)

  function downloadQR() {
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-${nombreEvento.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button onClick={downloadQR} className="h-12 gap-2 text-sm font-semibold uppercase tracking-widest sm:w-48">
        <Download className="h-4 w-4" aria-hidden="true" />
        Descargar QR
      </Button>
      <Button
        variant="outline"
        onClick={copyLink}
        className="h-12 gap-2 text-sm font-semibold uppercase tracking-widest sm:w-48"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            ¡Copiado!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copiar link
          </>
        )}
      </Button>
    </div>
  )
}
