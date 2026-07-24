export function normalizarTelefono(telefono: string): string {
  return telefono.replace(/\D/g, '')
}
