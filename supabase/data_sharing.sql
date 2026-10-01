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
