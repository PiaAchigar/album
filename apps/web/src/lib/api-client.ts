const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json()
    if (body?.error) message = body.error
  } catch { /* ignore */ }
  throw new ApiError(res.status, message)
}

export function apiClient(slug: string) {
  function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem(`album_token_${slug}`)
      : null
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  return {
    async solicitarSubida(
      tipo: 'foto' | 'video',
      extension: string
    ): Promise<{ upload_url: string; r2_key: string }> {
      const res = await fetch(`${API_URL}/eventos/${slug}/archivos/solicitar-subida`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tipo, extension }),
      })
      return handleResponse<{ upload_url: string; r2_key: string }>(res)
    },

    async confirmarSubida(
      r2Key: string,
      tipo: 'foto' | 'video',
      extension: string
    ): Promise<{ archivo_id: string }> {
      const res = await fetch(`${API_URL}/eventos/${slug}/archivos/confirmar`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ r2_key: r2Key, tipo, extension }),
      })
      return handleResponse<{ archivo_id: string }>(res)
    },
  }
}
