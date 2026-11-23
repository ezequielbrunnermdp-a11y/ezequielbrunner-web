-- =====================================================================
-- FASES 5 y 6 · Legajo digital, documentos, capacitaciones, beneficios,
-- eventos, reconocimientos, encuestas, sugerencias, cumpleaños, push.
-- =====================================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  branch_id uuid references public.branches(id),
  owner_user_id uuid references auth.users(id) on delete cascade,   -- null = documento general
  category text not null check (category in ('payslip','certificate','training','contract','disciplinary','medical',
                                             'general','policy','manual','communication')),
  title text not null check (length(title) between 2 and 160),
  description text,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  requires_ack boolean not null default false,
  -- Firma con validez jurídica y notificación fehaciente NO están implementadas:
  -- este campo deja constancia explícita para evitar interpretaciones erróneas.
  legal_signature_status text not null default 'not_supported' check (legal_signature_status in ('not_supported')),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (category not in ('payslip','contract','disciplinary','medical') or owner_user_id is not null)
);
create index on public.documents (owner_user_id, published_at desc);
create index on public.documents (legal_entity_id, category);

create table public.document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('viewed','downloaded','acknowledged')),
  created_at timestamptz not null default now()
);
create index on public.document_events (document_id, user_id);

create or replace function app.is_sensitive_category(p text) returns boolean language sql immutable as $$
  select p in ('payslip','contract','disciplinary','medical')
$$;

create or replace function app.can_read_document(p_doc uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from documents d where d.id = p_doc and (
      d.owner_user_id = auth.uid()
      or (d.owner_user_id is null and exists (
            select 1 from employments e where e.user_id = auth.uid() and e.status = 'active'
              and e.legal_entity_id = d.legal_entity_id
              and (d.branch_id is null or e.primary_branch_id = d.branch_id)))
      or (d.owner_user_id is not null and app.is_sensitive_category(d.category) and app.has_perm_le('payroll.view', d.legal_entity_id))
      or (d.owner_user_id is not null and not app.is_sensitive_category(d.category) and app.has_perm_le('docs.manage', d.legal_entity_id))
      or (d.owner_user_id is null and app.has_perm_le('docs.manage', d.legal_entity_id))
    ))
$$;

create or replace function public.register_document(p_legal_entity uuid, p_owner uuid, p_category text, p_title text,
  p_storage_path text, p_mime text, p_size bigint, p_requires_ack boolean default false, p_branch uuid default null, p_description text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_org uuid;
begin
  if not app.has_perm_le('docs.manage', p_legal_entity)
     or (app.is_sensitive_category(p_category) and not app.has_perm_le('payroll.view', p_legal_entity)) then
    raise exception 'Sin permiso para publicar este documento' using errcode = '42501';
  end if;
  if p_storage_path not like 'le/' || p_legal_entity || '/%' then raise exception 'Ruta de archivo inválida' using errcode = '22023'; end if;
  if p_owner is not null and not exists (select 1 from employments where user_id = p_owner and legal_entity_id = p_legal_entity) then
    raise exception 'La persona no pertenece a esta razón social' using errcode = '23514';
  end if;
  select organization_id into v_org from legal_entities where id = p_legal_entity;
  insert into documents (organization_id, legal_entity_id, branch_id, owner_user_id, category, title, description, storage_path, mime_type, size_bytes, requires_ack, created_by)
  values (v_org, p_legal_entity, p_branch, p_owner, p_category, trim(p_title), p_description, p_storage_path, p_mime, p_size, p_requires_ack, auth.uid())
  returning id into v_id;
  perform app.audit(v_org, 'document.publish', 'document', v_id::text, jsonb_build_object('category', p_category, 'owner', p_owner));
  if p_owner is not null then
    perform app.notify(p_owner, 'document', 'Tenés un documento nuevo disponible', null, '/documentos');
  end if;
  return v_id;
end $$;

create or replace function public.log_document_event(p_doc uuid, p_event text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.can_read_document(p_doc) then raise exception 'Documento no disponible' using errcode = '42501'; end if;
  if p_event = 'acknowledged' and exists (select 1 from document_events where document_id = p_doc and user_id = auth.uid() and event = 'acknowledged') then
    return;
  end if;
  insert into document_events (document_id, user_id, event) values (p_doc, auth.uid(), p_event);
end $$;

-- ---------------------------------------------------------------------
-- Capacitaciones
-- ---------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(title) between 3 and 140),
  description text,
  pass_score integer not null default 70 check (pass_score between 0 and 100),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  kind text not null check (kind in ('text','video','link','document')),
  content text,
  url text check (url is null or url ~ '^https://'),
  document_id uuid references public.documents(id)
);

create table public.course_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  question text not null,
  options text[] not null check (cardinality(options) between 2 and 6),
  correct_index integer not null
);

create table public.course_assignments (
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table public.course_progress (
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

create table public.course_completions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  passed boolean not null,
  certificate_code text unique,
  completed_at timestamptz not null default now()
);

create or replace function public.complete_lesson(p_lesson uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_course uuid;
begin
  select l.course_id into v_course from course_lessons l join courses c on c.id = l.course_id
  where l.id = p_lesson and app.is_member(c.organization_id);
  if v_course is null then raise exception 'Lección no disponible' using errcode = '42501'; end if;
  insert into course_progress (course_id, lesson_id, user_id) values (v_course, p_lesson, app.require_auth()) on conflict do nothing;
end $$;

-- La corrección del cuestionario se hace en el servidor; las respuestas correctas no se exponen.
create or replace function public.submit_quiz(p_course uuid, p_answers integer[]) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c courses; v_total int; v_ok int; v_score int; v_passed boolean; v_code text;
begin
  select * into c from courses where id = p_course and active and app.is_member(organization_id);
  if c.id is null then raise exception 'Capacitación no disponible' using errcode = '42501'; end if;
  if (select count(*) from course_completions where course_id = p_course and user_id = app.require_auth() and completed_at > now() - interval '1 minute') > 0 then
    raise exception 'Esperá un momento antes de reintentar' using errcode = '54000';
  end if;
  select count(*), count(*) filter (where q.correct_index = p_answers[q.rn]) into v_total, v_ok
  from (select *, row_number() over (order by position, id) as rn from course_questions where course_id = p_course) q;
  v_score := case when v_total = 0 then 100 else round(100.0 * v_ok / v_total) end;
  v_passed := v_score >= c.pass_score;
  if v_passed then v_code := upper(substr(app.random_token(9), 1, 10)); end if;
  insert into course_completions (course_id, user_id, score, passed, certificate_code) values (p_course, auth.uid(), v_score, v_passed, v_code);
  return jsonb_build_object('score', v_score, 'passed', v_passed, 'certificate_code', v_code, 'total', v_total, 'correct', v_ok);
end $$;

create or replace function public.course_quiz(p_course uuid)
returns table (id uuid, question text, options text[])
language sql stable security definer set search_path = public, pg_temp as $$
  select q.id, q.question, q.options from course_questions q join courses c on c.id = q.course_id
  where q.course_id = p_course and app.is_member(c.organization_id) order by q.position, q.id
$$;

create or replace function public.my_courses()
returns table (id uuid, title text, description text, lessons bigint, done bigint, due_date date, assigned boolean, passed boolean, certificate_code text, best_score int)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.title, c.description,
         (select count(*) from course_lessons l where l.course_id = c.id),
         (select count(*) from course_progress p where p.course_id = c.id and p.user_id = auth.uid()),
         a.due_date, a.user_id is not null,
         exists (select 1 from course_completions x where x.course_id = c.id and x.user_id = auth.uid() and x.passed),
         (select x.certificate_code from course_completions x where x.course_id = c.id and x.user_id = auth.uid() and x.passed order by x.completed_at desc limit 1),
         (select max(x.score) from course_completions x where x.course_id = c.id and x.user_id = auth.uid())
  from courses c left join course_assignments a on a.course_id = c.id and a.user_id = auth.uid()
  where c.active and app.is_member(c.organization_id)
  order by (a.user_id is not null) desc, c.created_at desc
$$;

create or replace function public.assign_course(p_course uuid, p_users uuid[], p_due date default null) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare c courses; u uuid; n int := 0;
begin
  select * into c from courses where id = p_course;
  if c.id is null or not app.has_perm_any('trainings.manage', c.organization_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  foreach u in array p_users loop
    if app.can_manage_user('trainings.manage', u) then
      insert into course_assignments (course_id, user_id, due_date, assigned_by) values (p_course, u, p_due, auth.uid())
        on conflict (course_id, user_id) do update set due_date = excluded.due_date;
      perform app.notify(u, 'training', 'Se te asignó una capacitación', null, '/capacitaciones/' || p_course);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Comunidad avanzada
-- ---------------------------------------------------------------------
create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id),
  title text not null,
  description text,
  provider text,
  how_to_use text,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id),
  branch_id uuid references public.branches(id),
  title text not null check (length(title) between 3 and 140),
  description text,
  kind text not null default 'social' check (kind in ('social','meeting','training','celebration')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  response text not null check (response in ('going','maybe','not_going')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.recognitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'peer' check (kind in ('peer','manager')),
  badge text not null default 'thanks' check (badge in ('thanks','teamwork','service','leadership','initiative')),
  message text not null check (length(message) between 3 and 500),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id),
  question text not null check (length(question) between 5 and 300),
  options text[] not null check (cardinality(options) between 2 and 8),
  closes_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Los votos NO son anónimos a nivel técnico (se guarda quién votó para evitar
-- votos duplicados). Ningún rol de la aplicación puede ver votos individuales.
create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- Las sugerencias son identificadas: no se ofrece anonimato porque no es verificable.
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 3 and 140),
  body text not null check (length(body) between 5 and 3000),
  status text not null default 'received' check (status in ('received','under_review','planned','done','declined')),
  response text,
  responded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace function public.give_recognition(p_to uuid, p_badge text, p_message text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_org uuid; v_kind text := 'peer';
begin
  if not app.can_see_user(p_to) or p_to = app.require_auth() then raise exception 'Persona no disponible' using errcode = '42501'; end if;
  select organization_id into v_org from profiles where user_id = auth.uid();
  if app.can_manage_user('employees.view', p_to) then v_kind := 'manager'; end if;
  if (select count(*) from recognitions where from_user = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Alcanzaste el máximo diario de reconocimientos' using errcode = '54000';
  end if;
  insert into recognitions (organization_id, from_user, to_user, kind, badge, message) values (v_org, auth.uid(), p_to, v_kind, p_badge, trim(p_message))
  returning id into v_id;
  perform app.notify(p_to, 'recognition', 'Recibiste un reconocimiento', null, '/comunidad/reconocimientos');
  return v_id;
end $$;

create or replace function public.recognitions_feed(p_limit int default 30)
returns table (id uuid, from_user uuid, from_name text, to_user uuid, to_name text, to_avatar text, kind text, badge text, message text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.from_user, f.first_name || ' ' || f.last_name, r.to_user, t.first_name || ' ' || t.last_name, t.avatar_path,
         r.kind, r.badge, r.message, r.created_at
  from recognitions r join profiles f on f.user_id = r.from_user join profiles t on t.user_id = r.to_user
  where r.status = 'visible' and (app.can_see_user(r.to_user) or r.from_user = auth.uid()) and app.can_see_user(r.from_user)
  order by r.created_at desc limit least(p_limit, 100)
$$;

create or replace function public.vote_poll(p_poll uuid, p_option int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p polls;
begin
  select * into p from polls where id = p_poll;
  if p.id is null or not app.in_community(p.organization_id, p.brand_id) then raise exception 'Encuesta no disponible' using errcode = '42501'; end if;
  if p.closes_at is not null and p.closes_at < now() then raise exception 'La encuesta está cerrada' using errcode = '22023'; end if;
  if p_option < 0 or p_option >= cardinality(p.options) then raise exception 'Opción inválida' using errcode = '22023'; end if;
  insert into poll_votes (poll_id, user_id, option_index) values (p_poll, app.require_auth(), p_option)
    on conflict (poll_id, user_id) do update set option_index = excluded.option_index, created_at = now();
end $$;

create or replace function public.poll_results(p_poll uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'total', (select count(*) from poll_votes where poll_id = p.id),
    'my_vote', (select option_index from poll_votes where poll_id = p.id and user_id = auth.uid()),
    'counts', (select jsonb_agg(coalesce((select count(*) from poll_votes v where v.poll_id = p.id and v.option_index = i - 1), 0) order by i)
               from generate_subscripts(p.options, 1) i))
  from polls p where p.id = p_poll and (app.in_community(p.organization_id, p.brand_id) or app.has_perm_any('community.publish', p.organization_id))
$$;

create or replace function public.upcoming_birthdays(p_days int default 30)
returns table (user_id uuid, first_name text, last_name text, avatar_path text, month smallint, day smallint, in_days int)
language sql stable security definer set search_path = public, pg_temp as $$
  with t as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as today)
  select p.user_id, p.first_name, p.last_name, p.avatar_path, p.birth_month, p.birth_day, x.d
  from profiles p, t,
  lateral (select (make_date(extract(year from t.today)::int + case when make_date(extract(year from t.today)::int, p.birth_month,
                    least(p.birth_day, case when p.birth_month = 2 then 28 else p.birth_day end)) < t.today then 1 else 0 end,
                    p.birth_month, least(p.birth_day, case when p.birth_month = 2 then 28 else p.birth_day end)) - t.today) as d) x
  where p.show_birthday and p.birth_month is not null and p.birth_day is not null
    and (p.user_id = auth.uid() or app.can_see_user(p.user_id)) and x.d <= p_days
  order by x.d
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.document_events enable row level security;
alter table public.courses enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_questions enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_progress enable row level security;
alter table public.course_completions enable row level security;
alter table public.benefits enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.recognitions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.suggestions enable row level security;
alter table public.push_subscriptions enable row level security;

create policy docs_read on public.documents for select to authenticated using (app.can_read_document(id));
create policy doc_events_read on public.document_events for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from documents d where d.id = document_id and app.has_perm_le('docs.manage', d.legal_entity_id)
                                         and (not app.is_sensitive_category(d.category) or app.has_perm_le('payroll.view', d.legal_entity_id))));

create policy courses_read on public.courses for select to authenticated using (app.is_member(organization_id));
create policy courses_write on public.courses for all to authenticated
  using (app.has_perm_any('trainings.manage', organization_id)) with check (app.has_perm_any('trainings.manage', organization_id));
create policy lessons_read on public.course_lessons for select to authenticated
  using (exists (select 1 from courses c where c.id = course_id and app.is_member(c.organization_id)));
create policy lessons_write on public.course_lessons for all to authenticated
  using (exists (select 1 from courses c where c.id = course_id and app.has_perm_any('trainings.manage', c.organization_id)))
  with check (exists (select 1 from courses c where c.id = course_id and app.has_perm_any('trainings.manage', c.organization_id)));
create policy questions_admin on public.course_questions for all to authenticated
  using (exists (select 1 from courses c where c.id = course_id and app.has_perm_any('trainings.manage', c.organization_id)))
  with check (exists (select 1 from courses c where c.id = course_id and app.has_perm_any('trainings.manage', c.organization_id)));
create policy assignments_read on public.course_assignments for select to authenticated
  using (user_id = auth.uid() or app.can_manage_user('trainings.manage', user_id));
create policy progress_read on public.course_progress for select to authenticated
  using (user_id = auth.uid() or app.can_manage_user('trainings.manage', user_id));
create policy completions_read on public.course_completions for select to authenticated
  using (user_id = auth.uid() or app.can_manage_user('trainings.manage', user_id));

create policy benefits_read on public.benefits for select to authenticated using (app.in_community(organization_id, brand_id) or app.has_perm_org('community.publish', organization_id));
create policy benefits_write on public.benefits for all to authenticated
  using (app.has_perm_org('community.publish', organization_id)) with check (app.has_perm_org('community.publish', organization_id));
create policy events_read on public.events for select to authenticated using (app.in_community(organization_id, brand_id) or app.has_perm_any('community.publish', organization_id));
create policy events_write on public.events for all to authenticated
  using (app.has_perm_any('community.publish', organization_id)) with check (app.has_perm_any('community.publish', organization_id));
create policy rsvps_read on public.event_rsvps for select to authenticated
  using (exists (select 1 from events e where e.id = event_id and (app.in_community(e.organization_id, e.brand_id) or app.has_perm_any('community.publish', e.organization_id))));
create policy rsvps_write on public.event_rsvps for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from events e where e.id = event_id and app.in_community(e.organization_id, e.brand_id)));
create policy recog_moderate on public.recognitions for update to authenticated
  using (app.has_perm_org('community.moderate', organization_id)) with check (app.has_perm_org('community.moderate', organization_id));
create policy polls_read on public.polls for select to authenticated using (app.in_community(organization_id, brand_id) or app.has_perm_any('community.publish', organization_id));
create policy polls_write on public.polls for all to authenticated
  using (app.has_perm_org('community.publish', organization_id)) with check (app.has_perm_org('community.publish', organization_id));
create policy votes_own on public.poll_votes for select to authenticated using (user_id = auth.uid());
create policy sugg_read on public.suggestions for select to authenticated
  using (user_id = auth.uid() or app.has_perm_org('community.moderate', organization_id));
create policy sugg_insert on public.suggestions for insert to authenticated
  with check (user_id = auth.uid() and app.is_member(organization_id) and status = 'received' and response is null);
create policy sugg_update on public.suggestions for update to authenticated
  using (app.has_perm_org('community.moderate', organization_id)) with check (app.has_perm_org('community.moderate', organization_id));
create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on all tables in schema public to authenticated;
revoke select on public.course_questions from authenticated;
grant select, insert, update, delete on public.course_questions to authenticated; -- RLS: solo gestores de capacitación
grant insert, update, delete on public.courses, public.course_lessons, public.benefits, public.events, public.event_rsvps,
  public.polls, public.push_subscriptions to authenticated;
grant insert on public.suggestions to authenticated;
grant update (status, response, responded_by) on public.suggestions to authenticated;
grant update (status) on public.recognitions to authenticated;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.kiosk_pair(text), public.kiosk_info(text), public.kiosk_issue_qr(text),
  public.kiosk_punch(text, text, text, text, uuid) to anon;
grant execute on all functions in schema app to authenticated, anon, service_role;
