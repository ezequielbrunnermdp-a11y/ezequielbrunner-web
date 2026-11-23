-- =====================================================================
-- FASE 4 · FICHAJE DIGITAL
-- Toda la validación ocurre en el servidor y con su reloj (now()).
-- Los registros son idempotentes (client_request_id) y transaccionales.
-- El sistema REDUCE el riesgo de fraude; no lo elimina: un QR puede
-- compartirse y una ubicación puede falsificarse.
-- =====================================================================

-- Dispositivos de sucursal (tablet de fichaje y/o pantalla de QR dinámico).
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  mode text not null default 'both' check (mode in ('kiosk','qr_display','both')),
  secret_hash bytea,                    -- sha256 del secreto del dispositivo (nunca el secreto)
  pairing_code_hash bytea,
  pairing_expires_at timestamptz,
  paired_at timestamptz,
  last_seen_at timestamptz,
  failed_pin_window_start timestamptz,
  failed_pin_count integer not null default 0,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.kiosk_devices (branch_id);
create unique index kiosk_secret_unique on public.kiosk_devices (secret_hash) where secret_hash is not null;

-- Tokens del QR dinámico: se almacena solo el hash; vigencia corta.
create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_id uuid not null references public.kiosk_devices(id) on delete cascade,
  token_hash bytea not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on public.qr_tokens (expires_at);

create table public.qr_token_uses (
  qr_token_id uuid not null references public.qr_tokens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (qr_token_id, user_id)
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  started_at timestamptz,               -- hora del servidor (o corregida aprobada)
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open','closed','needs_review')),
  created_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);
-- Como máximo una jornada abierta por persona.
create unique index attendance_one_open on public.attendance_sessions (user_id) where status = 'open';
create index on public.attendance_sessions (branch_id, started_at desc);
create index on public.attendance_sessions (user_id, started_at desc);

create table public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.attendance_sessions(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  kind text not null check (kind in ('in','out','break_start','break_end')),
  server_time timestamptz not null default now(),     -- hora oficial del registro
  declared_time timestamptz,                          -- hora declarada (sin conexión / corrección)
  source text not null check (source in ('mobile','kiosk','manual','offline','correction')),
  status text not null check (status in ('confirmed','pending_review','rejected')),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  distance_m double precision,
  geo_result text check (geo_result in ('inside','outside','imprecise','unavailable','not_required')),
  qr_token_id uuid references public.qr_tokens(id) on delete set null,
  device_id uuid references public.kiosk_devices(id) on delete set null,
  flags text[] not null default '{}',
  note text check (note is null or length(note) <= 500),
  client_request_id uuid,
  supersedes_id uuid references public.attendance_punches(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_by uuid references auth.users(id),
  unique (user_id, client_request_id)
);
create index on public.attendance_punches (branch_id, server_time desc);
create index on public.attendance_punches (user_id, server_time desc);
create index on public.attendance_punches (status) where status = 'pending_review';

-- Intentos fallidos o sospechosos (no son fichadas).
create table public.punch_attempts (
  id bigint generated always as identity primary key,
  organization_id uuid,
  branch_id uuid,
  user_id uuid,
  device_id uuid,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.punch_attempts (branch_id, created_at desc);
create index on public.punch_attempts (user_id, created_at desc);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  punch_id uuid references public.attendance_punches(id),
  session_id uuid references public.attendance_sessions(id),
  kind text not null check (kind in ('in','out','break_start','break_end')),
  requested_time timestamptz not null,
  reason text not null check (length(reason) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  result_punch_id uuid references public.attendance_punches(id),
  created_at timestamptz not null default now()
);
create index on public.attendance_corrections (branch_id, status);

-- Las fichadas no se borran ni se editan desde el cliente.
create or replace function app.punch_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Las fichadas no se eliminan' using errcode = '42501'; end if;
  if (new.server_time, new.user_id, new.kind, new.branch_id, new.source, new.declared_time)
     is distinct from (old.server_time, old.user_id, old.kind, old.branch_id, old.source, old.declared_time) then
    raise exception 'Los datos originales de una fichada no se modifican' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger punches_immutable before update or delete on public.attendance_punches
  for each row execute function app.punch_immutable();

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function app.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371008.8 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Clasificación de geolocalización:
--  inside     → el círculo de precisión cae dentro del perímetro configurado
--  outside    → incluso con el margen de precisión, queda fuera
--  imprecise  → la precisión reportada supera el máximo aceptado
--  unavailable→ sin coordenadas
create or replace function app.geo_classify(p_distance double precision, p_accuracy double precision, p_radius integer, p_max_accuracy integer)
returns text language sql immutable as $$
  select case
    when p_distance is null then 'unavailable'
    when p_accuracy is null or p_accuracy > p_max_accuracy then 'imprecise'
    when p_distance - least(p_accuracy, p_radius) <= p_radius then 'inside'
    else 'outside' end
$$;

create or replace function app.sha256(p text) returns bytea language sql immutable as $$
  select extensions.digest(convert_to(p, 'UTF8'), 'sha256')
$$;

create or replace function app.random_token(p_bytes int default 24) returns text language sql volatile as $$
  select translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/=', '-_')
$$;

-- Turno más cercano para asociar la fichada (soporta turnos nocturnos).
create or replace function app.match_shift(p_user uuid, p_branch uuid, p_kind text, p_at timestamptz) returns public.shifts
language sql stable security definer set search_path = public, pg_temp as $$
  select s.* from shifts s
  where s.user_id = p_user and s.status = 'published'
    and (p_branch is null or s.branch_id = p_branch)
    and case when p_kind = 'in' then p_at between s.starts_at - interval '4 hours' and s.ends_at
             else p_at between s.starts_at and s.ends_at + interval '6 hours' end
  order by abs(extract(epoch from (case when p_kind = 'in' then s.starts_at else s.ends_at end) - p_at))
  limit 1
$$;

-- ¿Puede la persona fichar en la sucursal? (principal, adicional autorizada o turno asignado)
create or replace function app.punch_employment(p_user uuid, p_branch uuid) returns public.employments
language sql stable security definer set search_path = public, pg_temp as $$
  select e.* from employments e
  join branches b on b.id = p_branch and b.legal_entity_id = e.legal_entity_id and b.status <> 'inactive'
  where e.user_id = p_user and e.status = 'active'
    and (e.primary_branch_id = p_branch
         or exists (select 1 from employment_branches eb where eb.employment_id = e.id and eb.branch_id = p_branch)
         or exists (select 1 from shifts s where s.user_id = p_user and s.branch_id = p_branch and s.status = 'published'
                    and now() between s.starts_at - interval '4 hours' and s.ends_at + interval '6 hours'))
  limit 1
$$;

-- Núcleo común para registrar una fichada (móvil, tablet, manual u offline).
create or replace function app.record_punch(
  p_user uuid, p_emp public.employments, p_branch uuid, p_kind text, p_source text, p_status text,
  p_lat double precision, p_lng double precision, p_accuracy double precision, p_distance double precision, p_geo text,
  p_qr uuid, p_device uuid, p_flags text[], p_note text, p_client_request_id uuid, p_declared timestamptz,
  p_effective_time timestamptz default null
) returns public.attendance_punches
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_open attendance_sessions; v_shift shifts; v_punch attendance_punches; v_flags text[] := coalesce(p_flags, '{}');
        v_b branches; v_at timestamptz := coalesce(p_effective_time, now()); v_session uuid;
begin
  select * into v_b from branches where id = p_branch;
  -- Serializa las fichadas de la misma persona (evita carreras por doble toque).
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into v_open from attendance_sessions where user_id = p_user and status = 'open' for update;
  v_shift := app.match_shift(p_user, p_branch, p_kind, v_at);

  if p_kind = 'in' then
    if v_open.id is not null then
      v_flags := array_append(v_flags, ('already_open')::text);
      if p_status = 'confirmed' then
        -- Ya hay una jornada abierta: no se abre otra. Se registra como intento duplicado.
        insert into punch_attempts (organization_id, branch_id, user_id, device_id, reason, details)
        values (v_b.organization_id, p_branch, p_user, p_device, 'duplicate_in', jsonb_build_object('open_session', v_open.id));
        raise exception 'Ya tenés una jornada abierta desde las %. Registrá la salida primero.',
          to_char(v_open.started_at at time zone v_b.timezone, 'HH24:MI') using errcode = 'P0001', hint = 'already_open';
      end if;
    end if;
    if v_shift.id is not null and v_at > v_shift.starts_at + make_interval(mins => v_b.late_tolerance_min) then
      v_flags := array_append(v_flags, ('late')::text);
    end if;
    if v_shift.id is null then v_flags := array_append(v_flags, 'no_shift'::text); end if;
  elsif p_kind = 'out' then
    if v_open.id is null then v_flags := array_append(v_flags, 'out_without_in'::text); end if;
    if v_shift.id is not null and v_at < v_shift.ends_at - make_interval(mins => v_b.early_leave_tolerance_min) then
      v_flags := array_append(v_flags, ('early_leave')::text);
    end if;
    if v_open.id is not null and v_at - v_open.started_at > make_interval(hours => v_b.max_open_hours) then
      v_flags := array_append(v_flags, ('long_session')::text);
    end if;
  else
    if v_open.id is null then v_flags := array_append(v_flags, 'break_without_session'::text); end if;
  end if;

  -- Una salida sin ingreso nunca se confirma automáticamente.
  if 'out_without_in' = any(v_flags) or 'break_without_session' = any(v_flags) then
    p_status := 'pending_review';
  end if;

  if p_status = 'confirmed' then
    if p_kind = 'in' then
      insert into attendance_sessions (organization_id, legal_entity_id, branch_id, user_id, shift_id, started_at, status)
      values (v_b.organization_id, v_b.legal_entity_id, p_branch, p_user, v_shift.id, v_at, 'open') returning id into v_session;
    elsif p_kind = 'out' and v_open.id is not null then
      update attendance_sessions set ended_at = v_at, status = 'closed' where id = v_open.id;
      v_session := v_open.id;
    else
      v_session := v_open.id;
    end if;
  else
    v_session := v_open.id;
  end if;

  insert into attendance_punches (organization_id, legal_entity_id, branch_id, user_id, session_id, shift_id, kind, server_time,
    declared_time, source, status, lat, lng, accuracy_m, distance_m, geo_result, qr_token_id, device_id, flags, note,
    client_request_id, created_by)
  values (v_b.organization_id, v_b.legal_entity_id, p_branch, p_user, v_session, v_shift.id, p_kind, now(),
    p_declared, p_source, p_status, p_lat, p_lng, p_accuracy, p_distance, p_geo, p_qr, p_device, v_flags, p_note,
    p_client_request_id, auth.uid())
  returning * into v_punch;

  if p_status = 'pending_review' then
    perform app.notify(ra.user_id, 'attendance_review', 'Hay una fichada para revisar', null, '/gerencia/asistencia')
    from (select distinct ra.user_id from role_assignments ra
          join role_permissions rp on rp.role_id = ra.role_id and rp.permission_key = 'attendance.manage'
          where ra.organization_id = v_b.organization_id
            and ((ra.scope_type = 'organization') or (ra.scope_type = 'legal_entity' and ra.scope_id = v_b.legal_entity_id)
                 or (ra.scope_type = 'branch' and ra.scope_id = v_b.id))) ra;
  end if;
  return v_punch;
end $$;

create or replace function app.punch_result(p attendance_punches, p_code text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'result', p_code, 'punch_id', p.id, 'kind', p.kind, 'status', p.status, 'server_time', p.server_time,
    'branch_id', p.branch_id, 'branch_name', (select name from branches where id = p.branch_id),
    'flags', p.flags, 'geo_result', p.geo_result, 'distance_m', round(p.distance_m::numeric, 0))
$$;

-- =====================================================================
-- MODALIDAD A · Fichaje móvil con GPS + QR dinámico
-- =====================================================================
-- Resultados posibles (campo result):
--   confirmed           → fichada confirmada por el servidor
--   pending_review      → registrada como pendiente de revisión humana (no confirmada)
--   duplicate           → reintento idempotente: devuelve la fichada original
--   qr_required / qr_invalid / qr_expired / qr_reused / qr_wrong_branch → rechazada (no registrada)
--   geo_outside / geo_imprecise / geo_unavailable → no confirmada; puede pedirse revisión (p_request_review)
create or replace function public.clock_punch(
  p_kind text,
  p_branch_id uuid,
  p_qr_token text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null,
  p_client_request_id uuid default null,
  p_request_review boolean default false,
  p_note text default null,
  p_declared_time timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); v_emp employments; v_b branches; v_qr qr_tokens; v_existing attendance_punches;
        v_distance double precision; v_geo text; v_flags text[] := '{}'; v_punch attendance_punches; v_qr_ok boolean := false;
        v_status text; v_source text := 'mobile'; v_qr_problem text;
begin
  if p_kind not in ('in','out','break_start','break_end') then raise exception 'Tipo de fichada inválido' using errcode = '22023'; end if;
  if p_client_request_id is null then raise exception 'Falta el identificador de operación' using errcode = '22023'; end if;

  -- Idempotencia: el mismo pedido repetido devuelve el registro original.
  select * into v_existing from attendance_punches where user_id = me and client_request_id = p_client_request_id;
  if v_existing.id is not null then return app.punch_result(v_existing, 'duplicate'); end if;

  -- Límite de intentos por persona.
  if (select count(*) from punch_attempts where user_id = me and created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'Demasiados intentos. Esperá unos minutos o pedí ayuda a tu encargado.' using errcode = '54000';
  end if;

  select * into v_b from branches where id = p_branch_id;
  v_emp := app.punch_employment(me, p_branch_id);
  if v_b.id is null or v_emp.id is null then
    insert into punch_attempts (user_id, branch_id, reason) values (me, p_branch_id, 'branch_not_allowed');
    return jsonb_build_object('result', 'branch_not_allowed');
  end if;

  -- Sin conexión: se registra la hora declarada y la de recepción, siempre pendiente de validación.
  if p_declared_time is not null then
    v_punch := app.record_punch(me, v_emp, p_branch_id, p_kind, 'offline', 'pending_review', p_lat, p_lng, p_accuracy,
      case when p_lat is not null and v_b.lat is not null then app.haversine_m(p_lat, p_lng, v_b.lat, v_b.lng) end,
      'unavailable', null, null, array['offline_declared'], p_note, p_client_request_id, p_declared_time);
    return app.punch_result(v_punch, 'pending_review');
  end if;

  -- Ingreso con jornada ya abierta: no se registra (se informa la jornada vigente).
  if p_kind = 'in' and exists (select 1 from attendance_sessions where user_id = me and status = 'open') then
    insert into punch_attempts (organization_id, branch_id, user_id, reason) values (v_b.organization_id, p_branch_id, me, 'duplicate_in');
    return jsonb_build_object('result', 'already_open',
      'open_since', (select started_at from attendance_sessions where user_id = me and status = 'open'));
  end if;

  -- QR dinámico
  if v_b.require_qr then
    if p_qr_token is null or length(p_qr_token) < 16 then
      v_qr_problem := 'qr_required';
    else
      select * into v_qr from qr_tokens where token_hash = app.sha256(p_qr_token);
      if v_qr.id is null then v_qr_problem := 'qr_invalid';
      elsif v_qr.branch_id <> p_branch_id then v_qr_problem := 'qr_wrong_branch';
      elsif v_qr.expires_at < now() then v_qr_problem := 'qr_expired';
      elsif exists (select 1 from qr_token_uses where qr_token_id = v_qr.id and user_id = me) then v_qr_problem := 'qr_reused';
      else v_qr_ok := true;
      end if;
    end if;
    if v_qr_problem is not null then
      insert into punch_attempts (organization_id, branch_id, user_id, reason, details)
      values (v_b.organization_id, p_branch_id, me, v_qr_problem, jsonb_build_object('kind', p_kind, 'token_id', v_qr.id));
      return jsonb_build_object('result', v_qr_problem);
    end if;
  else
    v_flags := array_append(v_flags, ('qr_not_required')::text);
  end if;

  -- Geolocalización
  if v_b.require_gps then
    if v_b.lat is null or v_b.lng is null then
      v_geo := 'unavailable'; v_flags := array_append(v_flags, ('branch_without_coordinates')::text);
    else
      if p_lat is not null and p_lng is not null then
        v_distance := app.haversine_m(p_lat, p_lng, v_b.lat, v_b.lng);
      end if;
      v_geo := app.geo_classify(v_distance, p_accuracy, v_b.geofence_radius_m, v_b.gps_max_accuracy_m);
    end if;
  else
    v_geo := 'not_required';
  end if;

  if v_geo in ('inside','not_required') then
    v_status := 'confirmed';
  elsif p_request_review then
    v_status := 'pending_review';
    v_flags := array_append(v_flags, (('geo_' || v_geo))::text);
  else
    insert into punch_attempts (organization_id, branch_id, user_id, reason, details)
    values (v_b.organization_id, p_branch_id, me, 'geo_' || v_geo,
            jsonb_build_object('distance_m', round(v_distance::numeric, 1), 'accuracy_m', p_accuracy, 'radius_m', v_b.geofence_radius_m));
    return jsonb_build_object('result', 'geo_' || v_geo, 'distance_m', round(v_distance::numeric, 0),
                              'accuracy_m', round(p_accuracy::numeric, 0), 'radius_m', v_b.geofence_radius_m,
                              'review_available', true);
  end if;

  v_punch := app.record_punch(me, v_emp, p_branch_id, p_kind, v_source, v_status, p_lat, p_lng, p_accuracy, v_distance, v_geo,
                              case when v_qr_ok then v_qr.id end, null, v_flags, p_note, p_client_request_id, null);
  if v_qr_ok then
    insert into qr_token_uses (qr_token_id, user_id) values (v_qr.id, me);
  end if;
  return app.punch_result(v_punch, v_punch.status);
end $$;

-- Estado actual del empleado para la pantalla de fichaje.
create or replace function public.my_clock_status() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'server_time', now(),
    'open_session', (select jsonb_build_object('id', s.id, 'started_at', s.started_at, 'branch_id', s.branch_id,
                             'branch_name', b.name,
                             'on_break', exists (select 1 from attendance_punches p where p.session_id = s.id and p.status = 'confirmed'
                                                 and p.kind in ('break_start','break_end')
                                                 and p.kind = 'break_start'
                                                 and not exists (select 1 from attendance_punches p2 where p2.session_id = s.id and p2.kind = 'break_end'
                                                                 and p2.status = 'confirmed' and p2.server_time > p.server_time)))
                     from attendance_sessions s join branches b on b.id = s.branch_id
                     where s.user_id = auth.uid() and s.status = 'open'),
    'next_shift', (select jsonb_build_object('id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'branch_id', s.branch_id, 'branch_name', b.name)
                   from shifts s join branches b on b.id = s.branch_id
                   where s.user_id = auth.uid() and s.status = 'published' and s.ends_at > now()
                   order by s.starts_at limit 1),
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'require_qr', b.require_qr, 'require_gps', b.require_gps,
                                                              'radius_m', b.geofence_radius_m, 'has_coordinates', b.lat is not null)
                                           order by (b.id = e.primary_branch_id) desc, b.name), '[]'::jsonb)
                 from employments e
                 join branches b on b.legal_entity_id = e.legal_entity_id and b.status <> 'inactive'
                   and (b.id = e.primary_branch_id
                        or exists (select 1 from employment_branches eb where eb.employment_id = e.id and eb.branch_id = b.id)
                        or exists (select 1 from shifts s where s.user_id = e.user_id and s.branch_id = b.id and s.status = 'published'
                                   and now() between s.starts_at - interval '4 hours' and s.ends_at + interval '6 hours'))
                 where e.user_id = auth.uid() and e.status = 'active')
  )
$$;

create or replace function public.my_attendance(p_from timestamptz, p_to timestamptz)
returns table (session_id uuid, branch_name text, started_at timestamptz, ended_at timestamptz, status text,
               minutes integer, shift_starts timestamptz, shift_ends timestamptz, punches jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, b.name, s.started_at, s.ended_at, s.status,
         case when s.ended_at is not null then (extract(epoch from s.ended_at - s.started_at) / 60)::int end,
         sh.starts_at, sh.ends_at,
         (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'server_time', p.server_time, 'status', p.status,
                                  'source', p.source, 'flags', p.flags, 'declared_time', p.declared_time) order by p.server_time), '[]')
            from attendance_punches p where p.session_id = s.id)
  from attendance_sessions s join branches b on b.id = s.branch_id left join shifts sh on sh.id = s.shift_id
  where s.user_id = auth.uid() and s.started_at >= p_from and s.started_at < p_to
  union all
  -- Fichadas sin jornada (p. ej. salida sin ingreso o pendientes)
  select null, b.name, null, p.server_time, p.status, null, null, null,
         jsonb_build_array(jsonb_build_object('id', p.id, 'kind', p.kind, 'server_time', p.server_time, 'status', p.status,
                           'source', p.source, 'flags', p.flags, 'declared_time', p.declared_time))
  from attendance_punches p join branches b on b.id = p.branch_id
  where p.user_id = auth.uid() and p.session_id is null and p.server_time >= p_from and p.server_time < p_to
  order by 3 desc nulls last, 4 desc
$$;

-- =====================================================================
-- Dispositivos: alta, vinculación, QR y MODALIDAD B (tablet kiosco)
-- =====================================================================
create or replace function public.register_kiosk_device(p_branch uuid, p_name text, p_mode text default 'both')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text; v_id uuid; v_org uuid;
begin
  if not app.has_perm_branch('kiosk.manage', p_branch) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select organization_id into v_org from branches where id = p_branch;
  -- Código de vinculación de 8 caracteres, válido 15 minutos, de un solo uso.
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1lI', ''), 1, 8));
  insert into kiosk_devices (organization_id, branch_id, name, mode, pairing_code_hash, pairing_expires_at, created_by)
  values (v_org, p_branch, trim(p_name), p_mode, app.sha256(v_code), now() + interval '15 minutes', auth.uid())
  returning id into v_id;
  perform app.audit(v_org, 'kiosk.register', 'kiosk_device', v_id::text, jsonb_build_object('branch', p_branch, 'mode', p_mode));
  return jsonb_build_object('device_id', v_id, 'pairing_code', v_code, 'expires_at', now() + interval '15 minutes');
end $$;

-- La tablet (sin sesión de usuario) canjea el código por un secreto de dispositivo.
create or replace function public.kiosk_pair(p_code text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d kiosk_devices; v_secret text;
begin
  select * into d from kiosk_devices
  where pairing_code_hash = app.sha256(upper(trim(p_code))) and pairing_expires_at > now() and revoked_at is null
  for update;
  if d.id is null then
    insert into punch_attempts (reason, details) values ('kiosk_pair_failed', '{}');
    perform pg_sleep(0.5);
    raise exception 'Código inválido o vencido' using errcode = '42501';
  end if;
  v_secret := app.random_token(32);
  update kiosk_devices set secret_hash = app.sha256(v_secret), pairing_code_hash = null, pairing_expires_at = null,
         paired_at = now(), last_seen_at = now() where id = d.id;
  perform app.audit(d.organization_id, 'kiosk.paired', 'kiosk_device', d.id::text, '{}');
  return jsonb_build_object('device_secret', v_secret, 'device_id', d.id, 'mode', d.mode,
                            'branch_name', (select name from branches where id = d.branch_id));
end $$;

create or replace function app.kiosk_device(p_secret text) returns public.kiosk_devices
language plpgsql security definer set search_path = public, pg_temp as $$
declare d kiosk_devices;
begin
  if p_secret is null or length(p_secret) < 20 then raise exception 'Dispositivo no autorizado' using errcode = '42501'; end if;
  select * into d from kiosk_devices where secret_hash = app.sha256(p_secret) and revoked_at is null;
  if d.id is null then raise exception 'Dispositivo no autorizado' using errcode = '42501'; end if;
  update kiosk_devices set last_seen_at = now() where id = d.id;
  return d;
end $$;

create or replace function public.kiosk_info(p_device_secret text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d kiosk_devices;
begin
  d := app.kiosk_device(p_device_secret);
  return jsonb_build_object('device_id', d.id, 'name', d.name, 'mode', d.mode, 'server_time', now(),
    'branch', (select jsonb_build_object('id', b.id, 'name', b.name, 'brand', br.name, 'brand_logo', br.logo_path)
               from branches b join brands br on br.id = b.brand_id where b.id = d.branch_id));
end $$;

-- Emite un token de QR (rotación ~30 s; vigencia 45 s para tolerar el escaneo).
create or replace function public.kiosk_issue_qr(p_device_secret text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d kiosk_devices; v_token text; v_exp timestamptz := now() + interval '45 seconds';
begin
  d := app.kiosk_device(p_device_secret);
  if d.mode not in ('qr_display','both') then raise exception 'Dispositivo sin modo QR' using errcode = '42501'; end if;
  if (select count(*) from qr_tokens where device_id = d.id and issued_at > now() - interval '10 seconds') >= 3 then
    raise exception 'Demasiadas solicitudes' using errcode = '54000';
  end if;
  v_token := app.random_token(24);
  insert into qr_tokens (branch_id, device_id, token_hash, expires_at) values (d.branch_id, d.id, app.sha256(v_token), v_exp);
  delete from qr_tokens where expires_at < now() - interval '1 day' and device_id = d.id
    and not exists (select 1 from attendance_punches p where p.qr_token_id = qr_tokens.id);
  return jsonb_build_object('token', v_token, 'branch_id', d.branch_id, 'expires_at', v_exp, 'refresh_in', 30, 'server_time', now());
end $$;

-- Fichaje en tablet: código de empleado + PIN personal, con bloqueo por intentos.
create or replace function public.kiosk_punch(p_device_secret text, p_employee_code text, p_pin text, p_kind text, p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d kiosk_devices; e employments; v_b branches; v_existing attendance_punches; v_punch attendance_punches; v_name text;
begin
  d := app.kiosk_device(p_device_secret);
  if d.mode not in ('kiosk','both') then raise exception 'Dispositivo sin modo kiosco' using errcode = '42501'; end if;
  if p_kind not in ('in','out','break_start','break_end') then raise exception 'Tipo de fichada inválido' using errcode = '22023'; end if;
  select * into v_b from branches where id = d.branch_id;

  -- Límite por dispositivo: 20 PIN fallidos en 15 minutos bloquean la tablet temporalmente.
  if d.failed_pin_window_start > now() - interval '15 minutes' and d.failed_pin_count >= 20 then
    raise exception 'Tablet bloqueada temporalmente por intentos fallidos. Avisá a tu encargado.' using errcode = '54000';
  end if;

  select * into e from employments
  where legal_entity_id = v_b.legal_entity_id and upper(employee_code) = upper(trim(p_employee_code)) and status = 'active'
  for update;

  if e.id is not null and e.kiosk_locked_until > now() then
    raise exception 'Tu PIN está bloqueado temporalmente. Esperá o pedí ayuda a tu encargado.' using errcode = '54000';
  end if;

  if e.id is null or e.kiosk_pin_hash is null or e.kiosk_pin_hash <> extensions.crypt(coalesce(p_pin, ''), e.kiosk_pin_hash) then
    update kiosk_devices set
      failed_pin_count = case when failed_pin_window_start > now() - interval '15 minutes' then failed_pin_count + 1 else 1 end,
      failed_pin_window_start = case when failed_pin_window_start > now() - interval '15 minutes' then failed_pin_window_start else now() end
    where id = d.id;
    if e.id is not null then
      update employments set kiosk_failed_attempts = kiosk_failed_attempts + 1,
        kiosk_locked_until = case when kiosk_failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
      where id = e.id;
    end if;
    insert into punch_attempts (organization_id, branch_id, user_id, device_id, reason)
    values (v_b.organization_id, v_b.id, e.user_id, d.id, 'kiosk_bad_credentials');
    -- Mismo mensaje para código inexistente o PIN incorrecto: evita enumeración.
    return jsonb_build_object('result', 'bad_credentials');
  end if;

  update employments set kiosk_failed_attempts = 0, kiosk_locked_until = null where id = e.id;

  select * into v_existing from attendance_punches where user_id = e.user_id and client_request_id = p_client_request_id;
  if v_existing.id is not null then return app.punch_result(v_existing, 'duplicate'); end if;

  if app.punch_employment(e.user_id, v_b.id) is null then
    insert into punch_attempts (organization_id, branch_id, user_id, device_id, reason) values (v_b.organization_id, v_b.id, e.user_id, d.id, 'branch_not_allowed');
    return jsonb_build_object('result', 'branch_not_allowed');
  end if;

  -- El dispositivo vinculado a la sucursal actúa como prueba de presencia (geo_result not_required).
  begin
    v_punch := app.record_punch(e.user_id, e, v_b.id, p_kind, 'kiosk', 'confirmed', null, null, null, null, 'not_required',
                                null, d.id, '{}', null, p_client_request_id, null);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('result', 'already_open', 'message', sqlerrm);
  end;
  select first_name into v_name from profiles where user_id = e.user_id;
  return app.punch_result(v_punch, v_punch.status) || jsonb_build_object('first_name', v_name);
end $$;

create or replace function public.set_kiosk_pin(p_pin text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_pin !~ '^\d{6}$' then raise exception 'El PIN debe tener 6 dígitos' using errcode = '22023'; end if;
  if p_pin in ('000000','111111','123456','654321','222222','999999','121212') then
    raise exception 'Elegí un PIN menos predecible' using errcode = '22023';
  end if;
  update employments set kiosk_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), kiosk_failed_attempts = 0, kiosk_locked_until = null
   where user_id = app.require_auth() and status = 'active';
end $$;

create or replace function public.revoke_kiosk_device(p_device uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare d kiosk_devices;
begin
  select * into d from kiosk_devices where id = p_device;
  if d.id is null or not app.has_perm_branch('kiosk.manage', d.branch_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update kiosk_devices set revoked_at = now(), secret_hash = null where id = p_device;
  delete from qr_tokens where device_id = p_device and expires_at > now();
  perform app.audit(d.organization_id, 'kiosk.revoke', 'kiosk_device', p_device::text, '{}');
end $$;

-- =====================================================================
-- Contingencias y correcciones (conservan siempre el dato original)
-- =====================================================================
-- Fichada supervisada por un responsable (empleado sin teléfono, fallas, etc.).
create or replace function public.manual_punch(p_user uuid, p_branch uuid, p_kind text, p_reason text, p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_emp employments; v_punch attendance_punches; v_existing attendance_punches;
begin
  if not app.has_perm_branch('attendance.manage', p_branch) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'No podés registrar tu propia fichada supervisada' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Indicá el motivo' using errcode = '22023'; end if;
  select * into v_existing from attendance_punches where user_id = p_user and client_request_id = p_client_request_id;
  if v_existing.id is not null then return app.punch_result(v_existing, 'duplicate'); end if;
  v_emp := app.punch_employment(p_user, p_branch);
  if v_emp.id is null then return jsonb_build_object('result', 'branch_not_allowed'); end if;
  v_punch := app.record_punch(p_user, v_emp, p_branch, p_kind, 'manual', 'confirmed', null, null, null, null, 'not_required',
                              null, null, array['supervised'], trim(p_reason), p_client_request_id, null);
  perform app.audit(v_emp.organization_id, 'attendance.manual_punch', 'attendance_punch', v_punch.id::text,
                    jsonb_build_object('user', p_user, 'kind', p_kind, 'reason', p_reason));
  perform app.notify(p_user, 'attendance', 'Se registró una fichada supervisada', null, '/fichaje/historial');
  return app.punch_result(v_punch, v_punch.status);
end $$;

create or replace function public.request_attendance_correction(p_branch uuid, p_kind text, p_requested_time timestamptz,
                                                                p_reason text, p_punch uuid default null, p_session uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := app.require_auth(); v_id uuid; v_org uuid;
begin
  if app.punch_employment(me, p_branch) is null and not exists (
       select 1 from attendance_sessions where id = p_session and user_id = me) then
    raise exception 'Sucursal no disponible' using errcode = '42501';
  end if;
  if p_requested_time > now() + interval '5 minutes' or p_requested_time < now() - interval '60 days' then
    raise exception 'La hora solicitada está fuera del rango permitido' using errcode = '22023';
  end if;
  if p_punch is not null and not exists (select 1 from attendance_punches where id = p_punch and user_id = me) then
    raise exception 'Fichada no disponible' using errcode = '42501';
  end if;
  select organization_id into v_org from branches where id = p_branch;
  insert into attendance_corrections (organization_id, branch_id, user_id, punch_id, session_id, kind, requested_time, reason)
  values (v_org, p_branch, me, p_punch, p_session, p_kind, p_requested_time, trim(p_reason)) returning id into v_id;
  return v_id;
end $$;

-- Aprobar una corrección crea una fichada nueva (source=correction) y deja intacta la original.
create or replace function public.review_attendance_correction(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare c attendance_corrections; v_b branches; v_punch_id uuid; v_session uuid; v_open attendance_sessions;
begin
  select * into c from attendance_corrections where id = p_id for update;
  if c.id is null or c.status <> 'pending' or not app.has_perm_branch('attendance.manage', c.branch_id) then
    raise exception 'Corrección no disponible' using errcode = '42501';
  end if;
  if c.user_id = auth.uid() then raise exception 'No podés aprobar tus propias correcciones' using errcode = '42501'; end if;
  select * into v_b from branches where id = c.branch_id;
  if p_approve then
    perform pg_advisory_xact_lock(hashtextextended(c.user_id::text, 0));
    v_session := c.session_id;
    if c.kind = 'in' then
      if v_session is null then
        insert into attendance_sessions (organization_id, legal_entity_id, branch_id, user_id, shift_id, started_at, status)
        values (v_b.organization_id, v_b.legal_entity_id, c.branch_id, c.user_id,
                (app.match_shift(c.user_id, c.branch_id, 'in', c.requested_time)).id, c.requested_time,
                case when exists (select 1 from attendance_sessions where user_id = c.user_id and status = 'open') then 'needs_review' else 'open' end)
        returning id into v_session;
      else
        update attendance_sessions set started_at = c.requested_time where id = v_session and user_id = c.user_id;
      end if;
    elsif c.kind = 'out' then
      if v_session is null then
        select * into v_open from attendance_sessions where user_id = c.user_id and status = 'open'
          and started_at < c.requested_time;
        v_session := v_open.id;
      end if;
      if v_session is not null then
        update attendance_sessions set ended_at = c.requested_time, status = 'closed' where id = v_session and user_id = c.user_id;
      end if;
    end if;
    insert into attendance_punches (organization_id, legal_entity_id, branch_id, user_id, session_id, kind, declared_time,
      source, status, geo_result, flags, note, supersedes_id, reviewed_by, reviewed_at, review_note, created_by)
    values (v_b.organization_id, v_b.legal_entity_id, c.branch_id, c.user_id, v_session, c.kind, c.requested_time,
      'correction', 'confirmed', 'not_required', array['correction'], c.reason, c.punch_id, auth.uid(), now(), p_note, auth.uid())
    returning id into v_punch_id;
  end if;
  update attendance_corrections set status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note, result_punch_id = v_punch_id where id = p_id;
  perform app.audit(v_b.organization_id, 'attendance.correction.' || case when p_approve then 'approve' else 'reject' end,
                    'attendance_correction', p_id::text, jsonb_build_object('user', c.user_id, 'requested_time', c.requested_time));
  perform app.notify(c.user_id, 'attendance', case when p_approve then 'Se aprobó tu corrección de fichaje' else 'Se rechazó tu corrección de fichaje' end, null, '/fichaje/historial');
end $$;

-- Revisión de fichadas pendientes (fuera de perímetro, offline, salida sin ingreso…).
create or replace function public.review_punch(p_punch uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare p attendance_punches; v_open attendance_sessions; v_at timestamptz; v_b branches;
begin
  select * into p from attendance_punches where id = p_punch for update;
  if p.id is null or p.status <> 'pending_review' or not app.has_perm_branch('attendance.manage', p.branch_id) then
    raise exception 'Fichada no disponible' using errcode = '42501';
  end if;
  if p.user_id = auth.uid() then raise exception 'No podés revisar tus propias fichadas' using errcode = '42501'; end if;
  select * into v_b from branches where id = p.branch_id;
  v_at := coalesce(p.declared_time, p.server_time);
  if p_approve then
    perform pg_advisory_xact_lock(hashtextextended(p.user_id::text, 0));
    select * into v_open from attendance_sessions where user_id = p.user_id and status = 'open' for update;
    if p.kind = 'in' then
      if v_open.id is null then
        insert into attendance_sessions (organization_id, legal_entity_id, branch_id, user_id, shift_id, started_at, status)
        values (p.organization_id, p.legal_entity_id, p.branch_id, p.user_id, p.shift_id, v_at, 'open') returning id into v_open.id;
      end if;
      update attendance_punches set session_id = v_open.id where id = p_punch;
    elsif p.kind = 'out' and v_open.id is not null then
      update attendance_sessions set ended_at = greatest(v_at, v_open.started_at), status = 'closed' where id = v_open.id;
      update attendance_punches set session_id = v_open.id where id = p_punch;
    end if;
  end if;
  update attendance_punches set status = case when p_approve then 'confirmed' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note where id = p_punch;
  perform app.audit(p.organization_id, 'attendance.punch.' || case when p_approve then 'approve' else 'reject' end,
                    'attendance_punch', p_punch::text, jsonb_build_object('user', p.user_id));
  perform app.notify(p.user_id, 'attendance', case when p_approve then 'Se validó tu fichada pendiente' else 'No se validó tu fichada pendiente' end, null, '/fichaje/historial');
end $$;

-- Cierre administrativo de una jornada que quedó abierta.
create or replace function public.close_session(p_session uuid, p_ended_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s attendance_sessions;
begin
  select * into s from attendance_sessions where id = p_session for update;
  if s.id is null or not app.has_perm_branch('attendance.manage', s.branch_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if s.status <> 'open' then raise exception 'La jornada no está abierta' using errcode = '22023'; end if;
  if p_ended_at < s.started_at then raise exception 'La salida no puede ser anterior al ingreso' using errcode = '22023'; end if;
  insert into attendance_punches (organization_id, legal_entity_id, branch_id, user_id, session_id, kind, declared_time, source, status,
    geo_result, flags, note, reviewed_by, reviewed_at, created_by)
  values (s.organization_id, s.legal_entity_id, s.branch_id, s.user_id, s.id, 'out', p_ended_at, 'correction', 'confirmed',
    'not_required', array['admin_close'], p_reason, auth.uid(), now(), auth.uid());
  update attendance_sessions set ended_at = p_ended_at, status = 'closed' where id = p_session;
  perform app.audit(s.organization_id, 'attendance.session.close', 'attendance_session', p_session::text, jsonb_build_object('ended_at', p_ended_at, 'reason', p_reason));
end $$;

-- =====================================================================
-- Panel de asistencia (alertas automáticas ≠ sanciones; requieren revisión)
-- =====================================================================
create or replace function public.attendance_board(p_day date, p_branch uuid default null)
returns table (
  user_id uuid, first_name text, last_name text, avatar_path text, branch_id uuid, branch_name text,
  shift_id uuid, shift_starts timestamptz, shift_ends timestamptz,
  session_id uuid, actual_in timestamptz, actual_out timestamptz, session_status text,
  state text, alerts text[], pending_punches integer
) language sql stable security definer set search_path = public, pg_temp as $$
  with scope as (select id, timezone, late_tolerance_min, early_leave_tolerance_min, max_open_hours, name
                 from branches where id in (select app.perm_branches('attendance.view'))
                   and (p_branch is null or id = p_branch)),
  win as (select s.*, (p_day::timestamp at time zone s.timezone) as d0, ((p_day + 1)::timestamp at time zone s.timezone) as d1 from scope s),
  sh as (
    select distinct on (x.user_id, x.branch_id) x.*, w.name as bname, w.late_tolerance_min, w.early_leave_tolerance_min, w.max_open_hours
    from shifts x join win w on w.id = x.branch_id
    where x.status = 'published' and x.starts_at >= w.d0 and x.starts_at < w.d1
    order by x.user_id, x.branch_id, x.starts_at
  ),
  se as (
    select distinct on (a.user_id, a.branch_id) a.*, w.name as bname, w.max_open_hours
    from attendance_sessions a join win w on w.id = a.branch_id
    where (a.started_at >= w.d0 and a.started_at < w.d1) or (a.status = 'open' and a.started_at < w.d1)
    order by a.user_id, a.branch_id, a.started_at
  ),
  people as (
    select coalesce(sh.user_id, se.user_id) as uid, coalesce(sh.branch_id, se.branch_id) as bid,
           coalesce(sh.bname, se.bname) as bname, sh.id as shid, sh.starts_at, sh.ends_at,
           se.id as seid, se.started_at, se.ended_at, se.status as sestatus,
           coalesce(sh.late_tolerance_min, 10) as tol, coalesce(sh.early_leave_tolerance_min, 10) as etol,
           coalesce(se.max_open_hours, sh.max_open_hours, 14) as maxh
    from sh full join se on se.user_id = sh.user_id and se.branch_id = sh.branch_id
  )
  select p.uid, pr.first_name, pr.last_name, pr.avatar_path, p.bid, p.bname, p.shid, p.starts_at, p.ends_at,
         p.seid, p.started_at, p.ended_at, p.sestatus,
         case
           when p.seid is null and p.shid is not null and now() < p.starts_at then 'scheduled'
           when p.seid is null and p.shid is not null and now() <= p.starts_at + make_interval(mins => p.tol) then 'expected'
           when p.seid is null and p.shid is not null then 'missing_punch'       -- ausencia pendiente de verificar
           when p.sestatus = 'open' then 'working'
           when p.sestatus = 'closed' then 'completed'
           else 'review' end,
         array_remove(array[
           case when p.seid is null and p.shid is not null and now() > p.starts_at + make_interval(mins => p.tol) then 'no_punch_after_start' end,
           case when p.started_at > p.starts_at + make_interval(mins => p.tol) then 'late' end,
           case when p.ended_at < p.ends_at - make_interval(mins => p.etol) then 'early_leave' end,
           case when p.sestatus = 'open' and now() - p.started_at > make_interval(hours => p.maxh) then 'long_open_session' end,
           case when p.shid is null then 'no_shift' end,
           case when p.sestatus = 'open' and p.ends_at is not null and now() > p.ends_at + interval '2 hours' then 'not_closed' end
         ], null),
         (select count(*)::int from attendance_punches ap where ap.user_id = p.uid and ap.branch_id = p.bid and ap.status = 'pending_review')
  from people p left join profiles pr on pr.user_id = p.uid
  order by p.bname, pr.first_name
$$;

create or replace function public.attendance_kpis(p_day date, p_branch uuid default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with b as (select * from public.attendance_board(p_day, p_branch))
  select jsonb_build_object(
    'scheduled', (select count(*) from b where shift_id is not null),
    'checked_in', (select count(*) from b where session_id is not null),
    'working', (select count(*) from b where state = 'working'),
    'late', (select count(*) from b where 'late' = any(alerts)),
    'early_leave', (select count(*) from b where 'early_leave' = any(alerts)),
    'missing', (select count(*) from b where state = 'missing_punch'),
    'not_closed', (select count(*) from b where 'not_closed' = any(alerts) or 'long_open_session' = any(alerts)),
    'pending_corrections', (select count(*) from attendance_corrections c where c.status = 'pending'
                              and c.branch_id in (select app.perm_branches('attendance.manage')) and (p_branch is null or c.branch_id = p_branch)),
    'pending_punches', (select count(*) from attendance_punches ap where ap.status = 'pending_review'
                              and ap.branch_id in (select app.perm_branches('attendance.view')) and (p_branch is null or ap.branch_id = p_branch)),
    'suspicious', (select count(*) from punch_attempts pa where pa.created_at > now() - interval '24 hours'
                     and pa.branch_id in (select app.perm_branches('attendance.view')) and (p_branch is null or pa.branch_id = p_branch)
                     and pa.reason in ('qr_reused','qr_wrong_branch','qr_invalid','geo_outside','duplicate_in','kiosk_bad_credentials'))
  )
$$;

-- Reporte por período (base para Excel/PDF).
create or replace function public.attendance_report(p_from date, p_to date, p_branch uuid default null, p_user uuid default null)
returns table (user_id uuid, employee text, employee_code text, branch_name text, legal_entity text, day date,
               shift_starts timestamptz, shift_ends timestamptz, actual_in timestamptz, actual_out timestamptz,
               worked_minutes integer, status text, flags text[])
language sql stable security definer set search_path = public, pg_temp as $$
  select s.user_id, pr.last_name || ', ' || pr.first_name, e.employee_code, b.name, le.legal_name,
         (s.started_at at time zone b.timezone)::date, sh.starts_at, sh.ends_at, s.started_at, s.ended_at,
         case when s.ended_at is not null then (extract(epoch from s.ended_at - s.started_at) / 60)::int end,
         s.status,
         (select array_agg(distinct f) from attendance_punches ap, unnest(ap.flags) f where ap.session_id = s.id)
  from attendance_sessions s
  join branches b on b.id = s.branch_id
  join legal_entities le on le.id = s.legal_entity_id
  left join shifts sh on sh.id = s.shift_id
  left join profiles pr on pr.user_id = s.user_id
  left join employments e on e.user_id = s.user_id and e.legal_entity_id = s.legal_entity_id and e.status <> 'terminated'
  where s.branch_id in (select app.perm_branches('reports.view'))
    and (p_branch is null or s.branch_id = p_branch)
    and (p_user is null or s.user_id = p_user)
    and s.started_at >= (p_from::timestamp at time zone b.timezone)
    and s.started_at < ((p_to + 1)::timestamp at time zone b.timezone)
  order by b.name, 2, s.started_at
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.kiosk_devices enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.qr_token_uses enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_punches enable row level security;
alter table public.punch_attempts enable row level security;
alter table public.attendance_corrections enable row level security;

create policy kiosk_read on public.kiosk_devices for select to authenticated using (app.has_perm_branch('kiosk.manage', branch_id));
create policy kiosk_update on public.kiosk_devices for update to authenticated
  using (app.has_perm_branch('kiosk.manage', branch_id)) with check (app.has_perm_branch('kiosk.manage', branch_id));
-- qr_tokens y qr_token_uses: sin políticas → inaccesibles desde la API.

create policy sessions_read on public.attendance_sessions for select to authenticated
  using (user_id = auth.uid() or app.has_perm_branch('attendance.view', branch_id));
create policy punches_read on public.attendance_punches for select to authenticated
  using (user_id = auth.uid() or app.has_perm_branch('attendance.view', branch_id));
create policy attempts_read on public.punch_attempts for select to authenticated
  using (branch_id is not null and app.has_perm_branch('attendance.view', branch_id));
create policy corrections_read on public.attendance_corrections for select to authenticated
  using (user_id = auth.uid() or app.has_perm_branch('attendance.view', branch_id));

revoke select on public.kiosk_devices from authenticated;
grant select (id, organization_id, branch_id, name, mode, paired_at, last_seen_at, revoked_at, created_at, pairing_expires_at)
  on public.kiosk_devices to authenticated;
grant update (name) on public.kiosk_devices to authenticated;
revoke all on public.qr_tokens, public.qr_token_uses from authenticated, anon;

revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;
-- Funciones de dispositivo: utilizables sin sesión de usuario, autenticadas por el secreto del dispositivo.
grant execute on function public.kiosk_pair(text), public.kiosk_info(text), public.kiosk_issue_qr(text),
  public.kiosk_punch(text, text, text, text, uuid) to anon;
grant execute on all functions in schema app to authenticated, anon, service_role;

alter publication supabase_realtime add table public.attendance_punches, public.attendance_sessions;
