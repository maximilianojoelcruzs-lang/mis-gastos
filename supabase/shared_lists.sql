-- =====================================================================
--  Listas compartidas del supermercado (pareja / familia)
--
--  Cómo activarlo: en el panel de Supabase abre "SQL Editor", pega todo
--  este archivo y presiona "Run". Se puede ejecutar más de una vez.
--
--  Modelo:
--    shared_lists   una lista con un código de invitación
--    shared_members quiénes participan
--    shared_items   los productos (una fila por producto)
--  Solo los participantes de una lista pueden ver o editar sus productos.
-- =====================================================================

create table if not exists public.shared_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Lista compartida',
  code       text not null unique,
  owner      uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_members (
  list_id   uuid not null references public.shared_lists (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  email     text,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists public.shared_items (
  list_id    uuid not null references public.shared_lists (id) on delete cascade,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  -- Los productos borrados se marcan (no se eliminan) para que el otro
  -- dispositivo se entere del borrado.
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (list_id, id)
);

create index if not exists shared_members_user_idx on public.shared_members (user_id);

-- La hora la fija siempre el servidor: así "el último cambio gana" sin
-- depender del reloj de cada celular.
create or replace function public.shared_items_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists shared_items_touch on public.shared_items;
create trigger shared_items_touch
  before insert or update on public.shared_items
  for each row execute function public.shared_items_touch();

-- ¿El usuario actual participa en la lista? (security definer evita la
-- recursión de las políticas al consultar shared_members).
create or replace function public.is_list_member(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_members m
    where m.list_id = p_list and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
--  Seguridad por filas (RLS)
-- ---------------------------------------------------------------------
alter table public.shared_lists   enable row level security;
alter table public.shared_members enable row level security;
alter table public.shared_items   enable row level security;

drop policy if exists shared_lists_select on public.shared_lists;
create policy shared_lists_select on public.shared_lists
  for select to authenticated using (public.is_list_member(id));

drop policy if exists shared_lists_update on public.shared_lists;
create policy shared_lists_update on public.shared_lists
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists shared_members_select on public.shared_members;
create policy shared_members_select on public.shared_members
  for select to authenticated using (public.is_list_member(list_id));

drop policy if exists shared_items_select on public.shared_items;
create policy shared_items_select on public.shared_items
  for select to authenticated using (public.is_list_member(list_id));

drop policy if exists shared_items_insert on public.shared_items;
create policy shared_items_insert on public.shared_items
  for insert to authenticated with check (public.is_list_member(list_id));

drop policy if exists shared_items_update on public.shared_items;
create policy shared_items_update on public.shared_items
  for update to authenticated
  using (public.is_list_member(list_id)) with check (public.is_list_member(list_id));

-- Crear listas, unirse y salir se hacen solo con estas funciones.
revoke all on public.shared_lists, public.shared_members, public.shared_items from anon;
revoke insert, delete on public.shared_lists   from authenticated;
revoke insert, update, delete on public.shared_members from authenticated;
revoke delete on public.shared_items from authenticated;

-- ---------------------------------------------------------------------
--  Funciones
-- ---------------------------------------------------------------------
create or replace function public.create_shared_list(p_name text)
returns table (id uuid, name text, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_code text;
  v_name text := coalesce(nullif(left(trim(p_name), 40), ''), 'Lista compartida');
  v_try  int := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (select 1 from public.shared_lists l where l.code = v_code);
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'code_unavailable';
    end if;
  end loop;

  insert into public.shared_lists (name, code, owner)
  values (v_name, v_code, auth.uid())
  returning shared_lists.id into v_id;

  insert into public.shared_members (list_id, user_id, email)
  values (v_id, auth.uid(), auth.jwt() ->> 'email');

  return query select v_id, v_name, v_code;
end;
$$;

create or replace function public.join_shared_list(p_code text)
returns table (id uuid, name text, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list public.shared_lists%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_list from public.shared_lists l
  where l.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'not_found';
  end if;

  if (select count(*) from public.shared_members m where m.list_id = v_list.id) >= 8
     and not exists (select 1 from public.shared_members m where m.list_id = v_list.id and m.user_id = auth.uid()) then
    raise exception 'list_full';
  end if;

  insert into public.shared_members (list_id, user_id, email)
  values (v_list.id, auth.uid(), auth.jwt() ->> 'email')
  on conflict (list_id, user_id) do nothing;

  return query select v_list.id, v_list.name, v_list.code;
end;
$$;

create or replace function public.leave_shared_list(p_list uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.shared_members m
  where m.list_id = p_list and m.user_id = auth.uid();

  -- Si ya no queda nadie, se elimina la lista con sus productos.
  if not exists (select 1 from public.shared_members m where m.list_id = p_list) then
    delete from public.shared_lists l where l.id = p_list;
  end if;
end;
$$;

revoke all on function public.create_shared_list(text) from public, anon;
revoke all on function public.join_shared_list(text)   from public, anon;
revoke all on function public.leave_shared_list(uuid)  from public, anon;
grant execute on function public.create_shared_list(text) to authenticated;
grant execute on function public.join_shared_list(text)   to authenticated;
grant execute on function public.leave_shared_list(uuid)  to authenticated;
grant execute on function public.is_list_member(uuid)     to authenticated;

grant select, update on public.shared_lists   to authenticated;
grant select         on public.shared_members to authenticated;
grant select, insert, update on public.shared_items to authenticated;
