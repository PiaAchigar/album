export const PAISES = [
  { value: 'UY', label: 'Uruguay', placeholder: '+598 99 123 456' },
  { value: 'AR', label: 'Argentina', placeholder: '+54 9 11 1234 5678' },
  { value: 'PY', label: 'Paraguay', placeholder: '+595 981 123 456' },
] as const

export type PaisCodigo = (typeof PAISES)[number]['value']
