-- Agrega archivos.tamano_bytes (migrations/0003_silent_skin.sql): el peso
-- real de cada archivo en R2, para mostrarle al organizador cuánto espacio
-- ocupa su evento y su cuenta.
--
-- IMPORTANTE: correrlo en el SQL Editor de Supabase ANTES de deployar la
-- API y la web que usan esta columna. Si el código nuevo llega primero,
-- las subidas y la galería fallan con 'column "tamano_bytes" does not exist'.
--
-- Mismo patrón que 0003_crear_donaciones.sql: se aplica a mano y se marca
-- como aplicada en la tabla de control de Drizzle, para que el próximo
-- "pnpm db:migrate" no intente agregarla de nuevo.
--
-- hash = sha256 del contenido exacto de migrations/0003_silent_skin.sql
created_at = el "when" de esa entrada en migrations/meta/_journal.json
--
-- Se puede correr más de una vez sin romper nada.

begin;

alter table public.archivos add column if not exists "tamano_bytes" bigint;

insert into drizzle.__drizzle_migrations (hash, created_at)
select 'fc25e5aef850587aac556a97ce1c266db5747d62198de849440718c92eccdf70', 1791387821545
where not exists (
  select 1 from drizzle.__drizzle_migrations
  where hash = 'fc25e5aef850587aac556a97ce1c266db5747d62198de849440718c92eccdf70'
);

commit;
