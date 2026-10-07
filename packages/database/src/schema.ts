import {
  bigint,
  boolean,
  date,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const eventos = pgTable('eventos', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizador_id: uuid('organizador_id').notNull(),
  slug: text('slug').unique().notNull(),
  nombre_evento: text('nombre_evento').notNull(),
  fecha: date('fecha').notNull(),
  horario: time('horario').notNull(),
  foto_portada_url: text('foto_portada_url'),
  cantidad_invitados_totales: integer('cantidad_invitados_totales'),
  limite_invitados_login: integer('limite_invitados_login').notNull(),
  limite_fotos_por_invitado: integer('limite_fotos_por_invitado').notNull(),
  limite_videos_por_invitado: integer('limite_videos_por_invitado').notNull(),
  estado: text('estado').notNull().default('borrador'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const invitados = pgTable('invitados', {
  id: uuid('id').primaryKey().defaultRandom(),
  evento_id: uuid('evento_id')
    .notNull()
    .references(() => eventos.id),
  nombre: text('nombre').notNull(),
  apellido: text('apellido').notNull(),
  telefono: text('telefono'),
  acepto_terminos: boolean('acepto_terminos').notNull(),
  token_sesion: text('token_sesion').notNull().unique(),
  fotos_subidas: integer('fotos_subidas').notNull().default(0),
  videos_subidos: integer('videos_subidos').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const archivos = pgTable('archivos', {
  id: uuid('id').primaryKey().defaultRandom(),
  evento_id: uuid('evento_id')
    .notNull()
    .references(() => eventos.id),
  invitado_id: uuid('invitado_id')
    .notNull()
    .references(() => invitados.id),
  tipo: text('tipo').notNull(),
  r2_key: text('r2_key').notNull(),
  thumbnail_key: text('thumbnail_key'),
  // Real size in R2, read with HeadObject when the upload is confirmed.
  // Null for files uploaded before this column existed.
  tamano_bytes: bigint('tamano_bytes', { mode: 'number' }),
  estado: text('estado').notNull().default('pendiente'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const organizadorStorageConfig = pgTable('organizador_storage_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizador_id: uuid('organizador_id').notNull().unique(),
  r2_account_id_cipher: text('r2_account_id_cipher').notNull(),
  r2_account_id_iv: text('r2_account_id_iv').notNull(),
  r2_account_id_tag: text('r2_account_id_tag').notNull(),
  r2_access_key_id_cipher: text('r2_access_key_id_cipher').notNull(),
  r2_access_key_id_iv: text('r2_access_key_id_iv').notNull(),
  r2_access_key_id_tag: text('r2_access_key_id_tag').notNull(),
  r2_secret_access_key_cipher: text('r2_secret_access_key_cipher').notNull(),
  r2_secret_access_key_iv: text('r2_secret_access_key_iv').notNull(),
  r2_secret_access_key_tag: text('r2_secret_access_key_tag').notNull(),
  r2_bucket_name_cipher: text('r2_bucket_name_cipher').notNull(),
  r2_bucket_name_iv: text('r2_bucket_name_iv').notNull(),
  r2_bucket_name_tag: text('r2_bucket_name_tag').notNull(),
  verificado_at: timestamp('verificado_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export type Evento = typeof eventos.$inferSelect
export type NuevoEvento = typeof eventos.$inferInsert
export type Invitado = typeof invitados.$inferSelect
export type NuevoInvitado = typeof invitados.$inferInsert
export type Archivo = typeof archivos.$inferSelect
export type NuevoArchivo = typeof archivos.$inferInsert
export type OrganizadorStorageConfig = typeof organizadorStorageConfig.$inferSelect
export type NuevoOrganizadorStorageConfig = typeof organizadorStorageConfig.$inferInsert

// ─── Donaciones (Mercado Pago) ─────────────────────────────
export const donaciones = pgTable('donaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  monto: integer('monto').notNull(),
  estado: text('estado').notNull().default('pendiente'),
  origen: text('origen').notNull(),
  organizador_id: uuid('organizador_id'),
  mp_preference_id: text('mp_preference_id').notNull(),
  mp_payment_id: text('mp_payment_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export type Donacion = typeof donaciones.$inferSelect
export type NuevaDonacion = typeof donaciones.$inferInsert