'use server'

import { db } from '@/lib/db'
import { archivos, eventos, invitados } from '@album/database'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateSlug } from '@/lib/slug'
import { esKeyDePortadaDelEvento } from '@/lib/portada'
import { organizadorApi } from '@/lib/organizador-api-client'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type EventoRow = typeof eventos.$inferSelect

async function getOrganizadorId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('No autenticado')
  return user.id
}

export async function crearEvento(data: {
  nombre_evento: string
  fecha: string
  horario: string
}): Promise<{ id: string } | { error: string }> {
  try {
    const organizadorId = await getOrganizadorId()

    const placeholderSlug = generateSlug(data.nombre_evento)

    const [evento] = await db
      .insert(eventos)
      .values({
        organizador_id: organizadorId,
        slug: placeholderSlug,
        nombre_evento: data.nombre_evento,
        fecha: data.fecha,
        horario: data.horario,
        estado: 'borrador',
        limite_invitados_login: 0,
        limite_fotos_por_invitado: 0,
        limite_videos_por_invitado: 0,
      })
      .returning({ id: eventos.id })

    return { id: evento.id }
  } catch (err) {
    console.error('[crearEvento]', err)
    return { error: 'No se pudo crear el evento' }
  }
}

export async function actualizarPortada(
  eventoId: string,
  r2Key: string,
): Promise<void> {
  const organizadorId = await getOrganizadorId()

  if (!esKeyDePortadaDelEvento(eventoId, r2Key)) {
    throw new Error('Key de portada inválida')
  }

  // `db` es una conexión directa a Postgres que no pasa por RLS, así que el
  // filtro por organizador_id es el que impide tocar eventos ajenos.
  const actualizados = await db
    .update(eventos)
    .set({ foto_portada_url: r2Key })
    .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))
    .returning({ slug: eventos.slug })

  const [evento] = actualizados
  if (!evento) throw new Error('Evento no encontrado')

  revalidatePath(`/eventos/${eventoId}/portada`)
  revalidatePath(`/e/${evento.slug}`)
}

export async function actualizarLimites(
  eventoId: string,
  data: {
    cantidad_invitados_totales: number
    limite_invitados_login: number
    limite_fotos_por_invitado: number
    limite_videos_por_invitado: number
  },
): Promise<void> {
  await getOrganizadorId()

  await db
    .update(eventos)
    .set({
      cantidad_invitados_totales: data.cantidad_invitados_totales,
      limite_invitados_login: data.limite_invitados_login,
      limite_fotos_por_invitado: data.limite_fotos_por_invitado,
      limite_videos_por_invitado: data.limite_videos_por_invitado,
    })
    .where(eq(eventos.id, eventoId))
}

export async function activarEvento(
  eventoId: string,
): Promise<{ slug: string } | { error: string }> {
  try {
    const organizadorId = await getOrganizadorId()

    const [existing] = await db
      .select({ nombre_evento: eventos.nombre_evento })
      .from(eventos)
      .where(eq(eventos.id, eventoId))

    if (!existing) return { error: 'Evento no encontrado' }

    const slug = generateSlug(existing.nombre_evento)

    await db
      .update(eventos)
      .set({ estado: 'activo', slug })
      .where(eq(eventos.id, eventoId))

    void organizadorId
    revalidatePath('/eventos', 'page')
    return { slug }
  } catch (err) {
    console.error('[activarEvento]', err)
    return { error: 'No se pudo activar el evento' }
  }
}

export async function listarEventos(): Promise<EventoRow[]> {
  const organizadorId = await getOrganizadorId()

  return db
    .select()
    .from(eventos)
    .where(eq(eventos.organizador_id, organizadorId))
    .orderBy(eventos.created_at)
}

export async function obtenerEvento(id: string): Promise<EventoRow | null> {
  await getOrganizadorId()

  const [evento] = await db
    .select()
    .from(eventos)
    .where(eq(eventos.id, id))

  return evento ?? null
}

export async function cambiarEstadoEvento(
  eventoId: string,
  nuevoEstado: 'activo' | 'cerrado',
): Promise<{ success: true } | { error: string }> {
  try {
    const organizadorId = await getOrganizadorId()

    const [existing] = await db
      .select({ estado: eventos.estado })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))

    if (!existing) return { error: 'Evento no encontrado' }
    if (existing.estado !== 'activo' && existing.estado !== 'cerrado') {
      return { error: 'Solo se puede cerrar o reactivar un evento activo' }
    }

    await db.update(eventos).set({ estado: nuevoEstado }).where(eq(eventos.id, eventoId))

    revalidatePath('/eventos', 'page')
    return { success: true }
  } catch (err) {
    console.error('[cambiarEstadoEvento]', err)
    return { error: 'No se pudo actualizar el estado del evento' }
  }
}

export async function eliminarEvento(
  eventoId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const organizadorId = await getOrganizadorId()

    const [evento] = await db
      .select({ id: eventos.id })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))

    if (!evento) return { error: 'Evento no encontrado' }

    // Orden crítico: R2 primero. Si falla, no se toca la DB.
    await organizadorApi.eliminarEventoArchivosR2(eventoId)

    // Orden por FKs: archivos -> invitados -> eventos.
    await db.delete(archivos).where(eq(archivos.evento_id, eventoId))
    await db.delete(invitados).where(eq(invitados.evento_id, eventoId))
    await db.delete(eventos).where(eq(eventos.id, eventoId))

    revalidatePath('/eventos', 'page')
    return { success: true }
  } catch (err) {
    console.error('[eliminarEvento]', err)
    return { error: 'No se pudo eliminar el evento' }
  }
}
