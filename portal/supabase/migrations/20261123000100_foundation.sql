-- =====================================================================
-- FASE 1 · FUNDACIÓN
-- Organizaciones (clientes SaaS), marcas, razones sociales, sucursales,
-- sectores, perfiles, relaciones laborales, roles, permisos y auditoría.
-- Toda tabla expuesta tiene RLS. Los permisos se verifican en la base.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Esquema privado para funciones auxiliares (no expuesto por la API).
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  settings jsonb not null default jsonb_build_object(
    'cross_brand_social', false,     -- vínculos sociales entre marcas: desactivado por defecto
    'require_mfa', true,             -- MFA obligatoria para roles con permisos administrativos
    'timezone', 'America/Argentina/Buenos_Aires'
  ),
  logo_path text,
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  logo_path text,          -- los logos oficiales se cargan luego, sin rediseño
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

-- Razón social empleadora. Una marca puede operar con varias razones sociales.
create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_name text not null check (length(legal_name) between 2 and 200),
  cuit text check (cuit is null or cuit ~ '^\d{2}-?\d{8}-?\d$'),
  verified boolean not null default false,   -- datos a confirmar por el administrador
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  name text not null check (length(name) between 2 and 120),
  address text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  geofence_radius_m integer not null default 40 check (geofence_radius_m between 10 and 2000),
  gps_max_accuracy_m integer not null default 75 check (gps_max_accuracy_m between 5 and 5000),
  require_gps boolean not null default true,
  require_qr boolean not null default true,
  late_tolerance_min integer not null default 10 check (late_tolerance_min between 0 and 120),
  early_leave_tolerance_min integer not null default 10 check (early_leave_tolerance_min between 0 and 120),
  max_open_hours integer not null default 14 check (max_open_hours between 4 and 48),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  status text not null default 'pending_verification'
    check (status in ('pending_verification','active','inactive')),
  created_at timestamptz not null default now(),
  unique (organization_id, brand_id, name)
);
create index on public.branches (legal_entity_id);
create index on public.branches (brand_id);

-- Garantiza que marca y razón social pertenezcan a la misma organización.
create or replace function app.check_branch_consistency() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.brands where id = new.brand_id and organization_id = new.organization_id)
     or not exists (select 1 from public.legal_entities where id = new.legal_entity_id and organization_id = new.organization_id) then
    raise exception 'La marca y la razón social deben pertenecer a la misma organización' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger branches_consistency before insert or update on public.branches
  for each row execute function app.check_branch_consistency();

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade, -- null = sector común a la organización
  name text not null check (length(name) between 2 and 80),
  created_at timestamptz not null default now()
);
create unique index sectors_unique_name on public.sectors (organization_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ---------------------------------------------------------------------
-- Personas: perfil social (voluntario) separado de datos laborales
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  avatar_path text,
  bio text check (bio is null or length(bio) <= 500),
  interests text[] not null default '{}' check (cardinality(interests) <= 15),
  social_enabled boolean not null default true,        -- la participación social es voluntaria
  show_birthday boolean not null default false,
  birth_month smallint check (birth_month between 1 and 12),
  birth_day smallint check (birth_day between 1 and 31),
  show_hire_date boolean not null default false,
  show_read_receipts boolean not null default true,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_name_search on public.profiles (organization_id, lower(first_name || ' ' || last_name));

-- Bloqueos entre personas (afectan perfiles, mensajes y publicaciones).
create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Datos personales sensibles: solo titular y roles autorizados.
create table public.employee_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dni text,
  cuil text,
  birthdate date,
  phone text,
  address text,
  emergency_contact text,
  updated_at timestamptz not null default now()
);

-- Relación laboral: una persona puede tener relación con varias razones sociales
-- sin duplicar su identidad.
create table public.employments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  primary_branch_id uuid not null references public.branches(id),
  sector_id uuid references public.sectors(id),
  position text not null default 'Colaborador' check (length(position) between 2 and 80),
  employee_code text not null check (employee_code ~ '^[A-Za-z0-9-]{3,20}$'),
  hire_date date,
  status text not null default 'invited' check (status in ('invited','active','suspended','terminated')),
  manager_user_id uuid references auth.users(id),
  kiosk_pin_hash text,
  kiosk_failed_attempts integer not null default 0,
  kiosk_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, employee_code)
);
create unique index employments_one_active_per_le on public.employments (user_id, legal_entity_id) where status <> 'terminated';
create index on public.employments (primary_branch_id) where status in ('active','invited');
create index on public.employments (user_id);

-- Sucursales adicionales donde la persona está autorizada a trabajar/fichar.
create table public.employment_branches (
  employment_id uuid not null references public.employments(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employment_id, branch_id)
);

-- ---------------------------------------------------------------------
-- Roles y permisos granulares
-- ---------------------------------------------------------------------
create table public.permissions (
  key text primary key,
  category text not null,
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade, -- null = plantilla del sistema
  key text not null check (key ~ '^[a-z_]{2,40}$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index roles_unique_key on public.roles (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('organization','legal_entity','branch')),
  scope_id uuid not null,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, role_id, scope_type, scope_id)
);
create index on public.role_assignments (user_id);

-- Superadministración técnica de la plataforma (SaaS). NO otorga lectura de
-- contenido social ni de conversaciones privadas.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Auditoría (solo inserción a través de funciones de servidor)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- Notificaciones persistentes
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,           -- nunca incluir datos laborales sensibles en el texto
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
create index on public.notifications (user_id) where read_at is null;

-- =====================================================================
-- Funciones auxiliares de autorización
-- =====================================================================
create or replace function app.uid() returns uuid language sql stable as $$ select auth.uid() $$;

create or replace function app.mfa_ok(p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select not coalesce((o.settings->>'require_mfa')::boolean, true)
                   from public.organizations o where o.id = p_org), false)
         or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- ¿Tiene el usuario el permiso sobre la sucursal? (alcance org > razón social > sucursal)
create or replace function app.has_perm_branch(p_perm text, p_branch uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.branches b
    join public.role_assignments ra on ra.user_id = auth.uid() and ra.organization_id = b.organization_id
    join public.role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = p_perm
    where b.id = p_branch
      and ((ra.scope_type = 'organization' and ra.scope_id = b.organization_id)
        or (ra.scope_type = 'legal_entity' and ra.scope_id = b.legal_entity_id)
        or (ra.scope_type = 'branch' and ra.scope_id = b.id))
  ) and app.mfa_ok((select organization_id from public.branches where id = p_branch))
$$;

create or replace function app.has_perm_le(p_perm text, p_le uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.legal_entities le
    join public.role_assignments ra on ra.user_id = auth.uid() and ra.organization_id = le.organization_id
    join public.role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = p_perm
    where le.id = p_le
      and ((ra.scope_type = 'organization' and ra.scope_id = le.organization_id)
        or (ra.scope_type = 'legal_entity' and ra.scope_id = le.id))
  ) and app.mfa_ok((select organization_id from public.legal_entities where id = p_le))
$$;

create or replace function app.has_perm_org(p_perm text, p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.role_assignments ra
    join public.role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = p_perm
    where ra.user_id = auth.uid() and ra.organization_id = p_org
      and ra.scope_type = 'organization' and ra.scope_id = p_org
  ) and app.mfa_ok(p_org)
$$;

-- ¿Tiene el permiso en alguna sucursal de la organización?
create or replace function app.has_perm_any(p_perm text, p_org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.role_assignments ra
    join public.role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = p_perm
    where ra.user_id = auth.uid() and ra.organization_id = p_org
  ) and app.mfa_ok(p_org)
$$;

create or replace function app.perm_branches(p_perm text) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct b.id
  from public.role_assignments ra
  join public.role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = p_perm
  join public.branches b on b.organization_id = ra.organization_id
   and ((ra.scope_type = 'organization' and ra.scope_id = b.organization_id)
     or (ra.scope_type = 'legal_entity' and ra.scope_id = b.legal_entity_id)
     or (ra.scope_type = 'branch' and ra.scope_id = b.id))
  where ra.user_id = auth.uid() and app.mfa_ok(b.organization_id)
$$;

-- ¿Puede el usuario actual gestionar a la persona indicada con ese permiso?
create or replace function app.can_manage_user(p_perm text, p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.employments e
    where e.user_id = p_user and e.status <> 'terminated'
      and (app.has_perm_branch(p_perm, e.primary_branch_id)
           or exists (select 1 from public.employment_branches eb
                      where eb.employment_id = e.id and app.has_perm_branch(p_perm, eb.branch_id)))
  )
$$;

-- Evita recursión de RLS entre employments y employment_branches.
create or replace function app.emp_extra_branch_perm(p_employment uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.employment_branches eb where eb.employment_id = p_employment and app.has_perm_branch(p_perm, eb.branch_id))
$$;

create or replace function app.my_employment(p_employment uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.employments where id = p_employment and user_id = auth.uid())
$$;

create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- Organizaciones de las que el usuario forma parte (empleo activo o rol asignado).
create or replace function app.my_orgs() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select organization_id from public.employments where user_id = auth.uid() and status in ('active','invited')
  union
  select organization_id from public.role_assignments where user_id = auth.uid()
$$;

create or replace function app.is_member(p_org uuid) returns boolean
language sql stable as $$ select p_org in (select app.my_orgs()) $$;

create or replace function app.user_brands(p_user uuid) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select b.brand_id from public.employments e join public.branches b on b.id = e.primary_branch_id
  where e.user_id = p_user and e.status = 'active'
  union
  select b.brand_id from public.employments e
  join public.employment_branches eb on eb.employment_id = e.id
  join public.branches b on b.id = eb.branch_id
  where e.user_id = p_user and e.status = 'active'
$$;

-- ¿Pertenece el usuario actual a la comunidad (organización + marca) indicada?
create or replace function app.in_community(p_org uuid, p_brand uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.employments e where e.user_id = auth.uid()
                 and e.organization_id = p_org and e.status = 'active')
     and (p_brand is null
          or coalesce((select (settings->>'cross_brand_social')::boolean from public.organizations where id = p_org), false)
          or p_brand in (select app.user_brands(auth.uid())))
$$;

-- ¿Comparten comunidad social dos personas? Por defecto, misma organización y marca.
create or replace function app.same_community(p_other uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.employments me
    join public.employments other on other.organization_id = me.organization_id
    join public.organizations o on o.id = me.organization_id
    where me.user_id = auth.uid() and other.user_id = p_other
      and me.status = 'active' and other.status = 'active'
      and (coalesce((o.settings->>'cross_brand_social')::boolean, false)
           or exists (select 1 from app.user_brands(auth.uid()) a
                      join app.user_brands(p_other) b on a = b))
  )
$$;

create or replace function app.notify(p_user uuid, p_type text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, p_type, p_title, p_body, p_link
  where p_user is not null
    and coalesce((select (notification_prefs->>p_type)::boolean from public.profiles where user_id = p_user), true)
$$;

create or replace function app.audit(p_org uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, details)
  values (p_org, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger employments_touch before update on public.employments for each row execute function app.touch_updated_at();

grant execute on all functions in schema app to authenticated, anon, service_role;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.organizations enable row level security;
alter table public.brands enable row level security;
alter table public.legal_entities enable row level security;
alter table public.branches enable row level security;
alter table public.sectors enable row level security;
alter table public.profiles enable row level security;
alter table public.employee_private enable row level security;
alter table public.user_blocks enable row level security;
alter table public.employments enable row level security;
alter table public.employment_branches enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.role_assignments enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

-- Organizaciones / marcas / razones sociales / sucursales / sectores: lectura para miembros.
create policy org_read on public.organizations for select to authenticated
  using (app.is_member(id) or app.is_platform_admin());
create policy org_update on public.organizations for update to authenticated
  using (app.has_perm_org('org.manage', id)) with check (app.has_perm_org('org.manage', id));
create policy org_insert on public.organizations for insert to authenticated
  with check (app.is_platform_admin());

create policy brands_read on public.brands for select to authenticated using (app.is_member(organization_id));
create policy brands_write on public.brands for all to authenticated
  using (app.has_perm_org('org.manage', organization_id)) with check (app.has_perm_org('org.manage', organization_id));

create policy le_read on public.legal_entities for select to authenticated using (app.is_member(organization_id));
create policy le_write on public.legal_entities for all to authenticated
  using (app.has_perm_org('org.manage', organization_id)) with check (app.has_perm_org('org.manage', organization_id));

create policy branches_read on public.branches for select to authenticated using (app.is_member(organization_id));
create policy branches_insert on public.branches for insert to authenticated
  with check (app.has_perm_le('branches.manage', legal_entity_id));
create policy branches_update on public.branches for update to authenticated
  using (app.has_perm_branch('branches.manage', id)) with check (app.has_perm_le('branches.manage', legal_entity_id) or app.has_perm_branch('branches.manage', id));
create policy branches_delete on public.branches for delete to authenticated
  using (app.has_perm_le('branches.manage', legal_entity_id));

create policy sectors_read on public.sectors for select to authenticated using (app.is_member(organization_id));
create policy sectors_write on public.sectors for all to authenticated
  using (case when branch_id is null then app.has_perm_org('branches.manage', organization_id) else app.has_perm_branch('branches.manage', branch_id) end)
  with check (case when branch_id is null then app.has_perm_org('branches.manage', organization_id) else app.has_perm_branch('branches.manage', branch_id) end);

-- Perfiles: el titular; compañeros de su comunidad que no estén bloqueados; gestión autorizada.
create policy profiles_read on public.profiles for select to authenticated using (
  user_id = auth.uid()
  or (social_enabled and app.same_community(user_id)
      and not exists (select 1 from public.user_blocks ub where (ub.blocker_id = user_id and ub.blocked_id = auth.uid()) or (ub.blocker_id = auth.uid() and ub.blocked_id = user_id)))
  or app.can_manage_user('employees.view', user_id)
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_read on public.user_blocks for select to authenticated using (blocker_id = auth.uid());

create policy private_read on public.employee_private for select to authenticated
  using (user_id = auth.uid() or app.can_manage_user('employees.view_private', user_id));
create policy private_write on public.employee_private for all to authenticated
  using (app.can_manage_user('employees.manage', user_id))
  with check (app.can_manage_user('employees.manage', user_id));

create policy employments_read on public.employments for select to authenticated
  using (user_id = auth.uid() or app.has_perm_branch('employees.view', primary_branch_id)
         or app.emp_extra_branch_perm(id, 'employees.view'));
create policy employments_insert on public.employments for insert to authenticated
  with check (app.has_perm_branch('employees.manage', primary_branch_id));
create policy employments_update on public.employments for update to authenticated
  using (app.has_perm_branch('employees.manage', primary_branch_id))
  with check (app.has_perm_branch('employees.manage', primary_branch_id));

create policy emp_branches_read on public.employment_branches for select to authenticated
  using (app.has_perm_branch('employees.view', branch_id) or app.my_employment(employment_id));
create policy emp_branches_write on public.employment_branches for all to authenticated
  using (app.has_perm_branch('employees.manage', branch_id)) with check (app.has_perm_branch('employees.manage', branch_id));

create policy permissions_read on public.permissions for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (organization_id is null or app.is_member(organization_id));
create policy roles_write on public.roles for all to authenticated
  using (organization_id is not null and not is_system and app.has_perm_org('roles.manage', organization_id))
  with check (organization_id is not null and not is_system and app.has_perm_org('roles.manage', organization_id));
create policy role_perms_read on public.role_permissions for select to authenticated using (true);
create policy role_perms_write on public.role_permissions for all to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and r.organization_id is not null and not r.is_system and app.has_perm_org('roles.manage', r.organization_id)))
  with check (exists (select 1 from public.roles r where r.id = role_id and r.organization_id is not null and not r.is_system and app.has_perm_org('roles.manage', r.organization_id)));

-- Asignaciones: visibles para el titular y para quien administra roles.
-- Las altas/bajas pasan por la función assign_role (evita escalamiento de privilegios).
create policy ra_read on public.role_assignments for select to authenticated
  using (user_id = auth.uid() or app.has_perm_org('roles.manage', organization_id));

create policy pa_read on public.platform_admins for select to authenticated using (user_id = auth.uid());

create policy audit_read on public.audit_log for select to authenticated
  using (organization_id is not null and app.has_perm_org('audit.view', organization_id));

create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Privilegios de tabla (RLS filtra filas; los grants limitan operaciones y columnas).
grant select on all tables in schema public to authenticated;
grant update (name, settings, logo_path) on public.organizations to authenticated;
grant insert on public.organizations to authenticated;
grant insert, update, delete on public.brands, public.legal_entities, public.branches, public.sectors,
  public.employment_branches, public.roles, public.role_permissions, public.employee_private to authenticated;
grant update (first_name, last_name, avatar_path, bio, interests, social_enabled, show_birthday, birth_month,
  birth_day, show_hire_date, show_read_receipts, notification_prefs) on public.profiles to authenticated;
grant insert on public.employments to authenticated;
grant update (primary_branch_id, sector_id, position, hire_date, status, manager_user_id) on public.employments to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
-- kiosk_pin_hash nunca se expone: se revoca la lectura de esa columna.
revoke select on public.employments from authenticated;
grant select (id, user_id, organization_id, legal_entity_id, primary_branch_id, sector_id, position, employee_code,
  hire_date, status, manager_user_id, kiosk_locked_until, created_at, updated_at) on public.employments to authenticated;
