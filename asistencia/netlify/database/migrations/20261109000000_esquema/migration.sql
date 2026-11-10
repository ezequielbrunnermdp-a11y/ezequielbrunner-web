-- =====================================================================
-- Sistema de control de asistencia — esquema inicial
-- Todas las marcas de tiempo se guardan como timestamptz (UTC).
-- =====================================================================

-- gen_random_uuid() es nativo desde PostgreSQL 13.

-- ---------------------------------------------------------------------
-- Empresas y sucursales
-- ---------------------------------------------------------------------
create table companies (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,
  active                  boolean not null default true,
  is_demo                 boolean not null default false,
  timezone                text not null default 'America/Argentina/Buenos_Aires',
  late_tolerance_min      int  not null default 10 check (late_tolerance_min between 0 and 120),
  early_leave_tolerance_min int not null default 10 check (early_leave_tolerance_min between 0 and 120),
  extra_hours_threshold_min int not null default 15 check (extra_hours_threshold_min between 0 and 240),
  max_shift_hours         int  not null default 16 check (max_shift_hours between 4 and 24),
  daily_report_hour       int  not null default 7 check (daily_report_hour between 0 and 23),
  report_emails           text[] not null default '{}',
  geo_retention_days      int  not null default 365 check (geo_retention_days between 30 and 3650),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table branches (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id),
  name             text not null,
  address          text,
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  radius_m         int not null default 80 check (radius_m between 10 and 2000),
  max_accuracy_m   int not null default 60 check (max_accuracy_m between 5 and 500),
  timezone         text not null default 'America/Argentina/Buenos_Aires',
  opening_hours    jsonb not null default '{}'::jsonb,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, name)
);
create index on branches (company_id);

-- ---------------------------------------------------------------------
-- Usuarios, sesiones y alcance de permisos
-- ---------------------------------------------------------------------
create type user_role as enum ('superadmin', 'company_admin', 'manager', 'supervisor', 'employee');

create table users (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (email = lower(email)),
  password_hash    text not null,
  role             user_role not null,
  full_name        text not null,
  active           boolean not null default true,
  must_change_password boolean not null default false,
  failed_logins    int not null default 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Alcance: a qué empresas / sucursales accede un usuario de gestión.
-- branch_id null = toda la empresa.
create table user_scopes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  company_id  uuid not null references companies(id),
  branch_id   uuid references branches(id),
  unique nulls not distinct (user_id, company_id, branch_id)
);
create index on user_scopes (user_id);

create table sessions (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  user_id      uuid not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  ip           inet,
  user_agent   text
);
create index on sessions (user_id);

-- ---------------------------------------------------------------------
-- Empleados
-- ---------------------------------------------------------------------
create table employees (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id),
  user_id            uuid unique references users(id),
  file_number        text not null,               -- legajo
  first_name         text not null,
  last_name          text not null,
  document_number    text,
  sector             text,
  position           text,
  supervisor_user_id uuid references users(id),   -- responsable
  primary_branch_id  uuid not null references branches(id),
  pin_hash           text,                        -- PIN para terminal física
  active             boolean not null default true,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, file_number)
);
create index on employees (company_id);
create index on employees (primary_branch_id);

-- Sucursales autorizadas para fichar (incluye la principal).
create table employee_branches (
  employee_id uuid not null references employees(id) on delete cascade,
  branch_id   uuid not null references branches(id),
  primary key (employee_id, branch_id)
);

-- ---------------------------------------------------------------------
-- Terminales físicas (pantalla QR / kiosco de fichaje presencial)
-- ---------------------------------------------------------------------
create table terminals (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  name          text not null,
  token_hash    text unique,
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  allow_kiosk_punch boolean not null default true,
  active        boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- QR usados: impide reutilizar el mismo código por el mismo empleado.
create table qr_uses (
  jti         text not null,
  employee_id uuid not null references employees(id),
  branch_id   uuid not null references branches(id),
  used_at     timestamptz not null default now(),
  primary key (jti, employee_id)
);
create index on qr_uses (used_at);

-- ---------------------------------------------------------------------
-- Horarios
-- ---------------------------------------------------------------------
-- Plantilla semanal: weekday 0=domingo … 6=sábado (hora local de la sucursal).
-- Si end_time <= start_time el turno termina al día siguiente (nocturno).
create table schedule_templates (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  branch_id     uuid not null references branches(id),
  weekday       smallint not null check (weekday between 0 and 6),
  start_time    time not null,
  end_time      time not null,
  break_minutes int not null default 0 check (break_minutes between 0 and 240),
  valid_from    date not null default current_date,
  valid_to      date,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);
create index on schedule_templates (employee_id);

-- Turnos concretos (materializados desde la plantilla o cargados a mano).
create table shifts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  branch_id     uuid not null references branches(id),
  work_date     date not null,                 -- fecha local en que empieza
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  break_minutes int not null default 0,
  template_id   uuid references schedule_templates(id) on delete set null,
  status        text not null default 'active' check (status in ('active','cancelled')),
  notes         text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_at > start_at),
  check (end_at - start_at <= interval '24 hours')
);
create unique index shifts_template_unique on shifts (employee_id, work_date, template_id) where template_id is not null;
create index on shifts (branch_id, work_date);
create index on shifts (employee_id, start_at);

-- Novedades: francos, vacaciones, licencias.
create type leave_type as enum ('franco', 'vacaciones', 'licencia_medica', 'licencia_especial', 'feriado', 'otro');
create table leaves (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  type         leave_type not null,
  start_date   date not null,
  end_date     date not null,
  notes        text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on leaves (employee_id, start_date, end_date);

-- ---------------------------------------------------------------------
-- Fichadas (INMUTABLES)
-- ---------------------------------------------------------------------
create type punch_type as enum ('in', 'out');
create type punch_source as enum ('mobile', 'terminal', 'correction');

create table punches (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id),
  company_id      uuid not null references companies(id),
  branch_id       uuid not null references branches(id),
  type            punch_type not null,
  source          punch_source not null,
  occurred_at     timestamptz not null default now(),  -- reloj del servidor
  recorded_at     timestamptz not null default now(),
  latitude        double precision,
  longitude       double precision,
  accuracy_m      double precision,
  distance_m      double precision,
  qr_jti          text,
  terminal_id     uuid references terminals(id),
  correction_id   uuid,
  idempotency_key text unique,
  user_id         uuid references users(id),
  ip              inet,
  user_agent      text,
  flags           text[] not null default '{}',
  -- Una fichada móvil siempre tiene GPS validado y QR; una de terminal, su terminal;
  -- una corrección, su solicitud aprobada. Nunca se mezclan.
  check (source <> 'mobile'   or (accuracy_m is not null and distance_m is not null and qr_jti is not null)),
  check (source <> 'terminal' or terminal_id is not null),
  check (source <> 'correction' or (correction_id is not null and latitude is null and qr_jti is null))
);
create index on punches (employee_id, occurred_at desc);
create index on punches (branch_id, occurred_at desc);
create index on punches (company_id, occurred_at desc);

-- Anulaciones (la fichada original se conserva siempre).
create table punch_voids (
  punch_id      uuid primary key references punches(id),
  correction_id uuid not null,
  voided_by     uuid not null references users(id),
  voided_at     timestamptz not null default now()
);

-- Intentos rechazados (incidencias de geolocalización / QR / secuencia).
create table punch_attempts (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid references employees(id),
  company_id   uuid references companies(id),
  branch_id    uuid references branches(id),
  type         punch_type,
  reason       text not null,
  latitude     double precision,
  longitude    double precision,
  accuracy_m   double precision,
  distance_m   double precision,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index on punch_attempts (company_id, created_at desc);
create index on punch_attempts (employee_id, created_at desc);

-- ---------------------------------------------------------------------
-- Correcciones (flujo solicitud → aprobación, auditable)
-- ---------------------------------------------------------------------
create table correction_requests (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id),
  company_id      uuid not null references companies(id),
  branch_id       uuid not null references branches(id),
  kind            text not null check (kind in ('add_punch', 'void_punch')),
  punch_id        uuid references punches(id),
  proposed_type   punch_type,
  proposed_time   timestamptz,
  reason          text not null check (length(reason) >= 10),
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by    uuid not null references users(id),
  requested_at    timestamptz not null default now(),
  reviewed_by     uuid references users(id),
  reviewed_at     timestamptz,
  review_note     text,
  result_punch_id uuid references punches(id),
  check (kind <> 'add_punch'  or (proposed_type is not null and proposed_time is not null)),
  check (kind <> 'void_punch' or punch_id is not null)
);
create index on correction_requests (company_id, status);

alter table punches add constraint punches_correction_fk foreign key (correction_id) references correction_requests(id);
alter table punch_voids add constraint punch_voids_correction_fk foreign key (correction_id) references correction_requests(id);

-- ---------------------------------------------------------------------
-- Alertas, correo, auditoría, rate limiting
-- ---------------------------------------------------------------------
create table alerts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id),
  branch_id     uuid references branches(id),
  employee_id   uuid references employees(id),
  type          text not null,
  severity      text not null default 'warning' check (severity in ('info','warning','critical')),
  message       text not null,
  data          jsonb not null default '{}'::jsonb,
  dedupe_key    text unique,
  created_at    timestamptz not null default now(),
  acknowledged_by uuid references users(id),
  acknowledged_at timestamptz
);
create index on alerts (company_id, created_at desc);

create table email_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_address  text not null,
  subject     text not null,
  html        text not null,
  status      text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts    int not null default 0,
  last_error  text,
  dedupe_key  text unique,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create table audit_log (
  id          bigserial primary key,
  actor_user_id uuid references users(id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index on audit_log (entity, entity_id);
create index on audit_log (created_at desc);

create table rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        int not null
);

create table job_runs (
  job        text not null,
  run_key    text not null,
  ran_at     timestamptz not null default now(),
  primary key (job, run_key)
);

-- ---------------------------------------------------------------------
-- Inmutabilidad: fichadas, anulaciones y auditoría no se modifican ni borran.
-- (Excepción controlada: la purga de coordenadas por política de retención.)
-- ---------------------------------------------------------------------
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin
  -- Única excepción: la purga de coordenadas por retención (sólo pone lat/lng en null).
  if tg_op = 'UPDATE' and tg_table_name = 'punches' then
    if current_setting('app.geo_purge', true) = 'on'
       and new.latitude is null and new.longitude is null
       and (to_jsonb(new) - 'latitude' - 'longitude') = (to_jsonb(old) - 'latitude' - 'longitude') then
      return new;
    end if;
  end if;
  raise exception 'La tabla % es de solo inserción (registro inmutable)', tg_table_name
    using errcode = 'P0001';
end $$;

create trigger punches_immutable before update or delete on punches
  for each row execute function forbid_mutation();
create trigger punch_voids_immutable before update or delete on punch_voids
  for each row execute function forbid_mutation();
create trigger audit_immutable before update or delete on audit_log
  for each row execute function forbid_mutation();

-- Al insertar, una fichada móvil debe traer coordenadas (luego pueden purgarse por retención).
create or replace function check_mobile_punch() returns trigger language plpgsql as $$
begin
  if new.source = 'mobile' and (new.latitude is null or new.longitude is null) then
    raise exception 'Fichada móvil sin coordenadas' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger punches_mobile_check before insert on punches
  for each row execute function check_mobile_punch();

-- Vista de fichadas vigentes (no anuladas).
create view effective_punches as
  select p.* from punches p
  where not exists (select 1 from punch_voids v where v.punch_id = p.id);
