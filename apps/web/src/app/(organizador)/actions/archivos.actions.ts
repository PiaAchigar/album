'use server'

import { db } from '@/lib/db'
import { archivos, eventos, invitados } from '@album/database'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { deleteR2Object } from '@/lib/r2'
import { and, count, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type ArchivoRow = typeof archivos.$inferSelect

export interface ArchivoConInvitado {
  id: string
  tipo: string
  r2_key: string
  thumbnail_key: string | null
  estado: string
  created_at: Date | null
  invitado_id: string
  invitado_nombre: string
  invitado_apellido: string
}

async function getOrganizadorId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('No autenticado')
  return user.id
}

/**
 * Verifica que el archivo exista y pertenezca a un evento del organizador
 * autenticado. Lanza si no existe o si pertenece a otro organizador.
 */
async function assertArchivoOwnership(archivoId: string): Promise<ArchivoRow> {
  const organizadorId = await getOrganizadorId()

  const [row] = await db
    .select({ archivo: archivos })
    .from(archivos)
    .innerJoin(eventos, eq(archivos.evento_id, eventos.id))
    .where(and(eq(archivos.id, archivoId), eq(eventos.organizador_id, organizadorId)))
    .limit(1)

  if (!row) throw new Error('Archivo no encontrado')

  return row.archivo
}

/**
 * Verifica que el evento exista y pertenezca al organizador autenticado.
 * Lanza si no existe o si pertenece a otro organizador.
 */
async function assertEventoOwnership(eventoId: string): Promise<void> {
  const organizadorId = await getOrganizadorId()

  const [row] = await db
    .select({ id: eventos.id })
    .from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))
    .limit(1)

  if (!row) throw new Error('Evento no encontrado')
}

export async function obtenerEstadisticasEvento(eventoId: string): Promise<{
  totalInvitados: number
  totalFotos: number
  totalVideos: number
  pendientes: number
}> {
  await assertEventoOwnership(eventoId)

  const [[invitadosRow], [fotosRow], [videosRow], [pendientesRow]] = await Promise.all([
    db.select({ total: count() }).from(invitados).where(eq(invitados.evento_id, eventoId)),
    db
      .select({ total: count() })
      .from(archivos)
      .where(and(eq(archivos.evento_id, eventoId), eq(archivos.tipo, 'foto'))),
    db
      .select({ total: count() })
      .from(archivos)
      .where(and(eq(archivos.evento_id, eventoId), eq(archivos.tipo, 'video'))),
    db
      .select({ total: count() })
      .from(archivos)
      .where(and(eq(archivos.evento_id, eventoId), eq(archivos.estado, 'pendiente'))),
  ])

  return {
    totalInvitados: invitadosRow.total,
    totalFotos: fotosRow.total,
    totalVideos: videosRow.total,
    pendientes: pendientesRow.total,
  }
}

export async function aprobarArchivo(
  archivoId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const archivo = await assertArchivoOwnership(archivoId)

    await db.update(archivos).set({ estado: 'aprobada' }).where(eq(archivos.id, archivoId))

    revalidatePath(`/eventos/${archivo.evento_id}/galeria`)
    return { success: true }
  } catch (err) {
    console.error('[aprobarArchivo]', err)
    return { error: 'No se pudo aprobar el archivo' }
  }
}

export async function ocultarArchivo(
  archivoId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const archivo = await assertArchivoOwnership(archivoId)

    await db.update(archivos).set({ estado: 'oculta' }).where(eq(archivos.id, archivoId))

    revalidatePath(`/eventos/${archivo.evento_id}/galeria`)
    return { success: true }
  } catch (err) {
    console.error('[ocultarArchivo]', err)
    return { error: 'No se pudo ocultar el archivo' }
  }
}

export async function eliminarArchivo(
  archivoId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const archivo = await assertArchivoOwnership(archivoId)

    // Orden crítico: R2 primero. Si falla, no se toca la DB ni el contador.
    await deleteR2Object(archivo.r2_key)

    await db.delete(archivos).where(eq(archivos.id, archivoId))

    if (archivo.tipo === 'foto') {
      await db
        .update(invitados)
        .set({ fotos_subidas: sql`GREATEST(${invitados.fotos_subidas} - 1, 0)` })
        .where(eq(invitados.id, archivo.invitado_id))
    } else {
      await db
        .update(invitados)
        .set({ videos_subidos: sql`GREATEST(${invitados.videos_subidos} - 1, 0)` })
        .where(eq(invitados.id, archivo.invitado_id))
    }

    revalidatePath(`/eventos/${archivo.evento_id}/galeria`)
    revalidatePath(`/eventos/${archivo.evento_id}/invitados`)
    return { success: true }
  } catch (err) {
    console.error('[eliminarArchivo]', err)
    return { error: 'No se pudo eliminar el archivo' }
  }
}

/**
 * Trae un archivo (con datos del invitado) para la pantalla de detalle,
 * junto con los IDs de archivo anterior/siguiente del mismo evento
 * (ordenados por `created_at asc`) para la navegación Prev/Next.
 * Devuelve `null` si el archivo no existe o no pertenece al organizador
 * autenticado.
 */
export async function obtenerArchivoDetalle(archivoId: string): Promise<{
  archivo: ArchivoConInvitado
  prevId: string | null
  nextId: string | null
} | null> {
  try {
    const archivoBase = await assertArchivoOwnership(archivoId)

    const [row] = await db
      .select({
        id: archivos.id,
        tipo: archivos.tipo,
        r2_key: archivos.r2_key,
        thumbnail_key: archivos.thumbnail_key,
        estado: archivos.estado,
        created_at: archivos.created_at,
        invitado_id: invitados.id,
        invitado_nombre: invitados.nombre,
        invitado_apellido: invitados.apellido,
      })
      .from(archivos)
      .innerJoin(invitados, eq(archivos.invitado_id, invitados.id))
      .where(eq(archivos.id, archivoId))
      .limit(1)

    if (!row) return null

    const siblings = await db
      .select({ id: archivos.id })
      .from(archivos)
      .where(eq(archivos.evento_id, archivoBase.evento_id))
      .orderBy(archivos.created_at)

    const index = siblings.findIndex((s) => s.id === archivoId)

    return {
      archivo: row,
      prevId: index > 0 ? siblings[index - 1].id : null,
      nextId: index !== -1 && index < siblings.length - 1 ? siblings[index + 1].id : null,
    }
  } catch (err) {
    console.error('[obtenerArchivoDetalle]', err)
    return null
  }
}

export async function listarArchivos(
  eventoId: string,
  filters?: { invitadoId?: string; tipo?: string; estado?: string },
): Promise<ArchivoConInvitado[]> {
  await assertEventoOwnership(eventoId)

  const conditions = [eq(archivos.evento_id, eventoId)]
  if (filters?.invitadoId) conditions.push(eq(archivos.invitado_id, filters.invitadoId))
  if (filters?.tipo) conditions.push(eq(archivos.tipo, filters.tipo))
  if (filters?.estado) conditions.push(eq(archivos.estado, filters.estado))

  const rows = await db
    .select({
      id: archivos.id,
      tipo: archivos.tipo,
      r2_key: archivos.r2_key,
      thumbnail_key: archivos.thumbnail_key,
      estado: archivos.estado,
      created_at: archivos.created_at,
      invitado_id: invitados.id,
      invitado_nombre: invitados.nombre,
      invitado_apellido: invitados.apellido,
    })
    .from(archivos)
    .innerJoin(invitados, eq(archivos.invitado_id, invitados.id))
    .where(and(...conditions))
    .orderBy(archivos.created_at)

  return rows
}

export async function descargarZipAprobados(eventoId: string): Promise<{ keys: string[] }> {
  await assertEventoOwnership(eventoId)

  const rows = await db
    .select({ r2_key: archivos.r2_key })
    .from(archivos)
    .where(and(eq(archivos.evento_id, eventoId), eq(archivos.estado, 'aprobada')))

  return { keys: rows.map((r) => r.r2_key) }
}

