'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopiarBoton({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Clipboard can be blocked (e.g. non-HTTPS); the text stays selectable.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar} className="gap-2">
      {copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copiado ? 'Copiado' : 'Copiar'}
    </Button>
  )
}
