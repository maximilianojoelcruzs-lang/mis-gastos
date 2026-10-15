-- =====================================================================
--  Mis Gastos: instalación completa de la base de datos en Supabase
--
--  Cómo usarlo: en el panel de Supabase abre "SQL Editor", pega TODO este
--  archivo y presiona "Run". Se puede ejecutar más de una vez.
--
--  Incluye, en este orden (también están por separado en esta carpeta):
--    1. user_data.sql     tabla principal + seguridad
--    2. shared_lists.sql  lista del súper compartida
--    3. data_sharing.sql  compartir finanzas con roles (lector / editor)
--  Generado juntando esos tres archivos: si cambias uno, vuelve a generarlo.
-- =====================================================================


-- >>>>>>>>>>>>>>>>>>>> user_data.sql
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

-- >>>>>>>>>>>>>>>>>>>> shared_lists.sql
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

-- >>>>>>>>>>>>>>>>>>>> data_sharing.sql
-- =====================================================================
--  Compartir tus finanzas con otra persona (pareja / familia)
--
--  Cómo activarlo: en el panel de Supabase abre "SQL Editor", pega todo
--  este archivo y presiona "Run". Se puede ejecutar más de una vez.
--
--  Roles:
--    lector  puede ver tus datos, pero no cambiarlos
--    editor  puede ver y cambiar tus datos
--  Se invita con un código de un solo uso que vence en 7 días.
--  Estas políticas se SUMAN a las que ya tiene user_data (el dueño sigue
--  teniendo acceso completo a su fila).
-- =====================================================================

create table if not exists public.data_members (
  owner_id     uuid not null references auth.users (id) on delete cascade,
  member_id    uuid not null references auth.users (id) on delete cascade,
  owner_email  text,
  member_email text,
  role         text not null check (role in ('lector', 'editor')),
  joined_at    timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);

create table if not exists public.data_invites (
  code        text primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  role        text not null check (role in ('lector', 'editor')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);

create index if not exists data_members_member_idx on public.data_members (member_id);
create index if not exists data_invites_owner_idx on public.data_invites (owner_id);

-- Rol del usuario actual sobre los datos de p_owner (null = sin acceso).
-- security definer evita la recursión de políticas al consultar data_members.
create or replace function public.data_role(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.data_members m
  where m.owner_id = p_owner and m.member_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
--  Seguridad por filas (RLS)
-- ---------------------------------------------------------------------
alter table public.data_members enable row level security;
alter table public.data_invites enable row level security;

drop policy if exists data_members_select on public.data_members;
create policy data_members_select on public.data_members
  for select to authenticated using (owner_id = auth.uid() or member_id = auth.uid());

drop policy if exists data_invites_select on public.data_invites;
create policy data_invites_select on public.data_invites
  for select to authenticated using (owner_id = auth.uid());

-- Lectores y editores pueden leer la fila del dueño; solo los editores pueden cambiarla.
drop policy if exists user_data_shared_select on public.user_data;
create policy user_data_shared_select on public.user_data
  for select to authenticated using (public.data_role(user_id) is not null);

drop policy if exists user_data_shared_update on public.user_data;
create policy user_data_shared_update on public.user_data
  for update to authenticated
  using (public.data_role(user_id) = 'editor')
  with check (public.data_role(user_id) = 'editor');

-- Invitar, aceptar, cambiar rol y quitar se hace solo con estas funciones.
revoke all on public.data_members, public.data_invites from anon;
revoke insert, update, delete on public.data_members from authenticated;
revoke insert, update, delete on public.data_invites from authenticated;
grant select on public.data_members, public.data_invites to authenticated;

-- ---------------------------------------------------------------------
--  Funciones
-- ---------------------------------------------------------------------
create or replace function public.create_data_invite(p_role text)
returns table (code text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_try  int := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_role not in ('lector', 'editor') then
    raise exception 'bad_role';
  end if;

  delete from public.data_invites i where i.owner_id = auth.uid() and i.expires_at < now();
  if (select count(*) from public.data_invites i where i.owner_id = auth.uid()) >= 5 then
    raise exception 'too_many_invites';
  end if;
  if (select count(*) from public.data_members m where m.owner_id = auth.uid()) >= 5 then
    raise exception 'too_many_members';
  end if;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (select 1 from public.data_invites i where i.code = v_code);
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'code_unavailable';
    end if;
  end loop;

  insert into public.data_invites (code, owner_id, owner_email, role)
  values (v_code, auth.uid(), auth.jwt() ->> 'email', p_role);

  return query select i.code, i.role, i.expires_at from public.data_invites i where i.code = v_code;
end;
$$;

create or replace function public.accept_data_invite(p_code text)
returns table (owner_id uuid, owner_email text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.data_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv from public.data_invites i
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found or v_inv.expires_at < now() then
    raise exception 'not_found';
  end if;
  if v_inv.owner_id = auth.uid() then
    raise exception 'own_invite';
  end if;
  if (select count(*) from public.data_members m where m.owner_id = v_inv.owner_id) >= 5
     and not exists (select 1 from public.data_members m where m.owner_id = v_inv.owner_id and m.member_id = auth.uid()) then
    raise exception 'too_many_members';
  end if;

  insert into public.data_members (owner_id, member_id, owner_email, member_email, role)
  values (v_inv.owner_id, auth.uid(), v_inv.owner_email, auth.jwt() ->> 'email', v_inv.role)
  on conflict on constraint data_members_pkey do update set role = excluded.role;

  -- El código es de un solo uso.
  delete from public.data_invites i where i.code = v_inv.code;

  return query select v_inv.owner_id, v_inv.owner_email, v_inv.role;
end;
$$;

create or replace function public.set_data_member_role(p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('lector', 'editor') then
    raise exception 'bad_role';
  end if;
  update public.data_members m set role = p_role
  where m.owner_id = auth.uid() and m.member_id = p_member;
end;
$$;

-- El dueño puede quitar a cualquiera; un miembro puede salirse.
create or replace function public.remove_data_member(p_owner uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() not in (p_owner, p_member) then
    raise exception 'not_allowed';
  end if;
  delete from public.data_members m where m.owner_id = p_owner and m.member_id = p_member;
end;
$$;

create or replace function public.revoke_data_invite(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.data_invites i where i.code = p_code and i.owner_id = auth.uid();
$$;

revoke all on function public.create_data_invite(text)            from public, anon;
revoke all on function public.accept_data_invite(text)            from public, anon;
revoke all on function public.set_data_member_role(uuid, text)    from public, anon;
revoke all on function public.remove_data_member(uuid, uuid)      from public, anon;
revoke all on function public.revoke_data_invite(text)            from public, anon;
revoke all on function public.data_role(uuid)                     from public, anon;
grant execute on function public.create_data_invite(text)         to authenticated;
grant execute on function public.accept_data_invite(text)         to authenticated;
grant execute on function public.set_data_member_role(uuid, text) to authenticated;
grant execute on function public.remove_data_member(uuid, uuid)   to authenticated;
grant execute on function public.revoke_data_invite(text)         to authenticated;
grant execute on function public.data_role(uuid)                  to authenticated;
