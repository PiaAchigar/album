import { describe, it, expect } from 'vitest'
import { normalizarTelefono } from './telefono.js'

describe('normalizarTelefono', () => {
  it('quita espacios', () => {
    expect(normalizarTelefono('099 123 456')).toBe('099123456')
  })

  it('quita guiones y paréntesis', () => {
    expect(normalizarTelefono('(099) 123-456')).toBe('099123456')
  })

  it('quita el signo +', () => {
    expect(normalizarTelefono('+598 99 123 456')).toBe('59899123456')
  })

  it('deja un string de solo dígitos sin cambios', () => {
    expect(normalizarTelefono('59899123456')).toBe('59899123456')
  })

  it('devuelve string vacío para un input sin dígitos', () => {
    expect(normalizarTelefono('---')).toBe('')
  })
})
