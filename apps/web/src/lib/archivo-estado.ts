/**
 * Mapeo de `archivos.estado` (`pendiente` / `aprobada` / `oculta`) a la
 * etiqueta y variante de Badge usadas tanto en la grilla de la galería
 * como en la pantalla de detalle.
 */
export function estadoInfo(estado: string): {
  label: string
  variant: 'default' | 'secondary' | 'destructive'
} {
  if (estado === 'aprobada') return { label: 'Aprobada', variant: 'default' }
  if (estado === 'oculta') return { label: 'Oculta', variant: 'destructive' }
  return { label: 'Pendiente', variant: 'secondary' }
}
