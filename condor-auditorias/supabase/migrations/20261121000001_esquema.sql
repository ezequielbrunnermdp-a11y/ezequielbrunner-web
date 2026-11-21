-- =====================================================================
-- EL CÓNDOR | CONTROL DE FRANQUICIAS
-- Migración 1: esquema, funciones de negocio, Row Level Security y Storage
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'auditor', 'franquiciado');
create type public.audit_type as enum ('programada', 'sorpresiva', 'seguimiento');
create type public.audit_status as enum ('borrador', 'finalizada');
create type public.version_status as enum ('borrador', 'publicada', 'archivada');
create type public.question_kind as enum ('puntaje', 'documento');
create type public.doc_status as enum ('verificado', 'pendiente', 'no_cumple');
create type public.severity as enum ('leve', 'moderada', 'grave', 'critica');
create type public.nc_status as enum ('pendiente', 'en_proceso', 'corregido', 'cerrado');
create type public.attribution as enum ('franquicia', 'franquiciante');
create type public.alert_type as enum (
  'riesgo_sanitario', 'alimentos_vencidos', 'temperatura', 'riesgo_electrico_incendio',
  'legal', 'contractual', 'reiteracion', 'accion_vencida', 'control_critico'
);

-- ---------------------------------------------------------------------
-- Usuarios y sucursales
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'franquiciado',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  address text,
  legal_name text,
  manager_name text,
  phone text,
  email text,
  active boolean not null default true,
  assigned_auditor_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Asignación de usuarios (auditores y franquiciados) a sucursales.
create table public.user_branches (
  user_id uuid not null references public.profiles (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

-- ---------------------------------------------------------------------
-- Cuestionarios versionados
-- ---------------------------------------------------------------------
create table public.questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  name text not null default 'Cuestionario integral de auditoría',
  status public.version_status not null default 'borrador',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create unique index one_published_version on public.questionnaire_versions ((status)) where status = 'publicada';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.questionnaire_versions (id) on delete cascade,
  position integer not null,
  code text not null,
  name text not null,
  weight numeric(6, 2) not null check (weight >= 0),
  description text,
  extras text, -- compra_prueba | degustacion | atribucion | caja | indicadores | club
  kind public.question_kind not null default 'puntaje',
  unique (version_id, code)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  position integer not null,
  text text not null,
  guidance text,
  critical_control boolean not null default false,
  active boolean not null default true
);
create index questions_category_idx on public.questions (category_id, position);

-- ---------------------------------------------------------------------
-- Auditorías
-- ---------------------------------------------------------------------
create sequence public.report_number_seq start 1;

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  report_number text unique,
  branch_id uuid not null references public.branches (id) on delete restrict,
  auditor_id uuid not null references public.profiles (id) on delete restrict,
  auditor_name text not null default '',
  version_id uuid not null references public.questionnaire_versions (id) on delete restrict,
  visit_date date not null,
  start_time time,
  manager_present text,
  audit_type public.audit_type not null default 'programada',
  initial_notes text,
  status public.audit_status not null default 'borrador',
  final_score numeric(6, 2),
  classification text,
  has_critical boolean not null default false,
  category_results jsonb,
  weights_redistributed boolean not null default false,
  conclusion text,
  recommendations text,
  receipt_name text,          -- constancia de recepción (firma electrónica simple)
  receipt_at timestamptz,
  revision integer not null default 1,
  correction_reason text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),   -- momento real de creación
  updated_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index audits_branch_idx on public.audits (branch_id, visit_date desc);
create index audits_auditor_idx on public.audits (auditor_id);

create table public.audit_answers (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  score smallint check (score between 0 and 5),
  not_applicable boolean not null default false,
  na_reason text,
  observation text,
  recommendation text,
  is_critical boolean not null default false,
  doc_status public.doc_status,
  doc_expiry date,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique (audit_id, question_id),
  check (not (not_applicable and score is not null))
);

create table public.audit_category_states (
  audit_id uuid not null references public.audits (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  not_applicable boolean not null default false,
  na_reason text,
  extras jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (audit_id, category_id)
);

-- Versiones anteriores de una auditoría corregida.
create table public.audit_revisions (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete restrict,
  revision integer not null,
  reason text not null,
  snapshot jsonb not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (audit_id, revision)
);

-- ---------------------------------------------------------------------
-- Incumplimientos y acciones correctivas
-- ---------------------------------------------------------------------
create table public.nonconformities (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid references public.audits (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  question_id uuid references public.questions (id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  severity public.severity not null,
  alert_type public.alert_type,
  attributable_to public.attribution not null default 'franquicia',
  recommended_action text,
  responsible text,
  due_date date,
  status public.nc_status not null default 'pendiente',
  notes text,
  corrected_at date,
  correction_comment text,
  verified_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nc_branch_idx on public.nonconformities (branch_id, status);
create index nc_audit_idx on public.nonconformities (audit_id);

create table public.nonconformity_events (
  id uuid primary key default gen_random_uuid(),
  nonconformity_id uuid not null references public.nonconformities (id) on delete cascade,
  author_id uuid references public.profiles (id),
  author_name text,
  from_status public.nc_status,
  to_status public.nc_status,
  comment text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Archivos (fotografías y documentos en Storage privado)
-- ---------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  audit_id uuid references public.audits (id) on delete restrict,
  question_id uuid references public.questions (id) on delete restrict,
  nonconformity_id uuid references public.nonconformities (id) on delete restrict,
  kind text not null default 'foto' check (kind in ('foto', 'documento', 'evidencia_correccion')),
  storage_path text not null unique,
  file_name text,
  mime_type text,
  caption text,
  uploaded_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index attachments_audit_idx on public.attachments (audit_id);
create index attachments_nc_idx on public.attachments (nonconformity_id);

-- ---------------------------------------------------------------------
-- Alertas y notificaciones
-- ---------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  audit_id uuid references public.audits (id) on delete restrict,
  nonconformity_id uuid references public.nonconformities (id) on delete restrict,
  question_id uuid references public.questions (id) on delete restrict,
  type public.alert_type not null,
  severity public.severity not null default 'critica',
  title text not null,
  detail text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  resolution_note text
);
create index alerts_open_idx on public.alerts (branch_id) where resolved_at is null;
create unique index alerts_overdue_once on public.alerts (nonconformity_id, type) where type = 'accion_vencida';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  alert_id uuid references public.alerts (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Informes, configuración, indicadores, manual y registro de operaciones
-- ---------------------------------------------------------------------
create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  audit_id uuid references public.audits (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  params jsonb not null default '{}'::jsonb,
  file_name text,
  generated_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.brand_settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'EL CÓNDOR COFFEE SHOP',
  platform_name text not null default 'EL CÓNDOR | CONTROL DE FRANQUICIAS',
  subtitle text not null default 'Sistema Integral de Auditorías y Calidad Operativa',
  logo_path text,
  color_primary text not null default '#2e2016' check (color_primary ~ '^#[0-9a-fA-F]{6}$'),
  color_accent text not null default '#b08d3e' check (color_accent ~ '^#[0-9a-fA-F]{6}$'),
  color_background text not null default '#f7f1e7' check (color_background ~ '^#[0-9a-fA-F]{6}$'),
  receipt_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
insert into public.brand_settings (id) values (1);

create table public.commercial_indicators (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  period date not null check (extract(day from period) = 1),
  sales numeric(14, 2),
  tickets integer check (tickets >= 0),
  avg_ticket numeric(14, 2) generated always as (case when tickets > 0 then round(sales / tickets, 2) end) stored,
  cmv numeric(14, 2),
  factory_purchases numeric(14, 2),
  waste_units numeric(12, 2),
  waste_value numeric(14, 2),
  top_products text,
  discounts numeric(14, 2),
  credit_notes numeric(14, 2),
  voids numeric(14, 2),
  internal_consumption numeric(14, 2),
  source text not null default 'manual' check (source in ('manual', 'importacion', 'integracion')),
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, period)
);

create table public.manual_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  version_label text,
  storage_path text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid default auth.uid(),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Funciones auxiliares de seguridad (security definer: evitan recursión RLS)
-- =====================================================================
create or replace function public.current_role_name()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin')
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role in ('admin', 'auditor'))
$$;

create or replace function public.has_branch(p_branch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.user_branches ub
    join public.profiles p on p.id = ub.user_id and p.active
    where ub.user_id = auth.uid() and ub.branch_id = p_branch
  ) or exists (
    select 1 from public.branches b join public.profiles p on p.id = auth.uid() and p.active and p.role = 'auditor'
    where b.id = p_branch and b.assigned_auditor_id = auth.uid()
  )
$$;

-- Puede ver una auditoría: staff con acceso a la sucursal; franquiciado solo finalizadas.
create or replace function public.can_view_audit(p_audit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.audits a
    where a.id = p_audit and public.has_branch(a.branch_id)
      and (public.is_staff() or a.status = 'finalizada')
  )
$$;

-- Puede editar una auditoría: borrador y (auditor responsable o administrador).
create or replace function public.can_edit_audit(p_audit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.audits a
    where a.id = p_audit and a.status = 'borrador'
      and (public.is_admin() or (a.auditor_id = auth.uid() and public.current_role_name() = 'auditor' and public.has_branch(a.branch_id)))
  )
$$;

create or replace function public.can_view_nc(p_nc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.nonconformities n
    left join public.audits a on a.id = n.audit_id
    where n.id = p_nc and public.has_branch(n.branch_id)
      and (public.is_staff() or a.id is null or a.status = 'finalizada')
  )
$$;

create or replace function public.log_activity(p_action text, p_entity text, p_entity_id text, p_details jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details)
$$;

-- =====================================================================
-- Triggers genéricos
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger branches_touch before update on public.branches for each row execute function public.touch_updated_at();
create trigger audits_touch before update on public.audits for each row execute function public.touch_updated_at();
create trigger answers_touch before update on public.audit_answers for each row execute function public.touch_updated_at();
create trigger catstates_touch before update on public.audit_category_states for each row execute function public.touch_updated_at();
create trigger nc_touch before update on public.nonconformities for each row execute function public.touch_updated_at();
create trigger indicators_touch before update on public.commercial_indicators for each row execute function public.touch_updated_at();

-- Perfil automático al crear un usuario de Auth.
-- El rol se toma SOLO de app_metadata (lo define el servidor con la clave de servicio),
-- nunca de user_metadata (editable por el propio usuario).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  begin
    v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'franquiciado');
  exception when others then
    v_role := 'franquiciado';
  end;
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_app_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'full_name', ''),
    v_role,
    coalesce((new.raw_app_meta_data ->> 'active')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un usuario no puede cambiar su propio rol ni activarse.
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role <> old.role or new.active <> old.active or new.email <> old.email then
      raise exception 'No autorizado para modificar rol, estado o correo';
    end if;
  end if;
  if auth.uid() = old.id and old.role = 'admin' and (new.role <> 'admin' or not new.active) then
    raise exception 'Un administrador no puede quitarse a sí mismo el rol ni desactivarse';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- Los cuestionarios publicados o archivados no se modifican (las auditorías los referencian).
create or replace function public.protect_published_questionnaire()
returns trigger language plpgsql as $$
declare
  v_status public.version_status;
  v_version uuid;
begin
  if tg_table_name = 'categories' then
    v_version := coalesce(new.version_id, old.version_id);
  else
    select c.version_id into v_version from public.categories c where c.id = coalesce(new.category_id, old.category_id);
  end if;
  select status into v_status from public.questionnaire_versions where id = v_version;
  if v_status is not null and v_status <> 'borrador' and current_setting('app.seeding', true) is distinct from 'on' then
    raise exception 'La versión % del cuestionario no es un borrador: cree una nueva versión para modificarla', v_version;
  end if;
  return coalesce(new, old);
end $$;
create trigger categories_protect before insert or update or delete on public.categories
  for each row execute function public.protect_published_questionnaire();
create trigger questions_protect before insert or update or delete on public.questions
  for each row execute function public.protect_published_questionnaire();

-- Una auditoría finalizada solo cambia por procedimiento autorizado (funciones de corrección).
create or replace function public.protect_finalized_audit()
returns trigger language plpgsql as $$
begin
  if current_setting('app.audit_procedure', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'audits' then
    if tg_op = 'DELETE' then
      if old.status = 'finalizada' then raise exception 'Una auditoría finalizada no puede eliminarse'; end if;
      return old;
    end if;
    if old.status = 'finalizada' then
      -- se permite únicamente registrar la constancia de recepción
      if (to_jsonb(new) - 'receipt_name' - 'receipt_at' - 'updated_at') <> (to_jsonb(old) - 'receipt_name' - 'receipt_at' - 'updated_at') then
        raise exception 'La auditoría está finalizada. Use el procedimiento de corrección autorizada.';
      end if;
    elsif new.status = 'finalizada' then
      raise exception 'La finalización se realiza mediante la función finalize_audit';
    elsif new.branch_id <> old.branch_id or new.version_id <> old.version_id or (new.auditor_id <> old.auditor_id and not public.is_admin()) then
      raise exception 'No puede cambiarse la sucursal, versión o auditor de la auditoría';
    end if;
    return new;
  else
    if exists (select 1 from public.audits a where a.id = coalesce(new.audit_id, old.audit_id) and a.status = 'finalizada') then
      raise exception 'La auditoría está finalizada. Use el procedimiento de corrección autorizada.';
    end if;
    return coalesce(new, old);
  end if;
end $$;
create trigger audits_protect before update or delete on public.audits for each row execute function public.protect_finalized_audit();
create trigger answers_protect before insert or update or delete on public.audit_answers for each row execute function public.protect_finalized_audit();
create trigger catstates_protect before insert or update or delete on public.audit_category_states for each row execute function public.protect_finalized_audit();

-- Al crear una auditoría: versión publicada, nombre del auditor y validaciones.
create or replace function public.prepare_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_branch_active boolean;
begin
  select active into v_branch_active from public.branches where id = new.branch_id;
  if not coalesce(v_branch_active, false) then
    raise exception 'La sucursal está inactiva o no existe';
  end if;
  if new.version_id is null then
    select id into new.version_id from public.questionnaire_versions where status = 'publicada';
  elsif not exists (select 1 from public.questionnaire_versions where id = new.version_id and status = 'publicada') then
    raise exception 'Solo puede auditarse con la versión publicada del cuestionario';
  end if;
  if new.version_id is null then
    raise exception 'No hay una versión publicada del cuestionario';
  end if;
  new.status := 'borrador';
  new.final_score := null;
  new.report_number := null;
  new.created_at := now();
  select coalesce(nullif(full_name, ''), email) into new.auditor_name from public.profiles where id = new.auditor_id;
  return new;
end $$;
create trigger audits_prepare before insert on public.audits for each row execute function public.prepare_audit();

-- Historial de incumplimientos + reglas de cambio de estado.
create or replace function public.nonconformity_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    insert into public.nonconformity_events (nonconformity_id, author_id, author_name, to_status, comment)
    values (new.id, auth.uid(), v_name, new.status, 'Incumplimiento registrado');
    if new.severity = 'critica' then
      insert into public.alerts (branch_id, audit_id, nonconformity_id, question_id, type, severity, title, detail)
      values (new.branch_id, new.audit_id, new.id, new.question_id, coalesce(new.alert_type, 'control_critico'), 'critica',
              'Incumplimiento crítico registrado', new.description);
    end if;
    return new;
  end if;

  if new.status = 'cerrado' and old.status <> 'cerrado' then
    if not public.is_staff() then
      raise exception 'Solo un auditor o administrador puede verificar y cerrar un incumplimiento';
    end if;
    new.closed_at := now();
    new.verified_by := auth.uid();
  end if;
  if old.status = 'cerrado' and new.status <> 'cerrado' and not public.is_admin() then
    raise exception 'Solo un administrador puede reabrir un incumplimiento cerrado';
  end if;
  if new.status = 'corregido' and new.corrected_at is null then
    new.corrected_at := current_date;
  end if;
  if new.status is distinct from old.status then
    insert into public.nonconformity_events (nonconformity_id, author_id, author_name, from_status, to_status, comment)
    values (new.id, auth.uid(), v_name, old.status, new.status, coalesce(new.correction_comment, null));
    if new.status = 'cerrado' then
      update public.alerts set resolved_at = now(), resolved_by = auth.uid(), resolution_note = 'Incumplimiento verificado y cerrado'
      where nonconformity_id = new.id and resolved_at is null;
    end if;
  end if;
  return new;
end $$;
create trigger nc_guard_ins after insert on public.nonconformities for each row execute function public.nonconformity_guard();
create trigger nc_guard_upd before update on public.nonconformities for each row execute function public.nonconformity_guard();

-- Notificaciones dentro de la plataforma cuando se genera una alerta.
create or replace function public.notify_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_branch text;
begin
  select name into v_branch from public.branches where id = new.branch_id;
  insert into public.notifications (user_id, alert_id, title, body, link)
  select distinct p.id, new.id, 'Alerta · ' || v_branch || ': ' || new.title, new.detail, '/alertas'
  from public.profiles p
  where p.active and (
    p.role = 'admin'
    or exists (select 1 from public.user_branches ub where ub.user_id = p.id and ub.branch_id = new.branch_id)
    or exists (select 1 from public.branches b where b.id = new.branch_id and b.assigned_auditor_id = p.id)
  )
  -- el franquiciado recibe la alerta cuando la auditoría está finalizada
  and (p.role <> 'franquiciado' or new.audit_id is null
       or exists (select 1 from public.audits a where a.id = new.audit_id and a.status = 'finalizada'));
  return new;
end $$;
create trigger alerts_notify after insert on public.alerts for each row execute function public.notify_alert();

-- =====================================================================
-- Cálculo de puntaje (fuente de verdad en el servidor)
--   Puntaje de categoría = peso × (puntos obtenidos / puntos máximos aplicables)
--   Las categorías no aplicables se excluyen y su peso se redistribuye proporcionalmente.
-- =====================================================================
create or replace function public.classification_for(p_score numeric)
returns text language sql immutable as $$
  select case
    when p_score is null then null
    when p_score >= 90 then 'EXCELENTE'
    when p_score >= 80 then 'SATISFACTORIA'
    when p_score >= 70 then 'EN OBSERVACIÓN'
    else 'DEFICIENTE' end
$$;

create or replace function public.compute_audit_score(p_audit uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_version uuid;
  v_total_weight numeric := 0;
  v_applicable_weight numeric := 0;
  v_final numeric := 0;
  v_pending integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_cats jsonb := '[]'::jsonb;
  r record;
begin
  select version_id into v_version from public.audits where id = p_audit;
  if v_version is null then raise exception 'Auditoría inexistente'; end if;

  for r in
    select c.id, c.code, c.name, c.weight, c.position,
           coalesce(s.not_applicable, false) as cat_na, s.na_reason as cat_na_reason,
           count(q.id) as total_q,
           count(q.id) filter (where a.score is not null and not a.not_applicable) as scored,
           count(q.id) filter (where a.not_applicable) as na_q,
           count(q.id) filter (where a.not_applicable and coalesce(trim(a.na_reason), '') = '') as na_unjustified,
           count(q.id) filter (where a.score is not null and a.score <= 2 and coalesce(trim(a.observation), '') = '') as obs_missing,
           count(q.id) filter (where a.id is null or (a.score is null and not a.not_applicable)) as pending,
           coalesce(sum(a.score) filter (where not a.not_applicable), 0) as obtained,
           count(q.id) filter (where a.is_critical) as criticals
    from public.categories c
    join public.questions q on q.category_id = c.id and q.active
    left join public.audit_answers a on a.question_id = q.id and a.audit_id = p_audit
    left join public.audit_category_states s on s.category_id = c.id and s.audit_id = p_audit
    where c.version_id = v_version
    group by c.id, s.not_applicable, s.na_reason
    order by c.position
  loop
    v_total_weight := v_total_weight + r.weight;
    if r.cat_na then
      if coalesce(trim(r.cat_na_reason), '') = '' then
        v_errors := v_errors || jsonb_build_object('category', r.name, 'error', 'Falta justificar por qué la categoría no aplica');
      end if;
      v_cats := v_cats || jsonb_build_object('category_id', r.id, 'code', r.code, 'name', r.name, 'weight', r.weight,
        'applicable', false, 'na_reason', r.cat_na_reason, 'obtained', 0, 'max', 0, 'pct', null, 'criticals', r.criticals);
      continue;
    end if;
    v_pending := v_pending + r.pending;
    if r.pending > 0 then
      v_errors := v_errors || jsonb_build_object('category', r.name, 'error', r.pending || ' pregunta(s) pendiente(s)');
    end if;
    if r.na_unjustified > 0 then
      v_errors := v_errors || jsonb_build_object('category', r.name, 'error', r.na_unjustified || ' "No aplica" sin justificar');
    end if;
    if r.obs_missing > 0 then
      v_errors := v_errors || jsonb_build_object('category', r.name, 'error', r.obs_missing || ' puntaje(s) de 0 a 2 sin observación');
    end if;
    if r.scored = 0 and r.pending = 0 then
      v_errors := v_errors || jsonb_build_object('category', r.name, 'error', 'Todas las preguntas son "No aplica": marque la categoría completa como no aplicable y justifique');
    end if;
    if r.scored > 0 then
      v_applicable_weight := v_applicable_weight + r.weight;
    end if;
    v_cats := v_cats || jsonb_build_object('category_id', r.id, 'code', r.code, 'name', r.name, 'weight', r.weight,
      'applicable', r.scored > 0, 'obtained', r.obtained, 'max', r.scored * 5,
      'pct', case when r.scored > 0 then round(r.obtained::numeric / (r.scored * 5) * 100, 2) end,
      'criticals', r.criticals, 'na_questions', r.na_q);
  end loop;

  -- puntaje ponderado (con redistribución)
  select coalesce(jsonb_agg(
    case when (c ->> 'applicable')::boolean and v_applicable_weight > 0 then
      c || jsonb_build_object(
        'effective_weight', round((c ->> 'weight')::numeric * v_total_weight / v_applicable_weight, 4),
        'score', round((c ->> 'weight')::numeric * v_total_weight / v_applicable_weight * (c ->> 'obtained')::numeric / (c ->> 'max')::numeric * 100 / nullif(v_total_weight, 0), 4))
    else c || jsonb_build_object('effective_weight', 0, 'score', null) end), '[]'::jsonb)
  into v_cats from jsonb_array_elements(v_cats) c;

  select coalesce(sum((c ->> 'score')::numeric), 0) into v_final from jsonb_array_elements(v_cats) c where c ->> 'score' is not null;

  return jsonb_build_object(
    'final_score', case when v_applicable_weight > 0 then round(v_final, 2) end,
    'classification', public.classification_for(case when v_applicable_weight > 0 then round(v_final, 2) end),
    'total_weight', v_total_weight,
    'applicable_weight', v_applicable_weight,
    'redistributed', v_applicable_weight < v_total_weight,
    'pending', v_pending,
    'errors', v_errors,
    'categories', v_cats);
end $$;

-- Finalizar auditoría: valida, calcula en el servidor, numera, genera alertas.
create or replace function public.finalize_audit(p_audit uuid, p_conclusion text default null, p_recommendations text default null)
returns public.audits language plpgsql security definer set search_path = public as $$
declare
  v_audit public.audits;
  v_result jsonb;
  v_has_critical boolean;
  v_prev uuid;
  r record;
begin
  if not public.can_edit_audit(p_audit) then
    raise exception 'No autorizado para finalizar esta auditoría';
  end if;
  select * into v_audit from public.audits where id = p_audit for update;
  v_result := public.compute_audit_score(p_audit);
  if jsonb_array_length(v_result -> 'errors') > 0 then
    raise exception 'La auditoría no puede finalizarse: %', (select string_agg((e ->> 'category') || ': ' || (e ->> 'error'), '; ') from jsonb_array_elements(v_result -> 'errors') e);
  end if;
  if v_result ->> 'final_score' is null then
    raise exception 'No hay controles aplicables para calcular un resultado';
  end if;

  v_has_critical := exists (select 1 from public.audit_answers where audit_id = p_audit and is_critical)
    or exists (select 1 from public.nonconformities where audit_id = p_audit and severity = 'critica');

  perform set_config('app.audit_procedure', 'on', true);
  update public.audits set
    status = 'finalizada',
    final_score = (v_result ->> 'final_score')::numeric,
    classification = v_result ->> 'classification',
    category_results = v_result,
    weights_redistributed = (v_result ->> 'redistributed')::boolean,
    has_critical = v_has_critical,
    conclusion = coalesce(p_conclusion, conclusion),
    recommendations = coalesce(p_recommendations, recommendations),
    finalized_at = now(),
    report_number = coalesce(report_number, 'EC-' || to_char(visit_date, 'YYYY') || '-' || lpad(nextval('public.report_number_seq')::text, 5, '0'))
  where id = p_audit
  returning * into v_audit;
  perform set_config('app.audit_procedure', 'off', true);

  -- Alertas por controles marcados como críticos (independientes del puntaje).
  insert into public.alerts (branch_id, audit_id, question_id, type, severity, title, detail)
  select v_audit.branch_id, p_audit, a.question_id,
    case c.code
      when 'higiene_bromatologia' then 'riesgo_sanitario'::public.alert_type
      when 'mantenimiento' then 'riesgo_electrico_incendio'::public.alert_type
      when 'documentacion_legal' then 'legal'::public.alert_type
      when 'contrato_franquicia' then 'contractual'::public.alert_type
      else 'control_critico'::public.alert_type end,
    'critica', 'Control crítico: ' || q.text, a.observation
  from public.audit_answers a
  join public.questions q on q.id = a.question_id
  join public.categories c on c.id = q.category_id
  where a.audit_id = p_audit and a.is_critical
    and not exists (select 1 from public.alerts x where x.audit_id = p_audit and x.question_id = a.question_id and x.type <> 'reiteracion');

  -- Reiteración de faltas: misma pregunta (por texto) con incumplimiento en la auditoría anterior.
  select id into v_prev from public.audits
  where branch_id = v_audit.branch_id and status = 'finalizada' and id <> p_audit
    and (visit_date, created_at) < (v_audit.visit_date, v_audit.created_at)
  order by visit_date desc, created_at desc limit 1;
  if v_prev is not null then
    for r in
      select distinct q.id as qid, q.text
      from public.audit_answers a join public.questions q on q.id = a.question_id
      where a.audit_id = p_audit and not a.not_applicable and a.score <= 2
        and exists (
          select 1 from public.audit_answers pa join public.questions pq on pq.id = pa.question_id
          where pa.audit_id = v_prev and pq.text = q.text and not pa.not_applicable and pa.score <= 2)
    loop
      insert into public.alerts (branch_id, audit_id, question_id, type, severity, title, detail)
      select v_audit.branch_id, p_audit, r.qid, 'reiteracion', 'grave', 'Falta reiterada: ' || r.text,
              'El control fue calificado con 2 puntos o menos en la auditoría anterior y en la actual.'
      where not exists (select 1 from public.alerts x where x.audit_id = p_audit and x.question_id = r.qid and x.type = 'reiteracion');
    end loop;
  end if;

  -- Notificar al franquiciado alertas críticas registradas durante el borrador.
  insert into public.notifications (user_id, alert_id, title, body, link)
  select ub.user_id, al.id, 'Alerta en su sucursal: ' || al.title, al.detail, '/alertas'
  from public.alerts al
  join public.user_branches ub on ub.branch_id = al.branch_id
  join public.profiles p on p.id = ub.user_id and p.role = 'franquiciado' and p.active
  where al.audit_id = p_audit and al.type <> 'reiteracion'
    and al.created_at < v_audit.finalized_at
    and not exists (select 1 from public.notifications n where n.alert_id = al.id and n.user_id = ub.user_id);

  perform public.log_activity('finalizar', 'auditoria', p_audit::text,
    jsonb_build_object('puntaje', v_audit.final_score, 'informe', v_audit.report_number, 'revision', v_audit.revision));
  return v_audit;
end $$;

-- Corrección autorizada de una auditoría finalizada (solo administración).
-- Conserva la versión anterior completa y registra el motivo.
create or replace function public.begin_audit_correction(p_audit uuid, p_reason text)
returns public.audits language plpgsql security definer set search_path = public as $$
declare
  v_audit public.audits;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo la administración puede autorizar la corrección de una auditoría finalizada';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Debe indicar el motivo de la corrección';
  end if;
  select * into v_audit from public.audits where id = p_audit for update;
  if v_audit.status <> 'finalizada' then
    raise exception 'La auditoría no está finalizada';
  end if;
  v_snapshot := jsonb_build_object(
    'audit', to_jsonb(v_audit),
    'answers', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.audit_answers a where a.audit_id = p_audit),
    'category_states', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.audit_category_states s where s.audit_id = p_audit));
  insert into public.audit_revisions (audit_id, revision, reason, snapshot)
  values (p_audit, v_audit.revision, p_reason, v_snapshot);

  perform set_config('app.audit_procedure', 'on', true);
  update public.audits set status = 'borrador', revision = revision + 1, correction_reason = p_reason,
    receipt_name = null, receipt_at = null
  where id = p_audit returning * into v_audit;
  perform set_config('app.audit_procedure', 'off', true);

  perform public.log_activity('corregir', 'auditoria', p_audit::text, jsonb_build_object('motivo', p_reason, 'revision_anterior', v_audit.revision - 1));
  return v_audit;
end $$;

-- Constancia de recepción (firma electrónica simple; no es firma digital certificada).
create or replace function public.acknowledge_audit(p_audit uuid, p_name text)
returns public.audits language plpgsql security definer set search_path = public as $$
declare v_audit public.audits;
begin
  if not public.can_view_audit(p_audit) then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Indique nombre y apellido'; end if;
  update public.audits set receipt_name = trim(p_name), receipt_at = now()
  where id = p_audit and status = 'finalizada' returning * into v_audit;
  if v_audit.id is null then raise exception 'La auditoría no está finalizada'; end if;
  perform public.log_activity('constancia_recepcion', 'auditoria', p_audit::text, jsonb_build_object('nombre', p_name));
  return v_audit;
end $$;

-- Acción del franquiciado sobre un incumplimiento: solo estado (en proceso / corregido) y comentario.
create or replace function public.franchisee_update_nc(p_nc uuid, p_status public.nc_status, p_comment text, p_corrected_at date default null)
returns public.nonconformities language plpgsql security definer set search_path = public as $$
declare v_nc public.nonconformities;
begin
  if not public.can_view_nc(p_nc) then raise exception 'No autorizado'; end if;
  if p_status not in ('en_proceso', 'corregido') then
    raise exception 'El franquiciado solo puede informar "en proceso" o "corregido, pendiente de verificación"';
  end if;
  select * into v_nc from public.nonconformities where id = p_nc;
  if v_nc.status = 'cerrado' then raise exception 'El incumplimiento ya fue verificado y cerrado'; end if;
  update public.nonconformities set status = p_status, correction_comment = p_comment,
    corrected_at = case when p_status = 'corregido' then coalesce(p_corrected_at, current_date) else corrected_at end
  where id = p_nc returning * into v_nc;
  return v_nc;
end $$;

-- Genera alertas para acciones correctivas vencidas (se invoca al abrir el panel).
create or replace function public.refresh_overdue_alerts()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if auth.uid() is null or public.current_role_name() is null then return 0; end if;
  insert into public.alerts (branch_id, audit_id, nonconformity_id, question_id, type, severity, title, detail)
  select n.branch_id, n.audit_id, n.id, n.question_id, 'accion_vencida', n.severity,
         'Acción correctiva vencida', n.description || ' · Fecha límite: ' || to_char(n.due_date, 'DD/MM/YYYY')
  from public.nonconformities n
  left join public.audits a on a.id = n.audit_id
  where n.due_date < current_date and n.status in ('pendiente', 'en_proceso')
    and (a.id is null or a.status = 'finalizada')
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Clonar la versión publicada como nuevo borrador editable.
create or replace function public.clone_questionnaire_version(p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_source uuid := p_source;
  v_new uuid;
  v_number integer;
  c record;
  v_cat uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if exists (select 1 from public.questionnaire_versions where status = 'borrador') then
    raise exception 'Ya existe una versión en borrador. Publíquela o elimínela antes de crear otra.';
  end if;
  if v_source is null then
    select id into v_source from public.questionnaire_versions where status = 'publicada';
  end if;
  select coalesce(max(number), 0) + 1 into v_number from public.questionnaire_versions;
  insert into public.questionnaire_versions (number, name, status, created_by, notes)
  select v_number, name, 'borrador', auth.uid(), 'Basada en la versión ' || number from public.questionnaire_versions where id = v_source
  returning id into v_new;
  for c in select * from public.categories where version_id = v_source order by position loop
    insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
    values (v_new, c.position, c.code, c.name, c.weight, c.description, c.extras, c.kind) returning id into v_cat;
    insert into public.questions (category_id, position, text, guidance, critical_control, active)
    select v_cat, position, text, guidance, critical_control, active from public.questions where category_id = c.id and active;
  end loop;
  perform public.log_activity('crear_version', 'cuestionario', v_new::text, jsonb_build_object('numero', v_number));
  return v_new;
end $$;

create or replace function public.publish_questionnaire_version(p_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_weight numeric;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select coalesce(sum(weight), 0) into v_weight from public.categories where version_id = p_version;
  if v_weight <> 100 then
    raise exception 'Las ponderaciones deben sumar 100 (suman %)', v_weight;
  end if;
  if exists (select 1 from public.categories c where c.version_id = p_version
             and not exists (select 1 from public.questions q where q.category_id = c.id and q.active)) then
    raise exception 'Todas las categorías deben tener al menos una pregunta activa';
  end if;
  update public.questionnaire_versions set status = 'archivada' where status = 'publicada';
  update public.questionnaire_versions set status = 'publicada', published_at = now() where id = p_version and status = 'borrador';
  if not found then raise exception 'La versión no es un borrador'; end if;
  perform public.log_activity('publicar_version', 'cuestionario', p_version::text, null);
end $$;

-- Ficha de sucursales con indicadores (respeta permisos del usuario).
create or replace view public.branch_overview with (security_invoker = true) as
select b.*,
  (select max(a.visit_date) from public.audits a where a.branch_id = b.id and a.status = 'finalizada') as last_audit_date,
  (select a.final_score from public.audits a where a.branch_id = b.id and a.status = 'finalizada' order by a.visit_date desc, a.created_at desc limit 1) as last_score,
  (select round(avg(a.final_score), 2) from public.audits a where a.branch_id = b.id and a.status = 'finalizada') as avg_score,
  (select count(*) from public.audits a where a.branch_id = b.id and a.status = 'finalizada') as audits_count,
  (select count(*) from public.nonconformities n where n.branch_id = b.id and n.status <> 'cerrado') as open_nc
from public.branches b;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.user_branches enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.audits enable row level security;
alter table public.audit_answers enable row level security;
alter table public.audit_category_states enable row level security;
alter table public.audit_revisions enable row level security;
alter table public.nonconformities enable row level security;
alter table public.nonconformity_events enable row level security;
alter table public.attachments enable row level security;
alter table public.alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.generated_reports enable row level security;
alter table public.brand_settings enable row level security;
alter table public.commercial_indicators enable row level security;
alter table public.manual_documents enable row level security;
alter table public.activity_log enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- branches
create policy branches_select on public.branches for select to authenticated using (public.has_branch(id));
create policy branches_admin_insert on public.branches for insert to authenticated with check (public.is_admin());
create policy branches_admin_update on public.branches for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_branches
create policy ub_select on public.user_branches for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ub_admin_insert on public.user_branches for insert to authenticated with check (public.is_admin());
create policy ub_admin_delete on public.user_branches for delete to authenticated using (public.is_admin());

-- cuestionarios: lectura para usuarios activos; escritura solo admin (y solo borradores, por trigger)
create policy qv_select on public.questionnaire_versions for select to authenticated using (public.current_role_name() is not null);
create policy qv_admin_write on public.questionnaire_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cat_select on public.categories for select to authenticated using (public.current_role_name() is not null);
create policy cat_admin_write on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy q_select on public.questions for select to authenticated using (public.current_role_name() is not null);
create policy q_admin_write on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- audits
-- Se evalúan las columnas de la fila (no una búsqueda por id) para que INSERT ... RETURNING funcione.
create policy audits_select on public.audits for select to authenticated using (
  public.has_branch(branch_id) and (public.is_staff() or status = 'finalizada'));
create policy audits_insert on public.audits for insert to authenticated with check (
  public.is_staff() and public.has_branch(branch_id)
  and (auditor_id = auth.uid() or public.is_admin()) and status = 'borrador');
create policy audits_update on public.audits for update to authenticated
  using (public.can_edit_audit(id)) with check (public.has_branch(branch_id));
create policy audits_delete on public.audits for delete to authenticated using (public.is_admin() and status = 'borrador');

-- answers / category states
create policy answers_select on public.audit_answers for select to authenticated using (public.can_view_audit(audit_id));
create policy answers_write on public.audit_answers for insert to authenticated with check (public.can_edit_audit(audit_id));
create policy answers_update on public.audit_answers for update to authenticated using (public.can_edit_audit(audit_id)) with check (public.can_edit_audit(audit_id));
create policy answers_delete on public.audit_answers for delete to authenticated using (public.can_edit_audit(audit_id));
create policy cs_select on public.audit_category_states for select to authenticated using (public.can_view_audit(audit_id));
create policy cs_insert on public.audit_category_states for insert to authenticated with check (public.can_edit_audit(audit_id));
create policy cs_update on public.audit_category_states for update to authenticated using (public.can_edit_audit(audit_id)) with check (public.can_edit_audit(audit_id));

create policy revisions_select on public.audit_revisions for select to authenticated using (public.is_staff() and public.can_view_audit(audit_id));

-- nonconformities: staff crea/edita; franquiciado usa franchisee_update_nc
create policy nc_select on public.nonconformities for select to authenticated using (
  public.has_branch(branch_id) and (public.is_staff() or audit_id is null or public.can_view_audit(audit_id)));
create policy nc_insert on public.nonconformities for insert to authenticated with check (
  public.is_staff() and public.has_branch(branch_id)
  and (audit_id is null or public.can_edit_audit(audit_id) or public.is_admin()));
create policy nc_update on public.nonconformities for update to authenticated
  using (public.is_staff() and public.has_branch(branch_id)) with check (public.is_staff() and public.has_branch(branch_id));

create policy nce_select on public.nonconformity_events for select to authenticated using (public.can_view_nc(nonconformity_id));
create policy nce_insert on public.nonconformity_events for insert to authenticated with check (
  public.can_view_nc(nonconformity_id) and author_id = auth.uid());

-- attachments
create policy att_select on public.attachments for select to authenticated using (
  public.has_branch(branch_id)
  and (audit_id is null or public.can_view_audit(audit_id))
  and (nonconformity_id is null or public.can_view_nc(nonconformity_id)));
create policy att_insert on public.attachments for insert to authenticated with check (
  uploaded_by = auth.uid() and public.has_branch(branch_id) and (
    (audit_id is not null and nonconformity_id is null and public.can_edit_audit(audit_id))
    or (nonconformity_id is not null and public.can_view_nc(nonconformity_id))
    or (audit_id is null and nonconformity_id is null and public.is_staff())));
create policy att_delete on public.attachments for delete to authenticated using (
  (uploaded_by = auth.uid() or public.is_admin())
  and (audit_id is null or public.can_edit_audit(audit_id))
  and (nonconformity_id is null or (uploaded_by = auth.uid() and exists (select 1 from public.nonconformities n where n.id = nonconformity_id and n.status <> 'cerrado'))));

-- alerts / notifications
create policy alerts_select on public.alerts for select to authenticated using (
  public.has_branch(branch_id) and (audit_id is null or public.can_view_audit(audit_id)));
create policy alerts_update on public.alerts for update to authenticated using (public.is_staff() and public.has_branch(branch_id)) with check (public.is_staff());
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports log
create policy reports_select on public.generated_reports for select to authenticated using (generated_by = auth.uid() or public.is_admin());
create policy reports_insert on public.generated_reports for insert to authenticated with check (generated_by = auth.uid());

-- brand settings: lectura pública (pantalla de ingreso), escritura admin
create policy brand_select on public.brand_settings for select to anon, authenticated using (true);
create policy brand_update on public.brand_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- commercial indicators
create policy ci_select on public.commercial_indicators for select to authenticated using (public.has_branch(branch_id));
create policy ci_insert on public.commercial_indicators for insert to authenticated with check (public.is_admin() or (public.is_staff() and public.has_branch(branch_id)));
create policy ci_update on public.commercial_indicators for update to authenticated using (public.is_admin() or (public.is_staff() and public.has_branch(branch_id))) with check (public.has_branch(branch_id));
create policy ci_delete on public.commercial_indicators for delete to authenticated using (public.is_admin());

-- manual
create policy manual_select on public.manual_documents for select to authenticated using (public.current_role_name() is not null and (active or public.is_admin()));
create policy manual_admin on public.manual_documents for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- activity log: solo lectura admin; se escribe con log_activity
create policy activity_select on public.activity_log for select to authenticated using (public.is_admin());

-- Permisos de ejecución de funciones
revoke all on function public.finalize_audit(uuid, text, text) from public, anon;
revoke all on function public.begin_audit_correction(uuid, text) from public, anon;
revoke all on function public.acknowledge_audit(uuid, text) from public, anon;
revoke all on function public.franchisee_update_nc(uuid, public.nc_status, text, date) from public, anon;
revoke all on function public.refresh_overdue_alerts() from public, anon;
revoke all on function public.clone_questionnaire_version(uuid) from public, anon;
revoke all on function public.publish_questionnaire_version(uuid) from public, anon;
revoke all on function public.compute_audit_score(uuid) from public, anon;
revoke all on function public.log_activity(text, text, text, jsonb) from public, anon;
grant execute on function public.finalize_audit(uuid, text, text) to authenticated;
grant execute on function public.begin_audit_correction(uuid, text) to authenticated;
grant execute on function public.acknowledge_audit(uuid, text) to authenticated;
grant execute on function public.franchisee_update_nc(uuid, public.nc_status, text, date) to authenticated;
grant execute on function public.refresh_overdue_alerts() to authenticated;
grant execute on function public.clone_questionnaire_version(uuid) to authenticated;
grant execute on function public.publish_questionnaire_version(uuid) to authenticated;
grant execute on function public.log_activity(text, text, text, jsonb) to authenticated;

-- compute_audit_score: solo para quien puede ver la auditoría
create or replace function public.preview_audit_score(p_audit uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_view_audit(p_audit) then raise exception 'No autorizado'; end if;
  return public.compute_audit_score(p_audit);
end $$;
revoke all on function public.preview_audit_score(uuid) from public, anon;
grant execute on function public.preview_audit_score(uuid) to authenticated;

-- =====================================================================
-- Storage: buckets privados de evidencias y documentos; logotipo público
-- Ruta de evidencias: {branch_id}/{audit_id|nc}/{archivo}
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias', 'evidencias', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('manual', 'manual', false, 31457280, array['application/pdf', 'image/jpeg', 'image/png']),
  ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.storage_branch_from_path(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy evid_select on storage.objects for select to authenticated using (
  bucket_id = 'evidencias' and exists (
    select 1 from public.attachments t where t.storage_path = name
      and public.has_branch(t.branch_id)
      and (t.audit_id is null or public.can_view_audit(t.audit_id))
      and (t.nonconformity_id is null or public.can_view_nc(t.nonconformity_id))));
create policy evid_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'evidencias' and public.has_branch(public.storage_branch_from_path(name)));
create policy evid_delete on storage.objects for delete to authenticated using (
  bucket_id = 'evidencias' and (owner = auth.uid() or public.is_admin()));

create policy manual_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'manual' and public.current_role_name() is not null);
create policy manual_obj_write on storage.objects for insert to authenticated with check (bucket_id = 'manual' and public.is_admin());
create policy manual_obj_delete on storage.objects for delete to authenticated using (bucket_id = 'manual' and public.is_admin());

create policy marca_select on storage.objects for select to anon, authenticated using (bucket_id = 'marca');
create policy marca_write on storage.objects for insert to authenticated with check (bucket_id = 'marca' and public.is_admin());
create policy marca_update on storage.objects for update to authenticated using (bucket_id = 'marca' and public.is_admin());
create policy marca_delete on storage.objects for delete to authenticated using (bucket_id = 'marca' and public.is_admin());
