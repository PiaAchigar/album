import { describe, expect, it } from 'vitest'
import { esKeyDePortadaDelEvento } from './portada'

const EVENTO_ID = '346bae9f-8f8f-47e5-9e4d-a0769ecc36f0'

describe('esKeyDePortadaDelEvento', () => {
  it('acepta una key dentro de la carpeta de portadas del evento', () => {
    expect(esKeyDePortadaDelEvento(EVENTO_ID, `eventos/${EVENTO_ID}/portada/abc123.jpeg`)).toBe(true)
  })

  it('rechaza una key de la portada de otro evento', () => {
    expect(esKeyDePortadaDelEvento(EVENTO_ID, 'eventos/otro-evento/portada/abc123.jpeg')).toBe(false)
  })

  it('rechaza una key de un archivo subido por un invitado', () => {
    expect(esKeyDePortadaDelEvento(EVENTO_ID, `eventos/${EVENTO_ID}/invitado-1/abc123.jpeg`)).toBe(false)
  })

  it('rechaza keys que intentan salir de la carpeta con ..', () => {
    expect(esKeyDePortadaDelEvento(EVENTO_ID, `eventos/${EVENTO_ID}/portada/../invitado-1/x.jpeg`)).toBe(false)
  })

  it('rechaza una key que es solo la carpeta, sin archivo', () => {
    expect(esKeyDePortadaDelEvento(EVENTO_ID, `eventos/${EVENTO_ID}/portada/`)).toBe(false)
  })
})
