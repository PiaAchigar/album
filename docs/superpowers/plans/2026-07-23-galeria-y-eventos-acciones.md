# Eliminar/Inactivar Evento, Reproducción Automática y Borrado Rápido en Galería — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al panel del organizador (`apps/web`) la posibilidad de cerrar/reactivar y eliminar un evento desde "Mis eventos", reproducir automáticamente en un carrusel las fotos/videos aprobados de la Galería, y borrar un archivo directamente desde su miniatura.

**Architecture:** Todo el trabajo es sobre el monorepo existente (`apps/api` Hono + `apps/web` Next.js App Router + Drizzle/Postgres + R2), sin tablas ni endpoints HTTP nuevos salvo un cambio de un literal en un endpoint ya existente. Las tres features nuevas de UI se implementan como Server Actions (`'use server'`) + componentes cliente, siguiendo exactamente los patrones ya establecidos en `eventos.actions.ts` / `archivos.actions.ts` / `DetalleClient.tsx`.

**Tech Stack:** Next.js App Router, React Server Components + Client Components, Drizzle ORM, shadcn/ui (Radix), lucide-react, sonner (toasts), Vitest (solo `apps/api`).

**Spec:** `docs/superpowers/specs/2026-07-23-galeria-y-eventos-acciones-design.md`

## Global Constraints

- No se agrega ningún estado nuevo a `eventos.estado` — "inactivar" reutiliza el valor `cerrado` que ya existe en el schema y ya bloquea landing/registro/subida.
- No se renombra la acción "Ocultar" existente en `DetalleClient.tsx` — sigue llamándose "Ocultar" y ahora también excluye del carrusel automático (viene gratis: el carrusel solo lee `estado === 'aprobada'`).
- `apps/web` no tiene suite de tests de componentes (confirmado: no hay `apps/web/**/*.test.ts(x)` ni script `test` en `apps/web/package.json`). Es el patrón ya usado en las Fases 4–5 de este proyecto: las tareas de `apps/web` se verifican con `npx turbo run typecheck` + `pnpm --filter web build` + verificación manual, no con tests automatizados nuevos. Solo `apps/api` (Task 1) usa TDD con Vitest.
- Todos los borrados son permanentes — no hay papelera ni deshacer. El `AlertDialog` estándar del proyecto (mismo patrón que ya usa `DetalleClient.tsx`) es la única confirmación requerida; no hay "escribí el nombre del evento".
- Orden crítico en cualquier borrado que toque R2: **storage primero, DB después**. Si el borrado en R2 falla, no se tocan las filas de la DB.
- Carrusel: 5000ms de avance automático por foto; los videos avanzan por su propio evento `ended` (o un timeout de seguridad de 15s si `ended` nunca dispara). Nunca se muestra el badge/label de `estado` dentro del carrusel.

---

### Task 1: API — los archivos confirmados entran directo como `'aprobada'`

**Files:**
- Modify: `apps/api/src/routes/archivos.routes.ts:141-150`
- Test: `apps/api/src/routes/archivos.routes.test.ts`

**Interfaces:**
- Consumes: nada nuevo — modifica el handler `POST /eventos/:slug/archivos/confirmar` ya existente.
- Produces: de ahora en más, cada fila de `archivos` insertada por este endpoint tiene `estado = 'aprobada'` en vez de `'pendiente'`. Task 5 (carrusel) depende de este comportamiento — filtra por `estado === 'aprobada'`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/api/src/routes/archivos.routes.test.ts`, reemplazar la función helper `mockInsertReturning` (ubicada justo antes de `mockUpdateOk`) para que exponga un spy sobre `.values(...)`:

```ts
function mockInsertReturning(id: string) {
  const valuesMock = vi.fn(() => ({
    returning: async () => [{ id }],
  }))
  insertMock.mockImplementation(() => ({ values: valuesMock }))
  return valuesMock
}
```

(El `beforeEach` ya existente que llama `mockInsertReturning('arch-1')` sin capturar el valor de retorno no necesita cambios — sigue funcionando igual.)

Agregar un nuevo test dentro de `describe('POST /eventos/:slug/archivos/confirmar', ...)`, inmediatamente después del primer `it(...)` de ese bloque:

```ts
  it('inserts the archivo with estado "aprobada" (uploads no longer require pre-moderation)', async () => {
    queueSelects([mockEvento])
    const valuesMock = mockInsertReturning('arch-1')

    await confirmar(
      'boda-test-abc123',
      {
        r2_key: 'eventos/evt-1/inv-1/generated-name.jpg',
        tipo: 'foto',
        extension: 'jpg',
      },
      await authHeader(),
    )

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'aprobada' }),
    )
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter api test -- archivos.routes.test.ts`
Expected: FAIL en el test nuevo — `valuesMock` fue llamado con `estado: 'pendiente'`, no `'aprobada'`.

- [ ] **Step 3: Implementación mínima**

En `apps/api/src/routes/archivos.routes.ts`, dentro del handler de `/eventos/:slug/archivos/confirmar` (línea 148), cambiar:

```ts
      const [inserted] = await db
        .insert(archivos)
        .values({
          evento_id: evento.id,
          invitado_id,
          tipo,
          r2_key,
          estado: 'pendiente',
        })
        .returning({ id: archivos.id })
```

por:

```ts
      const [inserted] = await db
        .insert(archivos)
        .values({
          evento_id: evento.id,
          invitado_id,
          tipo,
          r2_key,
          estado: 'aprobada',
        })
        .returning({ id: archivos.id })
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm --filter api test`
Expected: PASS — todos los tests de `apps/api` (los 46+ preexistentes más el nuevo).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/archivos.routes.ts apps/api/src/routes/archivos.routes.test.ts
git commit -m "feat(api): los archivos confirmados entran directo como 'aprobada'"
```

---

### Task 2: Server Actions — `cambiarEstadoEvento` y `eliminarEvento`

**Files:**
- Modify: `apps/web/src/app/(organizador)/actions/eventos.actions.ts`

**Interfaces:**
- Consumes: `db` (`@/lib/db`), `eventos`/`archivos`/`invitados` (`@album/database`), `deleteR2Object` (`@/lib/r2`), `getOrganizadorId()` (ya definida en este archivo).
- Produces:
  - `cambiarEstadoEvento(eventoId: string, nuevoEstado: 'activo' | 'cerrado'): Promise<{ success: true } | { error: string }>`
  - `eliminarEvento(eventoId: string): Promise<{ success: true } | { error: string }>`
  - Ambas consumidas por `EventoActionsMenu` en Task 3.

- [ ] **Step 1: Actualizar imports**

En `apps/web/src/app/(organizador)/actions/eventos.actions.ts`, reemplazar las líneas 1-8:

```ts
'use server'

import { db } from '@/lib/db'
import { eventos } from '@album/database'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateSlug } from '@/lib/slug'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
```

por:

```ts
'use server'

import { db } from '@/lib/db'
import { archivos, eventos, invitados } from '@album/database'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateSlug } from '@/lib/slug'
import { deleteR2Object } from '@/lib/r2'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
```

- [ ] **Step 2: Agregar `cambiarEstadoEvento` y `eliminarEvento`**

Al final de `apps/web/src/app/(organizador)/actions/eventos.actions.ts` (después de la función `obtenerEvento`), agregar:

```ts
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
      .select({ foto_portada_url: eventos.foto_portada_url })
      .from(eventos)
      .where(and(eq(eventos.id, eventoId), eq(eventos.organizador_id, organizadorId)))

    if (!evento) return { error: 'Evento no encontrado' }

    const archivosDelEvento = await db
      .select({ r2_key: archivos.r2_key })
      .from(archivos)
      .where(eq(archivos.evento_id, eventoId))

    const keysABorrar = archivosDelEvento.map((a) => a.r2_key)
    if (evento.foto_portada_url) keysABorrar.push(evento.foto_portada_url)

    // Orden crítico: R2 primero. Si falla algún borrado, no se toca la DB.
    await Promise.all(keysABorrar.map((key) => deleteR2Object(key)))

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
```

- [ ] **Step 3: Verificar tipos**

Run: `npx turbo run typecheck --filter=@album/web`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(organizador\)/actions/eventos.actions.ts
git commit -m "feat(web): agrega cambiarEstadoEvento y eliminarEvento (borrado en cascada R2+DB)"
```

---

### Task 3: UI — Cerrar/Reactivar y Eliminar evento desde "Mis eventos"

**Files:**
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/app/(organizador)/eventos/_components/EventoActionsMenu.tsx`
- Modify: `apps/web/src/app/(organizador)/eventos/page.tsx`

**Interfaces:**
- Consumes: `cambiarEstadoEvento`, `eliminarEvento` (Task 2); `Button` (`@/components/ui/button`); `AlertDialog*` (`@/components/ui/alert-dialog`, ya existe).
- Produces: `EventoActionsMenu({ eventoId, estado }: { eventoId: string; estado: string })`, montado en cada card de `eventos/page.tsx`.

- [ ] **Step 1: Crear el componente shadcn `dropdown-menu`**

`@radix-ui/react-dropdown-menu` ya es una dependencia de `apps/web` (`package.json`), pero el componente shadcn todavía no está generado. Crear `apps/web/src/components/ui/dropdown-menu.tsx`:

```tsx
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuPortal,
}
```

- [ ] **Step 2: Crear `EventoActionsMenu.tsx`**

Crear `apps/web/src/app/(organizador)/eventos/_components/EventoActionsMenu.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, MoreVertical, Trash2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  cambiarEstadoEvento,
  eliminarEvento,
} from '@/app/(organizador)/actions/eventos.actions'

interface Props {
  eventoId: string
  estado: string
}

export function EventoActionsMenu({ eventoId, estado }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleCambiarEstado(nuevoEstado: 'activo' | 'cerrado') {
    startTransition(async () => {
      const result = await cambiarEstadoEvento(eventoId, nuevoEstado)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleEliminar() {
    startTransition(async () => {
      const result = await eliminarEvento(eventoId)
      setDeleteOpen(false)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Acciones del evento"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          {estado === 'activo' && (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => handleCambiarEstado('cerrado')}
            >
              <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
              Cerrar evento
            </DropdownMenuItem>
          )}
          {estado === 'cerrado' && (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => handleCambiarEstado('activo')}
            >
              <Unlock className="mr-2 h-4 w-4" aria-hidden="true" />
              Reactivar evento
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isPending}
            onSelect={(e) => {
              e.preventDefault()
              setDeleteOpen(true)
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Eliminar evento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borra el evento, todos sus invitados y todos sus archivos (fotos y
              videos, tanto de la base de datos como del almacenamiento). No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault()
                handleEliminar()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 3: Montar el menú en `eventos/page.tsx`**

Reemplazar el contenido completo de `apps/web/src/app/(organizador)/eventos/page.tsx` por:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarEventos } from '@/app/(organizador)/actions/eventos.actions'
import { logoutOrganizador } from '@/app/(organizador)/actions/auth.actions'
import { OrganizadorTopbar } from '@/components/organizador-topbar'
import { EventoActionsMenu } from './_components/EventoActionsMenu'
import { CalendarIcon, PlusIcon } from 'lucide-react'

function estadoInfo(estado: string) {
  if (estado === 'activo') return { label: 'Activo', variant: 'default' as const }
  if (estado === 'cerrado') return { label: 'Cerrado', variant: 'outline' as const }
  return { label: 'Borrador', variant: 'secondary' as const }
}

function formatearFecha(fecha: string) {
  const fechaLocal = new Date(`${fecha}T00:00:00`)
  const texto = fechaLocal.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default async function EventosPage() {
  const misEventos = await listarEventos()

  return (
    <div className="flex min-h-screen flex-col">
      <OrganizadorTopbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Mis eventos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestioná tus eventos y sus galerías.
            </p>
          </div>
          <form action={logoutOrganizador}>
            <Button variant="outline" size="sm" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </div>

        {misEventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 text-center shadow-sm">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CalendarIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Todavía no tenés eventos
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Creá tu primer evento y compartí el QR con tus invitados.
            </p>
            <Button asChild className="h-12 gap-2 text-sm font-semibold uppercase tracking-widest">
              <Link href="/eventos/nuevo">
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                Crear mi primer evento
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button asChild size="sm" className="gap-2">
                <Link href="/eventos/nuevo">
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  Nuevo evento
                </Link>
              </Button>
            </div>
            {misEventos.map((evento) => {
              const { label, variant } = estadoInfo(evento.estado)
              return (
                <Card
                  key={evento.id}
                  className="border-border shadow-sm transition-shadow hover:shadow-md"
                >
                  <Link href={`/eventos/${evento.id}`} className="block">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{evento.nombre_evento}</CardTitle>
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <p>
                        {formatearFecha(evento.fecha)}
                        {evento.horario ? ` — ${evento.horario}` : ''}
                      </p>
                    </CardContent>
                  </Link>
                  <div className="flex justify-end border-t border-border px-6 py-1.5">
                    <EventoActionsMenu eventoId={evento.id} estado={evento.estado} />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
```

Nota de diseño: la `Card` deja de estar envuelta enteramente en un `<Link>` — ahora el `<Link>` envuelve solo el título/fecha (la navegación al panel del evento), y el menú de acciones vive en una fila aparte debajo, fuera del `<Link>`. Esto evita anidar un `<button>` interactivo dentro de un `<a>` (HTML inválido) sin necesitar `stopPropagation`.

- [ ] **Step 4: Verificar tipos y build**

Run: `npx turbo run typecheck --filter=@album/web`
Expected: sin errores.

Run: `pnpm --filter web build`
Expected: build exitoso, incluye la ruta `/eventos`.

- [ ] **Step 5: Verificación manual**

Con el dev server corriendo (`pnpm --filter web dev`), entrar a "Mis eventos" con al menos un evento en estado `activo`: confirmar que aparece el menú `⋮`, que "Cerrar evento" cambia el badge a "Cerrado" y el ítem del menú pasa a "Reactivar evento", y que "Eliminar evento" pide confirmación y hace desaparecer la card de la lista.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/dropdown-menu.tsx \
  apps/web/src/app/\(organizador\)/eventos/_components/EventoActionsMenu.tsx \
  apps/web/src/app/\(organizador\)/eventos/page.tsx
git commit -m "feat(web): cerrar/reactivar y eliminar evento desde Mis eventos"
```

---

### Task 4: Galería — ícono de eliminar rápido en cada miniatura

**Files:**
- Modify: `apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx`

**Interfaces:**
- Consumes: `eliminarArchivo` (`@/app/(organizador)/actions/archivos.actions`, ya existe — no se modifica), `AlertDialog*` (ya existe).
- Produces: nueva estructura de cada celda de la grilla — un `<div className="group relative ...">` que contiene un `<Link>` absolutamente posicionado (la navegación a detalle) más un botón de basurero como *hermano* del `<Link>` (no anidado dentro). Task 5 construye directamente sobre esta estructura.

- [ ] **Step 1: Reemplazar `GaleriaClient.tsx` completo**

Reemplazar el contenido completo de `apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx` por:

```tsx
'use client'

import { useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ImageIcon, Trash2 } from 'lucide-react'
import {
  eliminarArchivo,
  type ArchivoConInvitado,
} from '@/app/(organizador)/actions/archivos.actions'
import type { InvitadoConConteos } from '@/app/(organizador)/actions/invitados.actions'
import { estadoInfo } from '@/lib/archivo-estado'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

// Sentinel value for shadcn's <Select>, que no admite value="" en SelectItem.
// Se mapea de vuelta a `undefined` (sin filtro) al construir la URL.
const SIN_FILTRO = 'todos'

interface Filters {
  invitadoId?: string
  tipo?: string
  estado?: string
}

interface Props {
  eventoId: string
  archivos: ArchivoConInvitado[]
  invitados: InvitadoConConteos[]
  filters: Filters
}

export function GaleriaClient({ eventoId, archivos, invitados, filters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === SIN_FILTRO) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleEliminar(archivoId: string) {
    startTransition(async () => {
      const result = await eliminarArchivo(archivoId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Galería</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={filters.tipo ?? SIN_FILTRO} onValueChange={(v) => updateFilter('tipo', v)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los tipos</SelectItem>
            <SelectItem value="foto">Fotos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.estado ?? SIN_FILTRO}
          onValueChange={(v) => updateFilter('estado', v)}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="oculta">Oculta</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.invitadoId ?? SIN_FILTRO}
          onValueChange={(v) => updateFilter('invitadoId', v)}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Invitado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los invitados</SelectItem>
            {invitados.map((invitado) => (
              <SelectItem key={invitado.id} value={invitado.id}>
                {invitado.nombre} {invitado.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {archivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">No hay archivos</h2>
          <p className="text-sm text-muted-foreground">
            Todavía no hay fotos ni videos que coincidan con estos filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {archivos.map((archivo) => {
            const { label, variant } = estadoInfo(archivo.estado)
            return (
              <div
                key={archivo.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
              >
                <Link
                  href={`/eventos/${eventoId}/galeria/${archivo.id}`}
                  className="absolute inset-0 z-0 block"
                >
                  {archivo.tipo === 'video' ? (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-4xl">
                      🎬
                    </div>
                  ) : (
                    <Image
                      src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
                      alt={`Foto de ${archivo.invitado_nombre} ${archivo.invitado_apellido}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-sm font-medium text-white">
                      {archivo.invitado_nombre} {archivo.invitado_apellido}
                    </p>
                  </div>
                </Link>

                <div className="absolute right-2 top-2 z-20">
                  <Badge variant={variant}>{label}</Badge>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isPending}
                      aria-label="Eliminar archivo"
                      className="absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-destructive disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción borra el archivo de forma permanente, tanto de la galería
                        como del almacenamiento. No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault()
                          handleEliminar(archivo.id)
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx turbo run typecheck --filter=@album/web`
Expected: sin errores.

Run: `pnpm --filter web build`
Expected: build exitoso.

- [ ] **Step 3: Verificación manual**

En la Galería de un evento con al menos un archivo: en desktop, el ícono de basurero aparece solo al pasar el mouse sobre la miniatura; en una ventana angosta (mobile), aparece siempre visible. Al confirmarlo, el archivo desaparece de la grilla y (para verificar el borrado real) el objeto correspondiente ya no existe en el bucket R2.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx"
git commit -m "feat(web): icono de eliminar rapido en cada miniatura de la galeria"
```

---

### Task 5: Galería — Reproducción automática (carrusel)

**Files:**
- Create: `apps/web/src/app/(organizador)/eventos/[id]/galeria/_components/ReproduccionModal.tsx`
- Modify: `apps/web/src/app/(organizador)/eventos/[id]/galeria/page.tsx`
- Modify: `apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx`

**Interfaces:**
- Consumes: `ArchivoConInvitado` (`@/app/(organizador)/actions/archivos.actions`), `listarArchivos` (ya existe, se vuelve a llamar con `{ estado: 'aprobada' }`), la estructura de grilla de Task 4.
- Produces: `ReproduccionModal({ archivos, onClose }: { archivos: ArchivoConInvitado[]; onClose: () => void })`.

- [ ] **Step 1: Crear `ReproduccionModal.tsx`**

Crear `apps/web/src/app/(organizador)/eventos/[id]/galeria/_components/ReproduccionModal.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import type { ArchivoConInvitado } from '@/app/(organizador)/actions/archivos.actions'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
const SLIDE_DURATION_MS = 5000
const VIDEO_SAFETY_TIMEOUT_MS = 15000
const TICK_MS = 100

interface Props {
  archivos: ArchivoConInvitado[]
  onClose: () => void
}

export function ReproduccionModal({ archivos, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const archivo = archivos[index]

  const goNext = useCallback(() => {
    setProgress(0)
    setIndex((i) => (i + 1) % archivos.length)
  }, [archivos.length])

  const goPrev = useCallback(() => {
    setProgress(0)
    setIndex((i) => (i - 1 + archivos.length) % archivos.length)
  }, [archivos.length])

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  // Avance automático para fotos: progreso lineal cada 100ms.
  useEffect(() => {
    if (!isPlaying || !archivo || archivo.tipo === 'video') return

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + (TICK_MS / SLIDE_DURATION_MS) * 100
        if (next >= 100) {
          goNext()
          return 0
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [isPlaying, archivo, goNext])

  // Videos: autoplay/muted, avanzan en 'ended'. Timeout de seguridad para
  // que el carrusel nunca quede trabado si el video no dispara 'ended'.
  useEffect(() => {
    if (!archivo || archivo.tipo !== 'video') return

    const videoEl = videoRef.current
    if (isPlaying) {
      videoEl?.play().catch(() => {})
    } else {
      videoEl?.pause()
    }

    const safetyTimeout = setTimeout(() => {
      if (isPlaying) goNext()
    }, VIDEO_SAFETY_TIMEOUT_MS)

    return () => clearTimeout(safetyTimeout)
  }, [archivo, isPlaying, goNext])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, togglePlay, onClose])

  if (!archivo) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="fixed left-0 top-0 z-50 h-1 w-full bg-white/10">
        <div
          className="h-full bg-white transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar reproducción"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {archivo.tipo === 'video' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={archivo.id}
            ref={videoRef}
            src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
            muted
            autoPlay
            playsInline
            onEnded={goNext}
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration) setProgress((v.currentTime / v.duration) * 100)
            }}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <div className="relative h-[85vh] w-full">
            <Image
              key={archivo.id}
              src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
              alt={`Foto de ${archivo.invitado_nombre} ${archivo.invitado_apellido}`}
              fill
              className="rounded-lg object-contain shadow-2xl"
              sizes="100vw"
              priority
            />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 to-transparent px-4 pb-10 pt-20">
        <div className="text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/60">
            Compartido por
          </p>
          <h2 className="text-2xl font-bold text-white">
            {archivo.invitado_nombre} {archivo.invitado_apellido}
          </h2>
        </div>

        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Anterior"
            className="text-white/80 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-8 w-8" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform active:scale-90"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" aria-hidden="true" fill="currentColor" />
            ) : (
              <Play className="h-8 w-8" aria-hidden="true" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Siguiente"
            className="text-white/80 transition-colors hover:text-white"
          >
            <ChevronRight className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-full border border-white/10 bg-white/10 px-4 py-1">
          <span className="text-xs font-semibold text-white/90">
            {index + 1} / {archivos.length}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Traer los archivos aprobados en `galeria/page.tsx`**

Reemplazar el contenido completo de `apps/web/src/app/(organizador)/eventos/[id]/galeria/page.tsx` por:

```tsx
import { listarArchivos } from '@/app/(organizador)/actions/archivos.actions'
import { listarInvitados } from '@/app/(organizador)/actions/invitados.actions'
import { GaleriaClient } from './GaleriaClient'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ invitadoId?: string; tipo?: string; estado?: string }>
}

export default async function GaleriaPage({ params, searchParams }: Props) {
  const { id } = await params
  const { invitadoId, tipo, estado } = await searchParams

  const [archivos, invitados, archivosAprobados] = await Promise.all([
    listarArchivos(id, { invitadoId, tipo, estado }),
    listarInvitados(id),
    listarArchivos(id, { estado: 'aprobada' }),
  ])

  return (
    <GaleriaClient
      eventoId={id}
      archivos={archivos}
      archivosAprobados={archivosAprobados}
      invitados={invitados}
      filters={{ invitadoId, tipo, estado }}
    />
  )
}
```

- [ ] **Step 3: Agregar el botón "Reproducir" y montar el modal en `GaleriaClient.tsx`**

Reemplazar el contenido completo de `apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx` por:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ImageIcon, Play, Trash2 } from 'lucide-react'
import {
  eliminarArchivo,
  type ArchivoConInvitado,
} from '@/app/(organizador)/actions/archivos.actions'
import type { InvitadoConConteos } from '@/app/(organizador)/actions/invitados.actions'
import { estadoInfo } from '@/lib/archivo-estado'
import { ReproduccionModal } from './_components/ReproduccionModal'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

// Sentinel value for shadcn's <Select>, que no admite value="" en SelectItem.
// Se mapea de vuelta a `undefined` (sin filtro) al construir la URL.
const SIN_FILTRO = 'todos'

interface Filters {
  invitadoId?: string
  tipo?: string
  estado?: string
}

interface Props {
  eventoId: string
  archivos: ArchivoConInvitado[]
  archivosAprobados: ArchivoConInvitado[]
  invitados: InvitadoConConteos[]
  filters: Filters
}

export function GaleriaClient({
  eventoId,
  archivos,
  archivosAprobados,
  invitados,
  filters,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [reproduccionAbierta, setReproduccionAbierta] = useState(false)

  function updateFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === SIN_FILTRO) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleEliminar(archivoId: string) {
    startTransition(async () => {
      const result = await eliminarArchivo(archivoId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Galería</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'}
          </p>
        </div>
        {archivosAprobados.length > 0 && (
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => setReproduccionAbierta(true)}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Reproducir
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={filters.tipo ?? SIN_FILTRO} onValueChange={(v) => updateFilter('tipo', v)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los tipos</SelectItem>
            <SelectItem value="foto">Fotos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.estado ?? SIN_FILTRO}
          onValueChange={(v) => updateFilter('estado', v)}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="oculta">Oculta</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.invitadoId ?? SIN_FILTRO}
          onValueChange={(v) => updateFilter('invitadoId', v)}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Invitado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_FILTRO}>Todos los invitados</SelectItem>
            {invitados.map((invitado) => (
              <SelectItem key={invitado.id} value={invitado.id}>
                {invitado.nombre} {invitado.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {archivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">No hay archivos</h2>
          <p className="text-sm text-muted-foreground">
            Todavía no hay fotos ni videos que coincidan con estos filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {archivos.map((archivo) => {
            const { label, variant } = estadoInfo(archivo.estado)
            return (
              <div
                key={archivo.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
              >
                <Link
                  href={`/eventos/${eventoId}/galeria/${archivo.id}`}
                  className="absolute inset-0 z-0 block"
                >
                  {archivo.tipo === 'video' ? (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-4xl">
                      🎬
                    </div>
                  ) : (
                    <Image
                      src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
                      alt={`Foto de ${archivo.invitado_nombre} ${archivo.invitado_apellido}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-sm font-medium text-white">
                      {archivo.invitado_nombre} {archivo.invitado_apellido}
                    </p>
                  </div>
                </Link>

                <div className="absolute right-2 top-2 z-20">
                  <Badge variant={variant}>{label}</Badge>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isPending}
                      aria-label="Eliminar archivo"
                      className="absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-destructive disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción borra el archivo de forma permanente, tanto de la galería
                        como del almacenamiento. No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault()
                          handleEliminar(archivo.id)
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )
          })}
        </div>
      )}

      {reproduccionAbierta && (
        <ReproduccionModal
          archivos={archivosAprobados}
          onClose={() => setReproduccionAbierta(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx turbo run typecheck --filter=@album/web`
Expected: sin errores.

Run: `pnpm --filter web build`
Expected: build exitoso.

- [ ] **Step 5: Verificación manual**

Con un evento que tenga al menos 2 fotos y 1 video en estado `aprobada`: el botón "Reproducir" abre el modal fullscreen, avanza solo cada 5s en fotos, el video se reproduce mudo y avanza al terminar, las flechas ← → y los botones anterior/siguiente navegan manualmente, pausar detiene el avance, y el nombre mostrado nunca incluye la palabra "Pendiente"/"Aprobada"/"Oculta". Ocultar una foto desde el detalle y confirmar que ya no aparece en una nueva apertura del carrusel (requiere recargar la página, ya que `archivosAprobados` se carga en el server component).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(organizador)/eventos/[id]/galeria/_components/ReproduccionModal.tsx" \
  "apps/web/src/app/(organizador)/eventos/[id]/galeria/page.tsx" \
  "apps/web/src/app/(organizador)/eventos/[id]/galeria/GaleriaClient.tsx"
git commit -m "feat(web): reproduccion automatica de fotos y videos aprobados en la galeria"
```

---

### Task 6: Verificación final e indexado

**Files:** ninguno nuevo — solo comandos de verificación sobre todo lo hecho en Tasks 1-5.

**Interfaces:** ninguna — tarea de integración/QA.

- [ ] **Step 1: Typecheck de todo el monorepo**

Run: `npx turbo run typecheck`
Expected: sin errores en `@album/web` y `@album/api`.

- [ ] **Step 2: Tests de `apps/api`**

Run: `pnpm --filter api test`
Expected: todos los tests pasan, incluyendo el nuevo de Task 1.

- [ ] **Step 3: Build de `apps/web`**

Run: `pnpm --filter web build`
Expected: build exitoso, sin rutas rotas.

- [ ] **Step 4: Reindexar codegraph**

Run: `codegraph index`
Expected: confirma que `eventos.actions.ts`, `EventoActionsMenu.tsx`, `dropdown-menu.tsx`, `GaleriaClient.tsx`, `ReproduccionModal.tsx` y `archivos.routes.ts` quedan indexados.

- [ ] **Step 5: Checklist manual de aceptación (evento real de prueba)**

1. Crear un evento de prueba, activarlo, registrar un invitado y subir 2 fotos + 1 video desde `/e/:slug/subir` — confirmar en la Galería que entran directo con badge "Aprobada" (no "Pendiente").
2. Abrir "Reproducir": el carrusel avanza automáticamente por las 3, muestra el nombre del invitado sin badge de estado, video mudo autoplay.
3. Ocultar una de las fotos desde el detalle; recargar la Galería y volver a abrir "Reproducir" — esa foto ya no aparece.
4. Borrar un archivo desde el ícono de basurero en su miniatura; confirmar que desaparece de la grilla y que el objeto ya no existe en R2.
5. Desde "Mis eventos", cerrar el evento de prueba; confirmar que `/e/:slug` ya no permite registro/subida (ya cubierto por los guards existentes de `estado !== 'activo'`); reactivarlo y confirmar que vuelve a funcionar.
6. Eliminar el evento de prueba; confirmar en Supabase que no quedan filas de `eventos`/`invitados`/`archivos` para ese evento, y en el bucket R2 que no quedan objetos bajo `eventos/<id>/`.

- [ ] **Step 6: Commit final (si el checklist manual generó cambios, p. ej. actualizar el ledger)**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: cierre de plan galeria-y-eventos-acciones"
```
