'use server'

import { organizadorApi, OrganizadorApiError } from '@/lib/organizador-api-client'

export async function guardarStorageConfig(data: {
  r2_account_id: string
  r2_access_key_id: string
  r2_secret_access_key: string
  r2_bucket_name: string
}): Promise<{ success: true } | { error: string }> {
  try {
    return await organizadorApi.guardarStorageConfig(data)
  } catch (err) {
    if (err instanceof OrganizadorApiError) return { error: err.message }
    console.error('[guardarStorageConfig]', err)
    return { error: 'No se pudo guardar la configuración' }
  }
}

export async function obtenerStorageConfigStatus(): Promise<
  { configurado: false } | { configurado: true; bucket: string; terminaEn: string }
> {
  try {
    return await organizadorApi.storageConfigStatus()
  } catch {
    return { configurado: false }
  }
}
