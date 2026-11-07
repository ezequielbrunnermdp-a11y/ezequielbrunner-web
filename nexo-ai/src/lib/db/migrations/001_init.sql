-- NEXO AI — esquema inicial.
-- Toda tabla con datos de negocio lleva company_id: el aislamiento entre empresas
-- se aplica en la capa de servicios (cada consulta filtra por company_id luego de
-- verificar la membresía) y, en Supabase, además con RLS (ver 900_supabase_rls.sql).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  is_platform_admin boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_demo boolean not null default false,
  -- redact_phones, redact_emails, retention_days, ai_enabled
  settings jsonb not null default '{"redact_phones": true, "redact_emails": true, "retention_days": null, "ai_enabled": true}',
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','analyst','viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  title text not null,
  kind text not null default 'group' check (kind in ('group','individual')),
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (company_id, fingerprint)
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  display_name text not null,
  unique (conversation_id, display_name)
);

create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  file_name text not null,
  file_sha256 text not null,
  file_size integer not null,
  source_kind text not null check (source_kind in ('txt','zip')),
  date_order text not null,
  total_parsed integer not null default 0,
  inserted integer not null default 0,
  duplicates integer not null default 0,
  system_messages integer not null default 0,
  warnings jsonb not null default '[]',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  import_id uuid not null references imports(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  -- Hora local del dispositivo que exportó el chat (WhatsApp no incluye zona horaria).
  sent_at timestamp not null,
  author_label text,
  body text not null,
  kind text not null check (kind in ('text','media','system','deleted')),
  edited boolean not null default false,
  content_hash text not null,
  source_line integer not null,
  -- Línea original cifrada (AES-256-GCM) para trazabilidad exacta.
  source_raw_enc text,
  suspicious boolean not null default false,
  analyzed_at timestamptz,
  search tsvector generated always as (to_tsvector('spanish', coalesce(author_label,'') || ' ' || body)) stored,
  created_at timestamptz not null default now(),
  unique (conversation_id, content_hash)
);
create index if not exists messages_conv_time on messages (conversation_id, sent_at);
create index if not exists messages_company_time on messages (company_id, sent_at);
create index if not exists messages_search on messages using gin (search);

create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  engine text not null check (engine in ('claude','heuristic')),
  model text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  messages_analyzed integer not null default 0,
  findings_created integer not null default 0,
  outputs_rejected integer not null default 0,
  suspicious_messages integer not null default 0,
  error text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','done','discarded','insufficient_info')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assignee_label text,
  due_date date,
  source text not null check (source in ('manual','finding')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_company_status on tasks (company_id, status);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  run_id uuid references analysis_runs(id) on delete set null,
  type text not null check (type in ('task','request','commitment','decision','incident','completion_signal')),
  title text not null,
  description text,
  assignee_label text,
  due_hint text,
  due_date date,
  branch_id uuid references branches(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  confidence numeric(3,2) not null,
  rationale text,
  engine text not null check (engine in ('claude','heuristic')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','insufficient_info')),
  review_note text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  task_id uuid references tasks(id) on delete set null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (company_id, dedupe_key)
);
create index if not exists findings_company_status on findings (company_id, status);

create table if not exists finding_evidence (
  finding_id uuid not null references findings(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  quote text not null,
  primary key (finding_id, message_id)
);

create table if not exists task_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  type text not null,
  from_status text,
  to_status text,
  note text,
  evidence_message_id uuid references messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists task_events_task on task_events (task_id, created_at);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_company_time on audit_log (company_id, created_at desc);

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
