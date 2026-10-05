-- Crea la tabla donaciones (migrations/0002_magenta_the_order.sql), que
-- nunca se aplicó en producción: POST /donaciones fallaba con
-- 'relation "donaciones" does not exist'.
--
-- Mismo patrón que 0002_marcar_migracion_0001_aplicada.sql: se aplica a
-- mano en el SQL Editor y se marca como aplicada en la tabla de control
-- de Drizzle, para que el próximo "pnpm db:migrate" no intente crearla
-- de nuevo.
--
-- hash = sha256 del contenido exacto de migrations/0002_magenta_the_order.sql
-- created_at = el "when" de esa entrada en migrations/meta/_journal.json
--
-- Se puede correr más de una vez sin romper nada.

begin;

create table if not exists public.donaciones (
  "id" uuid primary key default gen_random_uuid() not null,
  "monto" integer not null,
  "estado" text default 'pendiente' not null,
  "origen" text not null,
  "organizador_id" uuid,
  "mp_preference_id" text not null,
  "mp_payment_id" text,
  "created_at" timestamp with time zone default now()
);

-- RLS activado sin políticas: nadie puede leer ni escribir donaciones
-- desde el cliente de Supabase (la anon key es pública en la web). La API
-- accede con la conexión directa a Postgres, que no pasa por RLS.
alter table public.donaciones enable row level security;

create schema if not exists drizzle;

create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

insert into drizzle.__drizzle_migrations (hash, created_at)
select '243b99ede67f2339c74e1a50fea4abe852f1311cf4e1e40a1bc56783773da8c3', 1790168988712
where not exists (
  select 1 from drizzle.__drizzle_migrations
  where hash = '243b99ede67f2339c74e1a50fea4abe852f1311cf4e1e40a1bc56783773da8c3'
);

commit;
