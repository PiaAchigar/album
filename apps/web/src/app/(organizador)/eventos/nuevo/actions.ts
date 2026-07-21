'use server'

import { getOrganizadorPresignedUpload } from '@/lib/r2'

export async function solicitarPresignedPortada(
  eventoId: string,
  extension: string,
): Promise<{ uploadUrl: string; r2Key: string }> {
  return getOrganizadorPresignedUpload(eventoId, extension)
}
