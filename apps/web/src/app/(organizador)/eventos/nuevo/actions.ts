'use server'

import { organizadorApi } from '@/lib/organizador-api-client'

export async function solicitarPresignedPortada(
  eventoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  return organizadorApi.solicitarPresignedPortada(eventoId, extension)
}
