import { nanoid } from 'nanoid'

export function generateSlug(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent diacritics
    .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
    .trim()
    .replace(/[\s]+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')              // collapse multiple hyphens
    .slice(0, 40)                     // max 40 chars before suffix

  return `${base}-${nanoid(6)}`
}
