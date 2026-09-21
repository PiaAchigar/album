import { createSupabaseServerClient } from '@/lib/supabase-server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class OrganizadorApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'OrganizadorApiError'
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) throw new OrganizadorApiError(401, 'No autenticado')

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>
  let message = `HTTP ${res.status}`
  try {
    const body = await res.json()
    if (body?.error) message = body.error
  } catch {
    /* ignore */
  }
  throw new OrganizadorApiError(res.status, message)
}

export const organizadorApi = {
  async guardarStorageConfig(data: {
    r2_account_id: string
    r2_access_key_id: string
    r2_secret_access_key: string
    r2_bucket_name: string
  }): Promise<{ success: true }> {
    const res = await fetch(`${API_URL}/organizador/storage-config`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  async storageConfigStatus(): Promise<
    { configurado: false } | { configurado: true; bucket: string; terminaEn: string }
  > {
    const res = await fetch(`${API_URL}/organizador/storage-config/status`, {
      headers: await authHeaders(),
    })
    return handleResponse(res)
  },

  async solicitarPresignedPortada(
    eventoId: string,
    extension: string,
  ): Promise<{ uploadUrl: string; r2Key: string }> {
    const res = await fetch(
      `${API_URL}/organizador/eventos/${eventoId}/portada/solicitar-subida`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ extension }),
      },
    )
    return handleResponse(res)
  },

  async urlsLectura(archivoIds: string[]): Promise<{ urls: Record<string, string> }> {
    if (archivoIds.length === 0) return { urls: {} }
    const res = await fetch(`${API_URL}/organizador/archivos/urls-lectura`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ archivo_ids: archivoIds }),
    })
    return handleResponse(res)
  },

  async eliminarArchivosR2(archivoIds: string[]): Promise<{ success: true }> {
    if (archivoIds.length === 0) return { success: true }
    const res = await fetch(`${API_URL}/organizador/archivos`, {
      method: 'DELETE',
      headers: await authHeaders(),
      body: JSON.stringify({ archivo_ids: archivoIds }),
    })
    return handleResponse(res)
  },

  async eliminarEventoArchivosR2(eventoId: string): Promise<{ success: true }> {
    const res = await fetch(`${API_URL}/organizador/eventos/${eventoId}/archivos-r2`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    return handleResponse(res)
  },
}
