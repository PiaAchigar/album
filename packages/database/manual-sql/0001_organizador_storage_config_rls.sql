-- RLS de organizador_storage_config: cada organizador solo ve/edita
-- su propia configuración de storage.
-- Aplicado a mano en el SQL Editor de Supabase (mismo patrón que
-- organizador_owns_evento en eventos) — no vive en migrations/
-- porque Drizzle no gestiona políticas RLS acá.

alter table public.organizador_storage_config enable row level security;

create policy organizador_owns_storage_config
  on public.organizador_storage_config
  for all
  using (organizador_id = auth.uid())
  with check (organizador_id = auth.uid());
