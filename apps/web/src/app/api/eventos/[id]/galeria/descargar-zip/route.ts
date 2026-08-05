import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import { archivos, eventos, invitados } from '@album/database'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { and, eq } from 'drizzle-orm'
import { getR2PublicUrl } from '@/lib/r2'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventoId } = await params

    // Verify organizer
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Check evento ownership
    const [evento] = await db
      .select({ id: eventos.id, nombre_evento: eventos.nombre_evento })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, user.id)))
      .limit(1)

    if (!evento) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    // Get all approved files
    const rows = await db
      .select({
        r2_key: archivos.r2_key,
        tipo: archivos.tipo,
        created_at: archivos.created_at,
        invitado_nombre: invitados.nombre,
        invitado_apellido: invitados.apellido,
      })
      .from(archivos)
      .innerJoin(invitados, eq(archivos.invitado_id, invitados.id))
      .where(and(eq(archivos.evento_id, eventoId), eq(archivos.estado, 'aprobada')))
      .orderBy(archivos.created_at)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No hay archivos aprobados para descargar' },
        { status: 400 },
      )
    }

    const zip = new JSZip()

    // Download each file and add to ZIP
    for (const row of rows) {
      try {
        const url = await getR2PublicUrl(row.r2_key)
        const response = await fetch(url)

        if (!response.ok) {
          console.warn(`Failed to download ${row.r2_key}: ${response.statusText}`)
          continue
        }

        const buffer = await response.arrayBuffer()

        // Create folder structure: "Nombre Apellido/filename"
        const folder = `${row.invitado_nombre}_${row.invitado_apellido}`
        const filename = row.r2_key.split('/').pop() || 'archivo'
        const filepath = `${folder}/${filename}`

        zip.file(filepath, buffer)
      } catch (err) {
        console.error(`Error downloading ${row.r2_key}:`, err)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

    const sanitizedName = evento.nombre_evento
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedName}.zip"`,
      },
    })
  } catch (err) {
    console.error('[descargar-zip]', err)
    return NextResponse.json({ error: 'Error al generar ZIP' }, { status: 500 })
  }
}
