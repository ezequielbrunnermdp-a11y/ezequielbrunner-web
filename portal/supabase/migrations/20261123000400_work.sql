-- =====================================================================
-- FASE 3 · OPERACIÓN LABORAL
-- Horarios (turnos con timestamptz: soportan jornadas que cruzan la
-- medianoche), francos, historial de cambios, cambios de turno,
-- solicitudes de RR. HH., reuniones y canal "Hablar con gerencia".
-- =====================================================================

-- Reglas configurables por empresa/convenio/categoría. Son parámetros
-- operativos: NO implican por sí mismos cumplimiento normativo.
create table public.labor_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  name text not null,
  agreement text,                      -- p. ej. "CCT 389/04" (a validar por asesoría laboral)
  category text,
  max_shift_hours numeric(4,1) not null default 12 check (max_shift_hours between 1 and 24),
  min_rest_hours numeric(4,1) not null default 12 check (min_rest_hours between 0 and 48),
  weekly_hours_limit numeric(5,1) check (weekly_hours_limit is null or weekly_hours_limit between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  sector_id uuid references public.sectors(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 240),
  role_label text check (role_label is null or length(role_label) <= 60),
  notes text check (notes is null or length(notes) <= 500),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '24 hours'),
  -- Sin solapamientos para una misma persona (en cualquier sucursal).
  constraint shifts_no_overlap exclude using gist (
    user_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index on public.shifts (branch_id, starts_at);
create index on public.shifts (user_id, starts_at);

create table public.days_off (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('franco','medio_franco','vacaciones','licencia')),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index days_off_unique on public.days_off (user_id, day) where status <> 'cancelled';

-- Historial inmutable de modificaciones de turnos publicados.
create table public.shift_changes (
  id bigint generated always as identity primary key,
  shift_id uuid not null,
  user_id uuid not null,
  branch_id uuid not null,
  changed_by uuid,
  change_type text not null check (change_type in ('published','updated','cancelled','swapped')),
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.shift_changes (user_id, created_at desc);

create table public.shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_shift_id uuid not null references public.shifts(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_shift_id uuid references public.shifts(id) on delete cascade, -- null = cesión del turno
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'pending_peer'
    check (status in ('pending_peer','pending_manager','approved','rejected','cancelled')),
  peer_responded_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Solicitudes de autogestión (RR. HH.)
-- ---------------------------------------------------------------------
create table public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('vacation','day_off','permission','schedule_change','attendance_correction',
                                      'data_update','certificate','payroll_query')),
  start_date date,
  end_date date,
  details text not null check (length(details) between 3 and 2000),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index on public.hr_requests (user_id, created_at desc);
create index on public.hr_requests (branch_id, status);

-- ---------------------------------------------------------------------
-- Reuniones
-- ---------------------------------------------------------------------
create table public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  requester_id uuid not null references auth.users(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  responder_kind text not null check (responder_kind in ('manager','branch_manager','hr','other')),
  reason text not null check (length(reason) between 3 and 120),
  description text check (description is null or length(description) <= 2000),
  preferred_date date,
  preferred_time time,
  modality text not null default 'in_person' check (modality in ('in_person','virtual')),
  status text not null default 'requested'
    check (status in ('requested','accepted','proposed','rejected','done','cancelled')),
  scheduled_at timestamptz,
  duration_min integer default 30 check (duration_min between 5 and 480),
  location text,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> responder_id)
);
create index on public.meeting_requests (responder_id, status);
create index on public.meeting_requests (requester_id, created_at desc);

-- ---------------------------------------------------------------------
-- Hablar con gerencia (canal institucional, separado de la mensajería social)
-- ---------------------------------------------------------------------
create table public.mgmt_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  hr_only boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  unique (organization_id, key)
);

create table public.mgmt_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id),
  category_id uuid not null references public.mgmt_categories(id),
  subject text not null check (length(subject) between 3 and 140),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'received' check (status in ('received','in_review','answered','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.mgmt_tickets (recipient_id, status);
create index on public.mgmt_tickets (sender_id, created_at desc);

create table public.mgmt_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.mgmt_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on public.mgmt_ticket_messages (ticket_id, created_at);

create table public.mgmt_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.mgmt_tickets(id) on delete cascade,
  actor_id uuid,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

create or replace function app.is_ticket_party(p_ticket uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from mgmt_tickets t where t.id = p_ticket and auth.uid() in (t.sender_id, t.recipient_id))
$$;

-- =====================================================================
-- Funciones de horarios
-- =====================================================================
create or replace function app.employment_for_branch(p_user uuid, p_branch uuid) returns public.employments
language sql stable security definer set search_path = public, pg_temp as $$
  select e.* from employments e
  join branches b on b.id = p_branch
  where e.user_id = p_user and e.status in ('active','invited') and e.legal_entity_id = b.legal_entity_id
  order by (e.primary_branch_id = p_branch) desc
  limit 1
$$;

-- Validación de turnos: permiso, relación laboral, reglas operativas.
create or replace function app.validate_shift() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_emp employments; v_rule labor_rules; v_prev timestamptz; v_next timestamptz;
begin
  new.organization_id := (select organization_id from branches where id = new.branch_id);
  if current_user not in ('postgres','service_role','supabase_admin') and not app.has_perm_branch('schedules.manage', new.branch_id) then
    raise exception 'Sin permiso para gestionar horarios en esta sucursal' using errcode = '42501';
  end if;
  -- Asignar a otra sucursal de la misma razón social no duplica la identidad.
  v_emp := app.employment_for_branch(new.user_id, new.branch_id);
  if v_emp.id is null then
    raise exception 'La persona no tiene relación laboral con la razón social de esta sucursal' using errcode = '23514';
  end if;
  select * into v_rule from labor_rules where organization_id = new.organization_id
    and (legal_entity_id is null or legal_entity_id = v_emp.legal_entity_id)
    order by legal_entity_id nulls last limit 1;
  if v_rule.id is not null and new.status <> 'cancelled' then
    if extract(epoch from (new.ends_at - new.starts_at)) / 3600 > v_rule.max_shift_hours then
      raise exception 'El turno supera el máximo configurado de % horas', v_rule.max_shift_hours using errcode = '23514';
    end if;
    select max(ends_at) into v_prev from shifts where user_id = new.user_id and id <> new.id and status <> 'cancelled' and ends_at <= new.starts_at;
    select min(starts_at) into v_next from shifts where user_id = new.user_id and id <> new.id and status <> 'cancelled' and starts_at >= new.ends_at;
    if (v_prev is not null and new.starts_at - v_prev < make_interval(secs => v_rule.min_rest_hours * 3600))
       or (v_next is not null and v_next - new.ends_at < make_interval(secs => v_rule.min_rest_hours * 3600)) then
      raise exception 'No se respeta el descanso mínimo configurado de % horas entre turnos', v_rule.min_rest_hours using errcode = '23514';
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  return new;
end $$;
create trigger shifts_validate before insert or update on public.shifts
  for each row execute function app.validate_shift();

-- Historial y aviso al empleado cuando cambia un turno ya publicado.
create or replace function app.track_shift_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_type text;
begin
  if old.status = 'published' and (new.starts_at, new.ends_at, new.branch_id, new.status, new.user_id)
     is distinct from (old.starts_at, old.ends_at, old.branch_id, old.status, old.user_id) then
    v_type := case when new.status = 'cancelled' then 'cancelled' when new.user_id <> old.user_id then 'swapped' else 'updated' end;
    insert into shift_changes (shift_id, user_id, branch_id, changed_by, change_type, before, after)
    values (new.id, old.user_id, old.branch_id, auth.uid(), v_type,
            jsonb_build_object('starts_at', old.starts_at, 'ends_at', old.ends_at, 'branch_id', old.branch_id, 'user_id', old.user_id),
            jsonb_build_object('starts_at', new.starts_at, 'ends_at', new.ends_at, 'branch_id', new.branch_id, 'user_id', new.user_id, 'status', new.status));
    perform app.notify(old.user_id, 'schedule', 'Se modificó uno de tus turnos', null, '/horarios');
    if new.user_id <> old.user_id then
      perform app.notify(new.user_id, 'schedule', 'Se te asignó un turno', null, '/horarios');
    end if;
  elsif old.status = 'draft' and new.status = 'published' then
    insert into shift_changes (shift_id, user_id, branch_id, changed_by, change_type, after)
    values (new.id, new.user_id, new.branch_id, auth.uid(), 'published',
            jsonb_build_object('starts_at', new.starts_at, 'ends_at', new.ends_at, 'branch_id', new.branch_id));
  end if;
  return new;
end $$;
create trigger shifts_track after update on public.shifts for each row execute function app.track_shift_change();

create or replace function app.prevent_published_delete() returns trigger language plpgsql as $$
begin
  if old.status = 'published' then
    raise exception 'Un turno publicado no se elimina: cancelalo para conservar el historial' using errcode = '23514';
  end if;
  return old;
end $$;
create trigger shifts_no_delete_published before delete on public.shifts for each row execute function app.prevent_published_delete();

create or replace function public.publish_schedule(p_branch uuid, p_from date, p_to date) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer; v_tz text; r record;
begin
  if not app.has_perm_branch('schedules.manage', p_branch) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select timezone into v_tz from branches where id = p_branch;
  with upd as (
    update shifts set status = 'published', published_at = now()
    where branch_id = p_branch and status = 'draft'
      and starts_at >= (p_from::timestamp at time zone v_tz) and starts_at < ((p_to + 1)::timestamp at time zone v_tz)
    returning user_id
  ) select count(*) into v_count from upd;
  update days_off set status = 'published' where branch_id = p_branch and status = 'draft' and day between p_from and p_to;
  for r in select distinct user_id from shifts where branch_id = p_branch and status = 'published' and published_at > now() - interval '5 seconds'
  loop
    perform app.notify(r.user_id, 'schedule', 'Se publicó tu horario', null, '/horarios');
  end loop;
  perform app.audit((select organization_id from branches where id = p_branch), 'schedule.publish', 'branch', p_branch::text,
                    jsonb_build_object('from', p_from, 'to', p_to, 'shifts', v_count));
  return v_count;
end $$;

-- Duplica una semana (en borrador) respetando la hora local de la sucursal.
create or replace function public.duplicate_week(p_branch uuid, p_src_monday date, p_dst_monday date) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tz text; v_count integer := 0; r shifts; v_offset interval;
begin
  if not app.has_perm_branch('schedules.manage', p_branch) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select timezone into v_tz from branches where id = p_branch;
  v_offset := (p_dst_monday - p_src_monday) * interval '1 day';
  for r in select * from shifts where branch_id = p_branch and status <> 'cancelled'
             and starts_at >= (p_src_monday::timestamp at time zone v_tz)
             and starts_at < ((p_src_monday + 7)::timestamp at time zone v_tz)
  loop
    begin
      insert into shifts (branch_id, user_id, sector_id, starts_at, ends_at, break_minutes, role_label, notes, status)
      values (r.branch_id, r.user_id, r.sector_id,
              ((r.starts_at at time zone v_tz) + v_offset) at time zone v_tz,
              ((r.ends_at at time zone v_tz) + v_offset) at time zone v_tz,
              r.break_minutes, r.role_label, r.notes, 'draft');
      v_count := v_count + 1;
    exception when exclusion_violation then null; -- se omite el turno que se superpone
    end;
  end loop;
  return v_count;
end $$;

-- Turnos visibles para el empleado (solo publicados) con datos de sucursal.
create or replace function public.my_shifts(p_from timestamptz, p_to timestamptz)
returns table (id uuid, branch_id uuid, branch_name text, sector_name text, starts_at timestamptz, ends_at timestamptz,
               break_minutes integer, role_label text, notes text, status text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, s.branch_id, b.name, se.name, s.starts_at, s.ends_at, s.break_minutes, s.role_label, s.notes, s.status
  from shifts s join branches b on b.id = s.branch_id left join sectors se on se.id = s.sector_id
  where s.user_id = auth.uid() and s.status in ('published','cancelled')
    and s.ends_at > p_from and s.starts_at < p_to
  order by s.starts_at
$$;

create or replace function public.my_days_off(p_from date, p_to date)
returns table (id uuid, day date, kind text, notes text)
language sql stable security definer set search_path = public, pg_temp as $$
  select id, day, kind, notes from days_off where user_id = auth.uid() and status = 'published' and day between p_from and p_to order by day
$$;

-- Compañeros con los que se puede intercambiar un turno (misma sucursal).
create or replace function public.swap_candidates(p_shift uuid)
returns table (shift_id uuid, user_id uuid, first_name text, last_name text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select s2.id, s2.user_id, p.first_name, p.last_name, s2.starts_at, s2.ends_at
  from shifts s1
  join shifts s2 on s2.branch_id = s1.branch_id and s2.user_id <> s1.user_id and s2.status = 'published'
   and s2.starts_at between s1.starts_at - interval '7 days' and s1.starts_at + interval '7 days'
  join profiles p on p.user_id = s2.user_id
  where s1.id = p_shift and s1.user_id = auth.uid() and s1.status = 'published' and s1.starts_at > now()
  order by s2.starts_at
  limit 100
$$;

create or replace function public.request_shift_swap(p_shift uuid, p_target_user uuid, p_target_shift uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare s shifts; t shifts; v_id uuid;
begin
  select * into s from shifts where id = p_shift and user_id = app.require_auth() and status = 'published' and starts_at > now();
  if s.id is null then raise exception 'Turno no disponible para cambio' using errcode = '42501'; end if;
  if app.employment_for_branch(p_target_user, s.branch_id) is null then
    raise exception 'La otra persona no puede cubrir turnos en esta sucursal' using errcode = '23514';
  end if;
  if p_target_shift is not null then
    select * into t from shifts where id = p_target_shift and user_id = p_target_user and status = 'published';
    if t.id is null then raise exception 'Turno de destino no disponible' using errcode = '42501'; end if;
  end if;
  insert into shift_swap_requests (organization_id, requester_id, requester_shift_id, target_user_id, target_shift_id, reason)
  values (s.organization_id, auth.uid(), p_shift, p_target_user, p_target_shift, p_reason) returning id into v_id;
  perform app.notify(p_target_user, 'shift_swap', 'Te pidieron un cambio de turno', null, '/solicitudes');
  return v_id;
end $$;

create or replace function public.respond_shift_swap(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r shift_swap_requests;
begin
  select * into r from shift_swap_requests where id = p_id for update;
  if r.id is null or r.target_user_id <> app.require_auth() or r.status <> 'pending_peer' then
    raise exception 'Solicitud no disponible' using errcode = '42501';
  end if;
  update shift_swap_requests set status = case when p_accept then 'pending_manager' else 'rejected' end, peer_responded_at = now() where id = p_id;
  perform app.notify(r.requester_id, 'shift_swap', case when p_accept then 'Tu compañero aceptó el cambio: falta aprobación' else 'Tu compañero rechazó el cambio de turno' end, null, '/solicitudes');
end $$;

-- Aprobación por superior: verifica compatibilidad (solapamientos y descansos) en la misma transacción.
create or replace function public.review_shift_swap(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r shift_swap_requests; s shifts;
begin
  select * into r from shift_swap_requests where id = p_id for update;
  select * into s from shifts where id = r.requester_shift_id for update;
  if r.id is null or r.status <> 'pending_manager' or not app.has_perm_branch('schedules.manage', s.branch_id) then
    raise exception 'Solicitud no disponible' using errcode = '42501';
  end if;
  if p_approve then
    begin
      if r.target_shift_id is not null then
        -- Intercambio: se mueve temporalmente el turno del destino para no chocar con la restricción.
        update shifts set user_id = r.requester_id where id = r.target_shift_id;
      end if;
      update shifts set user_id = r.target_user_id where id = r.requester_shift_id;
    exception when exclusion_violation then
      raise exception 'El cambio genera superposición de turnos' using errcode = '23P01';
    end;
  end if;
  update shift_swap_requests set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note where id = p_id;
  perform app.notify(r.requester_id, 'shift_swap', case when p_approve then 'Se aprobó tu cambio de turno' else 'No se aprobó tu cambio de turno' end, null, '/horarios');
  perform app.notify(r.target_user_id, 'shift_swap', case when p_approve then 'Se aprobó un cambio de turno' else 'No se aprobó un cambio de turno' end, null, '/horarios');
  perform app.audit(r.organization_id, 'shift_swap.' || case when p_approve then 'approve' else 'reject' end, 'shift_swap', p_id::text, '{}');
end $$;

-- =====================================================================
-- Solicitudes de RR. HH.
-- =====================================================================
create or replace function public.create_hr_request(p_type text, p_start date, p_end date, p_details text, p_payload jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare e employments; v_id uuid; r record;
begin
  select * into e from employments where user_id = app.require_auth() and status = 'active' order by created_at limit 1;
  if e.id is null then raise exception 'No tenés una relación laboral activa' using errcode = '42501'; end if;
  insert into hr_requests (organization_id, legal_entity_id, branch_id, user_id, type, start_date, end_date, details, payload)
  values (e.organization_id, e.legal_entity_id, e.primary_branch_id, e.user_id, p_type, p_start, p_end, trim(p_details), coalesce(p_payload, '{}'))
  returning id into v_id;
  for r in select distinct ra.user_id from role_assignments ra
           join role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = 'requests.review'
           join branches b on b.id = e.primary_branch_id
           where ra.organization_id = e.organization_id
             and ((ra.scope_type = 'organization') or (ra.scope_type = 'legal_entity' and ra.scope_id = b.legal_entity_id)
                  or (ra.scope_type = 'branch' and ra.scope_id = b.id))
  loop
    perform app.notify(r.user_id, 'hr_request', 'Nueva solicitud para revisar', null, '/gerencia/solicitudes');
  end loop;
  return v_id;
end $$;

create or replace function public.review_hr_request(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r hr_requests;
begin
  select * into r from hr_requests where id = p_id for update;
  if r.id is null or r.status <> 'pending' or not app.has_perm_branch('requests.review', r.branch_id) then
    raise exception 'Solicitud no disponible' using errcode = '42501';
  end if;
  if r.user_id = auth.uid() then raise exception 'No podés resolver tus propias solicitudes' using errcode = '42501'; end if;
  update hr_requests set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note where id = p_id;
  if p_approve and r.type = 'vacation' and r.start_date is not null then
    insert into days_off (organization_id, branch_id, user_id, day, kind, status, created_by)
    select r.organization_id, r.branch_id, r.user_id, d::date, 'vacaciones', 'published', auth.uid()
    from generate_series(r.start_date, coalesce(r.end_date, r.start_date), interval '1 day') d
    on conflict do nothing;
  end if;
  perform app.notify(r.user_id, 'hr_request', case when p_approve then 'Tu solicitud fue aprobada' else 'Tu solicitud fue rechazada' end, null, '/solicitudes');
  perform app.audit(r.organization_id, 'hr_request.' || case when p_approve then 'approve' else 'reject' end, 'hr_request', p_id::text, jsonb_build_object('type', r.type));
end $$;

create or replace function public.cancel_hr_request(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update hr_requests set status = 'cancelled' where id = p_id and user_id = app.require_auth() and status = 'pending';
  if not found then raise exception 'Solicitud no disponible' using errcode = '42501'; end if;
end $$;

-- =====================================================================
-- Reuniones y gerencia: destinatarios autorizados según rol y organización
-- =====================================================================
create or replace function public.allowed_recipients(p_purpose text default 'meeting')
returns table (user_id uuid, first_name text, last_name text, avatar_path text, kind text, scope_label text)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select e.*, b.legal_entity_id as le, b.organization_id as org from employments e join branches b on b.id = e.primary_branch_id
    where e.user_id = auth.uid() and e.status = 'active'
  )
  select distinct on (ra.user_id) ra.user_id, p.first_name, p.last_name, p.avatar_path,
         case r.key when 'hr' then 'hr' when 'branch_manager' then 'branch_manager' when 'general_manager' then 'manager'
                    when 'company_admin' then 'manager' else 'other' end,
         r.name
  from me
  join role_assignments ra on ra.organization_id = me.org
   and ((ra.scope_type = 'organization') or (ra.scope_type = 'legal_entity' and ra.scope_id = me.le)
        or (ra.scope_type = 'branch' and ra.scope_id = me.primary_branch_id))
  join roles r on r.id = ra.role_id
  join role_permissions rp on rp.role_id = r.id
   and rp.permission_key = case when p_purpose = 'ticket' then 'tickets.receive' else 'meetings.manage' end
  join profiles p on p.user_id = ra.user_id
  where ra.user_id <> auth.uid()
  order by ra.user_id, r.key
$$;

create or replace function public.request_meeting(p_responder uuid, p_reason text, p_description text, p_date date, p_time time, p_modality text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_kind text; v_org uuid;
begin
  perform app.require_auth();
  select kind into v_kind from public.allowed_recipients('meeting') where user_id = p_responder;
  if v_kind is null then raise exception 'Responsable no disponible' using errcode = '42501'; end if;
  select organization_id into v_org from employments where user_id = auth.uid() and status = 'active' order by created_at limit 1;
  insert into meeting_requests (organization_id, requester_id, responder_id, responder_kind, reason, description, preferred_date, preferred_time, modality)
  values (v_org, auth.uid(), p_responder, v_kind, trim(p_reason), p_description, p_date, p_time, coalesce(p_modality, 'in_person'))
  returning id into v_id;
  perform app.notify(p_responder, 'meeting', 'Nueva solicitud de reunión', null, '/gerencia/agenda');
  return v_id;
end $$;

create or replace function public.respond_meeting(p_id uuid, p_action text, p_scheduled_at timestamptz default null,
                                                  p_note text default null, p_location text default null, p_duration int default 30)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare m meeting_requests;
begin
  select * into m from meeting_requests where id = p_id for update;
  if m.id is null then raise exception 'Reunión no disponible' using errcode = '42501'; end if;
  if auth.uid() = m.responder_id then
    if p_action not in ('accept','propose','reject','done') then raise exception 'Acción inválida' using errcode = '22023'; end if;
    if p_action = 'reject' and coalesce(trim(p_note), '') = '' then raise exception 'Indicá el motivo del rechazo' using errcode = '22023'; end if;
    if p_action in ('accept','propose') and p_scheduled_at is null then raise exception 'Indicá fecha y hora' using errcode = '22023'; end if;
    update meeting_requests set status = case p_action when 'accept' then 'accepted' when 'propose' then 'proposed' when 'reject' then 'rejected' else 'done' end,
      scheduled_at = coalesce(p_scheduled_at, scheduled_at), response_note = coalesce(p_note, response_note),
      location = coalesce(p_location, location), duration_min = coalesce(p_duration, duration_min), updated_at = now()
    where id = p_id;
    perform app.notify(m.requester_id, 'meeting',
      case p_action when 'accept' then 'Tu reunión fue confirmada' when 'propose' then 'Te propusieron otra fecha para la reunión'
                    when 'reject' then 'Tu solicitud de reunión fue rechazada' else 'Reunión marcada como realizada' end, null, '/reuniones');
  elsif auth.uid() = m.requester_id then
    if p_action = 'accept' and m.status = 'proposed' then
      update meeting_requests set status = 'accepted', updated_at = now() where id = p_id;
      perform app.notify(m.responder_id, 'meeting', 'Se aceptó la fecha propuesta', null, '/gerencia/agenda');
    elsif p_action = 'cancel' and m.status in ('requested','proposed','accepted') then
      update meeting_requests set status = 'cancelled', updated_at = now() where id = p_id;
      perform app.notify(m.responder_id, 'meeting', 'Se canceló una reunión', null, '/gerencia/agenda');
    else
      raise exception 'Acción inválida' using errcode = '22023';
    end if;
  else
    raise exception 'Reunión no disponible' using errcode = '42501';
  end if;
end $$;

create or replace function public.create_mgmt_ticket(p_recipient uuid, p_category uuid, p_subject text, p_body text, p_priority text default 'normal')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; e employments; c mgmt_categories; v_kind text;
begin
  select * into e from employments where user_id = app.require_auth() and status = 'active' order by created_at limit 1;
  if e.id is null then raise exception 'No tenés una relación laboral activa' using errcode = '42501'; end if;
  select * into c from mgmt_categories where id = p_category and organization_id = e.organization_id and active;
  if c.id is null then raise exception 'Categoría inválida' using errcode = '22023'; end if;
  select kind into v_kind from public.allowed_recipients('ticket') where user_id = p_recipient;
  if v_kind is null then raise exception 'Destinatario no disponible' using errcode = '42501'; end if;
  if c.hr_only and v_kind <> 'hr' then raise exception 'Esta categoría solo puede dirigirse a Recursos Humanos' using errcode = '22023'; end if;
  insert into mgmt_tickets (organization_id, legal_entity_id, sender_id, recipient_id, category_id, subject, priority)
  values (e.organization_id, e.legal_entity_id, e.user_id, p_recipient, p_category, trim(p_subject), coalesce(p_priority, 'normal'))
  returning id into v_id;
  insert into mgmt_ticket_messages (ticket_id, author_id, body) values (v_id, e.user_id, trim(p_body));
  insert into mgmt_ticket_events (ticket_id, actor_id, to_status) values (v_id, e.user_id, 'received');
  perform app.notify(p_recipient, 'ticket', 'Nuevo mensaje institucional', null, '/gerencia/comunicaciones/' || v_id);
  return v_id;
end $$;

create or replace function public.reply_mgmt_ticket(p_ticket uuid, p_body text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare t mgmt_tickets;
begin
  select * into t from mgmt_tickets where id = p_ticket for update;
  if t.id is null or app.require_auth() not in (t.sender_id, t.recipient_id) then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  if t.status = 'closed' then raise exception 'La conversación está cerrada' using errcode = '22023'; end if;
  insert into mgmt_ticket_messages (ticket_id, author_id, body) values (p_ticket, auth.uid(), trim(p_body));
  if auth.uid() = t.recipient_id and t.status in ('received','in_review') then
    update mgmt_tickets set status = 'answered', updated_at = now() where id = p_ticket;
    insert into mgmt_ticket_events (ticket_id, actor_id, from_status, to_status) values (p_ticket, auth.uid(), t.status, 'answered');
  else
    update mgmt_tickets set updated_at = now() where id = p_ticket;
  end if;
  perform app.notify(case when auth.uid() = t.sender_id then t.recipient_id else t.sender_id end,
                     'ticket', 'Nueva respuesta en tu consulta #' || t.number, null,
                     case when auth.uid() = t.sender_id then '/gerencia/comunicaciones/' else '/gerencia-contacto/' end || p_ticket);
end $$;

create or replace function public.set_mgmt_ticket_status(p_ticket uuid, p_status text, p_priority text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare t mgmt_tickets;
begin
  select * into t from mgmt_tickets where id = p_ticket for update;
  if t.id is null then raise exception 'Conversación no disponible' using errcode = '42501'; end if;
  -- El remitente solo puede cerrar; el destinatario gestiona todos los estados.
  if not (auth.uid() = t.recipient_id or (auth.uid() = t.sender_id and p_status = 'closed' and p_priority is null)) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update mgmt_tickets set status = p_status, priority = coalesce(p_priority, priority), updated_at = now() where id = p_ticket;
  insert into mgmt_ticket_events (ticket_id, actor_id, from_status, to_status) values (p_ticket, auth.uid(), t.status, p_status);
  perform app.notify(case when auth.uid() = t.sender_id then t.recipient_id else t.sender_id end, 'ticket',
                     'Cambió el estado de la consulta #' || t.number, null, null);
end $$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.labor_rules enable row level security;
alter table public.shifts enable row level security;
alter table public.days_off enable row level security;
alter table public.shift_changes enable row level security;
alter table public.shift_swap_requests enable row level security;
alter table public.hr_requests enable row level security;
alter table public.meeting_requests enable row level security;
alter table public.mgmt_categories enable row level security;
alter table public.mgmt_tickets enable row level security;
alter table public.mgmt_ticket_messages enable row level security;
alter table public.mgmt_ticket_events enable row level security;

create policy rules_read on public.labor_rules for select to authenticated using (app.is_member(organization_id));
create policy rules_write on public.labor_rules for all to authenticated
  using (app.has_perm_org('org.manage', organization_id)) with check (app.has_perm_org('org.manage', organization_id));

create policy shifts_read on public.shifts for select to authenticated
  using ((user_id = auth.uid() and status <> 'draft') or app.has_perm_branch('schedules.view', branch_id));
create policy shifts_insert on public.shifts for insert to authenticated with check (app.has_perm_branch('schedules.manage', branch_id));
create policy shifts_update on public.shifts for update to authenticated
  using (app.has_perm_branch('schedules.manage', branch_id)) with check (app.has_perm_branch('schedules.manage', branch_id));
create policy shifts_delete on public.shifts for delete to authenticated using (app.has_perm_branch('schedules.manage', branch_id));

create policy days_off_read on public.days_off for select to authenticated
  using ((user_id = auth.uid() and status = 'published') or app.has_perm_branch('schedules.view', branch_id));
create policy days_off_write on public.days_off for all to authenticated
  using (app.has_perm_branch('schedules.manage', branch_id)) with check (app.has_perm_branch('schedules.manage', branch_id));

create policy shift_changes_read on public.shift_changes for select to authenticated
  using (user_id = auth.uid() or app.has_perm_branch('schedules.view', branch_id));

create policy swaps_read on public.shift_swap_requests for select to authenticated
  using (requester_id = auth.uid() or target_user_id = auth.uid()
         or exists (select 1 from shifts s where s.id = requester_shift_id and app.has_perm_branch('schedules.manage', s.branch_id)));

create policy hr_read on public.hr_requests for select to authenticated
  using (user_id = auth.uid() or app.has_perm_branch('requests.review', branch_id));

create policy meetings_read on public.meeting_requests for select to authenticated
  using (requester_id = auth.uid() or responder_id = auth.uid());

create policy cat_read on public.mgmt_categories for select to authenticated using (app.is_member(organization_id));
create policy cat_write on public.mgmt_categories for all to authenticated
  using (app.has_perm_org('org.manage', organization_id)) with check (app.has_perm_org('org.manage', organization_id));

-- Conversaciones institucionales: exclusivamente sus participantes.
create policy tickets_read on public.mgmt_tickets for select to authenticated using (auth.uid() in (sender_id, recipient_id));
create policy ticket_msgs_read on public.mgmt_ticket_messages for select to authenticated using (app.is_ticket_party(ticket_id));
create policy ticket_events_read on public.mgmt_ticket_events for select to authenticated using (app.is_ticket_party(ticket_id));

grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.labor_rules, public.shifts, public.days_off, public.mgmt_categories to authenticated;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema app to authenticated, service_role;

alter publication supabase_realtime add table public.mgmt_ticket_messages, public.shifts;
