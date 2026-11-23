-- El Cóndor · Campus de formación
-- Usuarios propios, sesiones y progreso sincronizado.
--
-- Diseño: las tablas no son accesibles con la clave pública (RLS activada sin políticas).
-- El navegador solo puede llamar a las funciones de este archivo, que verifican la sesión
-- y el rol en el servidor. Las contraseñas se guardan con bcrypt (pgcrypto).
-- Es idempotente: puede ejecutarse más de una vez.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create table if not exists public.campus_users (
  id uuid primary key default gen_random_uuid(),
  username extensions.citext not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name text not null default '',
  sector text not null default '',
  role text not null default 'empleado' check (role in ('admin', 'empleado')),
  password_hash text not null,
  must_change_password boolean not null default true,
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.campus_users(id) on delete set null,
  last_login_at timestamptz
);

create table if not exists public.campus_sessions (
  token_hash text primary key,
  user_id uuid not null references public.campus_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists campus_sessions_user_idx on public.campus_sessions(user_id);

create table if not exists public.campus_progress (
  user_id uuid primary key references public.campus_users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.campus_users enable row level security;
alter table public.campus_sessions enable row level security;
alter table public.campus_progress enable row level security;
revoke all on public.campus_users, public.campus_sessions, public.campus_progress from anon, authenticated;

-- ---------- utilidades internas ----------
create or replace function public._campus_hash_token(p_token text) returns text
language sql immutable as $$ select encode(extensions.digest(p_token, 'sha256'), 'hex') $$;

create or replace function public._campus_session_user(p_token text) returns public.campus_users
language plpgsql security definer set search_path = public, extensions as $$
declare u public.campus_users;
begin
  select cu.* into u
  from campus_sessions s join campus_users cu on cu.id = s.user_id
  where s.token_hash = _campus_hash_token(p_token) and s.expires_at > now() and cu.active;
  if not found then raise exception 'SESION_INVALIDA' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function public._campus_user_json(u public.campus_users) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', u.id, 'username', u.username, 'displayName', u.display_name, 'sector', u.sector,
    'role', u.role, 'mustChangePassword', u.must_change_password, 'active', u.active,
    'createdAt', u.created_at, 'lastLoginAt', u.last_login_at)
$$;

create or replace function public._campus_check_password(p text) returns void
language plpgsql as $$
begin
  if p is null or length(p) < 8 then raise exception 'CONTRASENA_CORTA' using errcode = '22023'; end if;
end $$;

-- ---------- sesión ----------
-- Un error de credenciales se devuelve como dato (no como excepción) para que el contador
-- de intentos fallidos no se deshaga junto con la transacción.
create or replace function public.campus_login(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u campus_users; v_token text;
begin
  select * into u from campus_users where username = lower(trim(p_username));
  if not found then
    perform pg_sleep(0.4);
    return jsonb_build_object('error', 'CREDENCIALES');
  end if;
  if u.locked_until is not null and u.locked_until > now() then return jsonb_build_object('error', 'BLOQUEADO'); end if;
  if not u.active then return jsonb_build_object('error', 'INACTIVO'); end if;
  if u.password_hash <> crypt(p_password, u.password_hash) then
    update campus_users set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 8 then now() + interval '15 minutes' else null end
    where id = u.id;
    perform pg_sleep(0.4);
    return jsonb_build_object('error', 'CREDENCIALES');
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into campus_sessions(token_hash, user_id) values (_campus_hash_token(v_token), u.id);
  update campus_users set failed_attempts = 0, locked_until = null, last_login_at = now() where id = u.id returning * into u;
  delete from campus_sessions where expires_at < now();
  return jsonb_build_object('token', v_token, 'user', _campus_user_json(u));
end $$;

create or replace function public.campus_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from campus_sessions where token_hash = _campus_hash_token(p_token)
$$;

create or replace function public.campus_me(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin return _campus_user_json(_campus_session_user(p_token)); end $$;

create or replace function public.campus_change_password(p_token text, p_current text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u campus_users;
begin
  u := _campus_session_user(p_token);
  if u.password_hash <> crypt(p_current, u.password_hash) then raise exception 'CREDENCIALES' using errcode = '28P01'; end if;
  perform _campus_check_password(p_new);
  update campus_users set password_hash = crypt(p_new, gen_salt('bf', 10)), must_change_password = false where id = u.id;
  -- cierra las otras sesiones
  delete from campus_sessions where user_id = u.id and token_hash <> _campus_hash_token(p_token);
end $$;

-- ---------- progreso ----------
create or replace function public.campus_get_progress(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u campus_users; r campus_progress;
begin
  u := _campus_session_user(p_token);
  select * into r from campus_progress where user_id = u.id;
  if not found then return null; end if;
  return jsonb_build_object('data', r.data, 'updatedAt', r.updated_at);
end $$;

create or replace function public.campus_save_progress(p_token text, p_data jsonb) returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare u campus_users; v_at timestamptz := now();
begin
  u := _campus_session_user(p_token);
  if pg_column_size(p_data) > 512 * 1024 then raise exception 'PROGRESO_GRANDE' using errcode = '22023'; end if;
  insert into campus_progress(user_id, data, updated_at) values (u.id, p_data, v_at)
  on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return v_at;
end $$;

-- ---------- administración ----------
create or replace function public._campus_require_admin(p_token text) returns public.campus_users
language plpgsql security definer set search_path = public, extensions as $$
declare u campus_users;
begin
  u := _campus_session_user(p_token);
  if u.role <> 'admin' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  return u;
end $$;

create or replace function public.campus_admin_list_users(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _campus_require_admin(p_token);
  return coalesce((
    select jsonb_agg(_campus_user_json(cu) || jsonb_build_object(
      'progress', p.data, 'progressUpdatedAt', p.updated_at) order by cu.role, cu.username)
    from campus_users cu left join campus_progress p on p.user_id = cu.id
  ), '[]'::jsonb);
end $$;

create or replace function public.campus_admin_create_user(p_token text, p_username text, p_password text,
  p_display_name text, p_sector text, p_role text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a campus_users; u campus_users;
begin
  a := _campus_require_admin(p_token);
  perform _campus_check_password(p_password);
  if p_role not in ('admin', 'empleado') then raise exception 'ROL_INVALIDO' using errcode = '22023'; end if;
  if exists (select 1 from campus_users where username = lower(trim(p_username))) then raise exception 'USUARIO_EXISTE' using errcode = '23505'; end if;
  insert into campus_users(username, password_hash, display_name, sector, role, created_by, must_change_password)
  values (lower(trim(p_username)), crypt(p_password, gen_salt('bf', 10)), coalesce(trim(p_display_name), ''), coalesce(trim(p_sector), ''), p_role, a.id, true)
  returning * into u;
  return _campus_user_json(u);
end $$;

create or replace function public.campus_admin_update_user(p_token text, p_user_id uuid, p_display_name text,
  p_sector text, p_role text, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a campus_users; u campus_users;
begin
  a := _campus_require_admin(p_token);
  if p_user_id = a.id and (p_active = false or p_role <> 'admin') then raise exception 'NO_AUTO_DEGRADAR' using errcode = '42501'; end if;
  if p_role not in ('admin', 'empleado') then raise exception 'ROL_INVALIDO' using errcode = '22023'; end if;
  update campus_users set display_name = coalesce(trim(p_display_name), ''), sector = coalesce(trim(p_sector), ''),
    role = p_role, active = p_active where id = p_user_id returning * into u;
  if not found then raise exception 'NO_EXISTE' using errcode = 'P0002'; end if;
  if not p_active then delete from campus_sessions where user_id = p_user_id; end if;
  return _campus_user_json(u);
end $$;

create or replace function public.campus_admin_reset_password(p_token text, p_user_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _campus_require_admin(p_token);
  perform _campus_check_password(p_password);
  update campus_users set password_hash = crypt(p_password, gen_salt('bf', 10)), must_change_password = true,
    failed_attempts = 0, locked_until = null where id = p_user_id;
  if not found then raise exception 'NO_EXISTE' using errcode = 'P0002'; end if;
  delete from campus_sessions where user_id = p_user_id;
end $$;

create or replace function public.campus_admin_delete_user(p_token text, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a campus_users;
begin
  a := _campus_require_admin(p_token);
  if p_user_id = a.id then raise exception 'NO_AUTO_DEGRADAR' using errcode = '42501'; end if;
  delete from campus_users where id = p_user_id;
end $$;

-- Solo las funciones públicas quedan disponibles para el navegador.
revoke all on function public._campus_hash_token(text), public._campus_session_user(text), public._campus_user_json(public.campus_users),
  public._campus_check_password(text), public._campus_require_admin(text) from public, anon, authenticated;
grant execute on function public.campus_login(text, text), public.campus_logout(text), public.campus_me(text),
  public.campus_change_password(text, text, text), public.campus_get_progress(text), public.campus_save_progress(text, jsonb),
  public.campus_admin_list_users(text), public.campus_admin_create_user(text, text, text, text, text, text),
  public.campus_admin_update_user(text, uuid, text, text, text, boolean), public.campus_admin_reset_password(text, uuid, text),
  public.campus_admin_delete_user(text, uuid) to anon, authenticated;
