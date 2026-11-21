-- =====================================================================
-- EL CÓNDOR | CONTROL DE FRANQUICIAS
-- Migración 0: base de autenticación, archivos y roles de acceso.
-- La aplicación usa la API compatible (netlify/functions/api.mts): cada
-- solicitud se ejecuta con el rol "app_anon" o "app_authenticated" y el usuario en
-- request.jwt.claim.sub, de modo que las políticas Row Level Security
-- se aplican en la base de datos.
-- =====================================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_anon') then
    create role app_anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_authenticated') then
    create role app_authenticated nologin noinherit;
  end if;
end $$;

-- El usuario de la aplicación debe poder adoptar esos roles en cada solicitud (SET ROLE).
do $$
declare
  r text;
  priv text := case when current_setting('server_version_num')::int >= 160000 then 'SET' else 'MEMBER' end;
begin
  foreach r in array array['app_anon', 'app_authenticated'] loop
    if not pg_has_role(current_user, r, priv) then
      execute format('grant %I to %I', r, current_user);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Autenticación
-- ---------------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  encrypted_password text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  banned_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create unique index if not exists users_email_lower on auth.users (lower(email));

create table if not exists auth.refresh_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists refresh_tokens_user on auth.refresh_tokens (user_id);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to app_anon, app_authenticated;
grant execute on function auth.uid() to app_anon, app_authenticated;

-- ---------------------------------------------------------------------
-- Archivos (metadatos; el contenido se guarda en Netlify Blobs)
-- ---------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid default auth.uid(),
  mime_type text,
  size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

grant usage on schema storage to app_anon, app_authenticated;
grant select on storage.buckets to app_anon, app_authenticated;
grant select, insert, update, delete on storage.objects to app_authenticated;
grant select on storage.objects to app_anon;

-- ---------------------------------------------------------------------
-- Privilegios por defecto sobre el esquema público (la seguridad fila por
-- fila la dan las políticas RLS de cada tabla).
-- ---------------------------------------------------------------------
grant usage on schema public to app_anon, app_authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to app_anon, app_authenticated;
alter default privileges in schema public grant usage, select on sequences to app_anon, app_authenticated;
alter default privileges in schema public grant execute on functions to app_anon, app_authenticated;
