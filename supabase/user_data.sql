-- =====================================================================
--  Tabla principal: un documento JSON con todos los datos de cada usuario
--
--  Cada persona solo puede ver y cambiar su propia fila (RLS). La app
--  fija updated_at en cada guardado (no hace falta un trigger).
-- =====================================================================

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists user_data_own_select on public.user_data;
create policy user_data_own_select on public.user_data
  for select to authenticated using (user_id = auth.uid());

drop policy if exists user_data_own_insert on public.user_data;
create policy user_data_own_insert on public.user_data
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_data_own_update on public.user_data;
create policy user_data_own_update on public.user_data
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_data_own_delete on public.user_data;
create policy user_data_own_delete on public.user_data
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- Consulta mínima que hace la app una vez al día para que Supabase no
-- pause el proyecto por inactividad (plan gratis). No lee ningún dato.
create or replace function public.ping()
returns integer
language sql
stable
as $$ select 1 $$;

grant execute on function public.ping() to anon, authenticated;
