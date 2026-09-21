-- Marca la migración migrations/0001_silly_polaris.sql como ya
-- aplicada en la tabla de control interna de Drizzle, sin volver a
-- ejecutar su CREATE TABLE (se aplicó a mano en el SQL Editor).
-- Sin esto, el próximo "pnpm db:migrate" va a fallar con
-- 'relation "organizador_storage_config" already exists', porque
-- Drizzle no tiene registro de que ya corrió.
--
-- hash = sha256 del contenido exacto de migrations/0001_silly_polaris.sql
-- created_at = el "when" de esa entrada en migrations/meta/_journal.json

create schema if not exists drizzle;

create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

insert into drizzle.__drizzle_migrations (hash, created_at)
values (
  '1f91d8a8cec299bc320ec76efac2ad7e65b5efb765ca1cf89123db4c6df93e7e',
  1789666033204
);
