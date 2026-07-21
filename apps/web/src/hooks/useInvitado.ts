'use client'

import { useEffect, useState } from 'react'

interface InvitadoState {
  token: string | null
  invitadoId: string | null
  isLoaded: boolean
}

export function useInvitado(slug: string): InvitadoState {
  const [state, setState] = useState<InvitadoState>({
    token: null,
    invitadoId: null,
    isLoaded: false,
  })

  useEffect(() => {
    const token = localStorage.getItem(`album_token_${slug}`)
    const invitadoId = localStorage.getItem(`album_invitado_${slug}`)
    setState({ token, invitadoId, isLoaded: true })
  }, [slug])

  return state
}
