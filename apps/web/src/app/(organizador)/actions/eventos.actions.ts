'use server'

import { randomBytes } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { db } from '@/lib/db'
import { eventos, type NuevoEvento } from '@album/database'
import { eq } from 'drizzle-orm'

type CrearEventoInput = Pick<
  NuevoEvento,
  | 'nombre_evento'
  | 'fecha'
  | 'horario'
  | 'limite_invitados_login'
  | 'limite_fotos_por_invitado'
  | 'limite_videos_por_invitado'
>

type CrearEventoResult = { id: string } | { error: string }

export async function crearEvento(
  data: CrearEventoInput,
): Promise<CrearEventoResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  try {
    const [evento] = await db
      .insert(eventos)
      .values({
        ...data,
        organizador_id: user.id,
        slug: `borrador-${randomBytes(4).toString('hex')}`,
        estado: 'borrador',
      })
      .returning({ id: eventos.id })

    if (!evento) {
      return { error: 'No se pudo crear el evento' }
    }

    return { id: evento.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { error: message }
  }
}

export async function listarEventos() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return []
  }

  return db
    .select()
    .from(eventos)
    .where(eq(eventos.organizador_id, user.id))
    .orderBy(eventos.created_at)
}
