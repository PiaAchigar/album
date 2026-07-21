'use server'

import { db } from '@/lib/db'
import { invitados } from '@album/database'
import { eq } from 'drizzle-orm'

export async function obtenerContadoresInvitado(
  invitadoId: string
): Promise<{ fotos_subidas: number; videos_subidos: number } | null> {
  const [row] = await db
    .select({ fotos_subidas: invitados.fotos_subidas, videos_subidos: invitados.videos_subidos })
    .from(invitados)
    .where(eq(invitados.id, invitadoId))
    .limit(1)
  return row ?? null
}
