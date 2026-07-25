'use server'

import { db } from '@/lib/db'
import { archivos, eventos, invitados } from '@album/database'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { deleteR2Object } from '@/lib/r2'
import { and, asc, eq, ilike, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function obtenerContadoresInvitado(
  invitadoId: string
): Promise<{ nombre: string; fotos_subidas: number; videos_subidos: number } | null> {
  const [row] = await db
    .select({
      nombre: invitados.nombre,
      fotos_subidas: invitados.fotos_subidas,
      videos_subidos: invitados.videos_subidos,
    })
    .from(invitados)
    .where(eq(invitados.id, invitadoId))
    .limit(1)
  return row ?? null
}

export interface InvitadoConConteos {
  id: string
  nombre: string
  apellido: string
  telefono: string | null
  fotos_subidas: number
  videos_subidos: number
  created_at: Date | null
}

/**
 * Verifica que el evento exista y pertenezca al organizador autenticado.
 * Lanza si no existe o si pertenece a otro organizador.
 *
 * Duplicado a propósito respecto de `assertEventoOwnership` en
 * `archivos.actions.ts` — mismo patrón de ownership check, no exportado
 * desde ahí, y este archivo verifica contra un dominio distinto
 * (invitados en vez de archivos). Convención tolerada por el proyecto
 * (ver revisión de Task 5.1).
 */
async function assertEventoOwnership(eventoId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('No autenticado')

  const [row] = await db
    .select({ id: eventos.id })
    .from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, user.id)))
    .limit(1)

  if (!row) throw new Error('Evento no encontrado')
}

export async function listarInvitados(
  eventoId: string,
  search?: string
): Promise<InvitadoConConteos[]> {
  await assertEventoOwnership(eventoId)

  const conditions = [eq(invitados.evento_id, eventoId)]
  if (search) {
    const term = `%${search}%`
    conditions.push(or(ilike(invitados.nombre, term), ilike(invitados.apellido, term))!)
  }

  const rows = await db
    .select({
      id: invitados.id,
      nombre: invitados.nombre,
      apellido: invitados.apellido,
      telefono: invitados.telefono,
      fotos_subidas: invitados.fotos_subidas,
      videos_subidos: invitados.videos_subidos,
      created_at: invitados.created_at,
    })
    .from(invitados)
    .where(and(...conditions))
    .orderBy(asc(invitados.created_at))

  return rows
}

export async function eliminarInvitado(
  invitadoId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const [invitado] = await db
      .select({ id: invitados.id, evento_id: invitados.evento_id })
      .from(invitados)
      .where(eq(invitados.id, invitadoId))
      .limit(1)

    if (!invitado) throw new Error('Invitado no encontrado')

    await assertEventoOwnership(invitado.evento_id)

    const archivosDelInvitado = await db
      .select({ r2_key: archivos.r2_key })
      .from(archivos)
      .where(eq(archivos.invitado_id, invitadoId))

    // Orden crítico: R2 primero para cada archivo. Si alguno falla, no se
    // toca la DB — mismo criterio que eliminarArchivo en archivos.actions.ts.
    for (const archivo of archivosDelInvitado) {
      await deleteR2Object(archivo.r2_key)
    }

    await db.delete(archivos).where(eq(archivos.invitado_id, invitadoId))
    await db.delete(invitados).where(eq(invitados.id, invitadoId))

    revalidatePath(`/eventos/${invitado.evento_id}/invitados`)
    revalidatePath(`/eventos/${invitado.evento_id}/galeria`)
    return { success: true }
  } catch (err) {
    console.error('[eliminarInvitado]', err)
    return { error: 'No se pudo eliminar el invitado' }
  }
}
