'use client'

import { useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

const MONTOS_SUGERIDOS = [25000, 50000, 100000]

interface Props {
  origen: 'landing' | 'registro_organizador'
  organizadorId?: string
}

export function SelectorDonacion({ origen, organizadorId }: Props) {
  const [montoSeleccionado, setMontoSeleccionado] = useState<number | null>(MONTOS_SUGERIDOS[0])
  const [montoCustom, setMontoCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoCustomNumero = montoCustom.trim() === '' ? null : Number(montoCustom)
  const usandoCustom = montoCustom.trim() !== ''
  const montoFinal = usandoCustom ? montoCustomNumero : montoSeleccionado
  const montoValido =
    montoFinal !== null && Number.isInteger(montoFinal) && montoFinal > 0

  function elegirPreset(monto: number) {
    setMontoSeleccionado(monto)
    setMontoCustom('')
    setError(null)
  }

  function cambiarCustom(valor: string) {
    setMontoCustom(valor)
    setMontoSeleccionado(null)
    setError(null)
  }

  async function donar() {
    if (!montoValido || montoFinal === null) return

    setLoading(true)
    setError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/donaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: montoFinal,
          origen,
          ...(organizadorId ? { organizador_id: organizadorId } : {}),
        }),
      })

      if (!res.ok) {
        setError('No pudimos iniciar el pago, probá de nuevo en unos segundos.')
        setLoading(false)
        return
      }

      const data = (await res.json()) as { init_point: string }
      window.location.href = data.init_point
    } catch {
      setError('No pudimos conectar con el servidor, probá de nuevo en unos segundos.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-3 gap-2">
          {MONTOS_SUGERIDOS.map((monto) => (
            <Button
              key={monto}
              type="button"
              variant={!usandoCustom && montoSeleccionado === monto ? 'default' : 'outline'}
              onClick={() => elegirPreset(monto)}
            >
              ${monto.toLocaleString('es-AR')}
            </Button>
          ))}
        </div>

        <div>
          <label htmlFor="monto-custom" className="text-sm text-muted-foreground">
            Otro monto (ARS)
          </label>
          <Input
            id="monto-custom"
            type="number"
            min={1}
            step={1}
            placeholder="Ingresá un monto"
            value={montoCustom}
            onChange={(e) => cambiarCustom(e.target.value)}
            className="mt-1"
          />
        </div>

        {usandoCustom && !montoValido && (
          <p className="text-sm text-destructive">Ingresá un monto mayor a $0.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          className="gap-2"
          disabled={!montoValido || loading}
          onClick={donar}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Heart className="h-4 w-4" aria-hidden="true" />
          )}
          {loading
            ? 'Redirigiendo a Mercado Pago…'
            : `Donar${montoValido ? ` $${montoFinal!.toLocaleString('es-AR')}` : ''}`}
        </Button>
      </CardContent>
    </Card>
  )
}