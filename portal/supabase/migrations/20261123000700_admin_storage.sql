-- =====================================================================
-- Administración: invitaciones, roles (sin escalamiento), contexto de
-- sesión, panel gerencial, derechos de la persona titular (Ley 25.326)
-- y políticas de almacenamiento privado.
-- =====================================================================

create table public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null references public.legal_entities(id),
  branch_id uuid not null references public.branches(id),
  sector_id uuid references public.sectors(id),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name text not null,
  last_name text not null,
  position text not null default 'Colaborador',
  employee_code text not null check (employee_code ~ '^[A-Za-z0-9-]{3,20}$'),
  hire_date date,
  status text not null default 'pending' check (status in ('pending','sent','accepted','revoked','failed')),
  user_id uuid references auth.users(id),
  invited_by uuid not null references auth.users(id),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index invitations_pending_email on public.employee_invitations (legal_entity_id, lower(email)) where status in ('pending','sent');

-- Paso 1 (con la sesión de quien invita): valida permisos y registra la invitación.
create or replace function public.create_employee_invitation(p_branch uuid, p_email text, p_first_name text, p_last_name text,
  p_position text, p_employee_code text, p_hire_date date default null, p_sector uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare b branches; v_id uuid;
begin
  if not app.has_perm_branch('employees.manage', p_branch) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into b from branches where id = p_branch;
  if exists (select 1 from employments where legal_entity_id = b.legal_entity_id and upper(employee_code) = upper(p_employee_code)) then
    raise exception 'El legajo/código ya está en uso en esta razón social' using errcode = '23505';
  end if;
  insert into employee_invitations (organization_id, legal_entity_id, branch_id, sector_id, email, first_name, last_name, position, employee_code, hire_date, invited_by)
  values (b.organization_id, b.legal_entity_id, p_branch, p_sector, lower(trim(p_email)), trim(p_first_name), trim(p_last_name),
          coalesce(nullif(trim(p_position), ''), 'Colaborador'), upper(trim(p_employee_code)), p_hire_date, auth.uid())
  returning id into v_id;
  perform app.audit(b.organization_id, 'employee.invite', 'invitation', v_id::text, jsonb_build_object('branch', p_branch));
  return v_id;
end $$;

-- Paso 2 (solo service_role, desde la Edge Function): vincula la identidad
-- (nueva o existente, sin duplicarla) y crea perfil + relación laboral.
create or replace function public.complete_employee_invitation(p_invitation uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare i employee_invitations; v_emp uuid;
begin
  select * into i from employee_invitations where id = p_invitation and status in ('pending','failed') for update;
  if i.id is null then raise exception 'Invitación no disponible' using errcode = '42501'; end if;
  insert into profiles (user_id, organization_id, first_name, last_name)
  values (p_user, i.organization_id, i.first_name, i.last_name) on conflict (user_id) do nothing;
  insert into employments (user_id, organization_id, legal_entity_id, primary_branch_id, sector_id, position, employee_code, hire_date, status)
  values (p_user, i.organization_id, i.legal_entity_id, i.branch_id, i.sector_id, i.position, i.employee_code, i.hire_date,
          case when exists (select 1 from employments where user_id = p_user and status = 'active') then 'active' else 'invited' end)
  returning id into v_emp;
  update employee_invitations set status = 'sent', user_id = p_user, sent_at = now(), error = null where id = p_invitation;
  insert into audit_log (organization_id, actor_id, action, entity, entity_id, details)
  values (i.organization_id, i.invited_by, 'employee.invitation.sent', 'invitation', p_invitation::text, jsonb_build_object('employment', v_emp));
  return v_emp;
end $$;

create or replace function public.fail_employee_invitation(p_invitation uuid, p_error text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update employee_invitations set status = 'failed', error = left(p_error, 300) where id = p_invitation
$$;

-- La Edge Function resuelve si el correo ya tiene identidad (para no duplicarla).
create or replace function public.find_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke execute on function public.complete_employee_invitation(uuid, uuid), public.fail_employee_invitation(uuid, text),
  public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.complete_employee_invitation(uuid, uuid), public.fail_employee_invitation(uuid, text),
  public.find_user_id_by_email(text) to service_role;

-- Primer ingreso: la cuenta invitada pasa a activa.
create or replace function public.activate_my_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update employments set status = 'active' where user_id = app.require_auth() and status = 'invited';
  update employee_invitations set status = 'accepted' where user_id = auth.uid() and status = 'sent';
end $$;

-- ---------------------------------------------------------------------
-- Roles: asignación con prevención de escalamiento de privilegios
-- ---------------------------------------------------------------------
create or replace function public.assign_role(p_user uuid, p_role uuid, p_scope_type text, p_scope_id uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare r roles; v_org uuid; v_id uuid;
begin
  select * into r from roles where id = p_role;
  v_org := case p_scope_type
    when 'organization' then p_scope_id
    when 'legal_entity' then (select organization_id from legal_entities where id = p_scope_id)
    when 'branch' then (select organization_id from branches where id = p_scope_id) end;
  if r.id is null or v_org is null or (r.organization_id is not null and r.organization_id <> v_org) then
    raise exception 'Rol o alcance inválido' using errcode = '22023';
  end if;
  if not app.has_perm_org('roles.manage', v_org) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  -- Nadie puede otorgar permisos que no posee a nivel organización.
  if exists (select 1 from role_permissions rp where rp.role_id = p_role and not app.has_perm_org(rp.permission_key, v_org)) then
    raise exception 'No podés otorgar permisos que no tenés' using errcode = '42501';
  end if;
  if not exists (select 1 from employments where user_id = p_user and organization_id = v_org and status in ('active','invited')) then
    raise exception 'La persona no pertenece a la organización' using errcode = '23514';
  end if;
  insert into role_assignments (user_id, role_id, organization_id, scope_type, scope_id, granted_by)
  values (p_user, p_role, v_org, p_scope_type, p_scope_id, auth.uid())
  on conflict (user_id, role_id, scope_type, scope_id) do update set granted_by = excluded.granted_by
  returning id into v_id;
  perform app.audit(v_org, 'role.assign', 'role_assignment', v_id::text, jsonb_build_object('user', p_user, 'role', r.key, 'scope', p_scope_type, 'scope_id', p_scope_id));
  return v_id;
end $$;

create or replace function public.revoke_role(p_assignment uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a role_assignments;
begin
  select * into a from role_assignments where id = p_assignment;
  if a.id is null or not app.has_perm_org('roles.manage', a.organization_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if a.user_id = auth.uid() and exists (select 1 from role_permissions rp where rp.role_id = a.role_id and rp.permission_key = 'roles.manage')
     and (select count(*) from role_assignments x join role_permissions rp on rp.role_id = x.role_id and rp.permission_key = 'roles.manage'
          where x.organization_id = a.organization_id and x.scope_type = 'organization') <= 1 then
    raise exception 'No podés quitar la última administración de la organización' using errcode = '42501';
  end if;
  delete from role_assignments where id = p_assignment;
  perform app.audit(a.organization_id, 'role.revoke', 'role_assignment', p_assignment::text, jsonb_build_object('user', a.user_id, 'role', a.role_id));
end $$;

create or replace function public.org_role_assignments(p_org uuid)
returns table (id uuid, user_id uuid, first_name text, last_name text, role_id uuid, role_key text, role_name text,
               scope_type text, scope_id uuid, scope_name text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select ra.id, ra.user_id, p.first_name, p.last_name, r.id, r.key, r.name, ra.scope_type, ra.scope_id,
         case ra.scope_type when 'organization' then (select name from organizations where id = ra.scope_id)
                            when 'legal_entity' then (select legal_name from legal_entities where id = ra.scope_id)
                            else (select name from branches where id = ra.scope_id) end,
         ra.created_at
  from role_assignments ra join roles r on r.id = ra.role_id left join profiles p on p.user_id = ra.user_id
  where ra.organization_id = p_org and app.has_perm_org('roles.manage', p_org)
  order by p.last_name, r.name
$$;

-- ---------------------------------------------------------------------
-- Contexto de sesión para el frontend (qué mostrar; la autorización real está en RLS)
-- ---------------------------------------------------------------------
create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'profile', (select to_jsonb(p) from profiles p where p.user_id = auth.uid()),
    'is_platform_admin', app.is_platform_admin(),
    'organization', (select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'logo_path', o.logo_path, 'settings', o.settings)
                     from organizations o where o.id = (select organization_id from profiles where user_id = auth.uid())),
    'employments', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', e.id, 'status', e.status, 'position', e.position, 'employee_code', e.employee_code,
                       'legal_entity_id', e.legal_entity_id, 'legal_entity', le.legal_name,
                       'branch_id', b.id, 'branch', b.name, 'brand_id', br.id, 'brand', br.name, 'brand_logo', br.logo_path,
                       'brand_color', br.accent_color, 'sector', s.name, 'hire_date', e.hire_date,
                       'has_kiosk_pin', e.kiosk_pin_hash is not null) order by e.created_at), '[]'::jsonb)
                    from employments e join legal_entities le on le.id = e.legal_entity_id
                    join branches b on b.id = e.primary_branch_id join brands br on br.id = b.brand_id
                    left join sectors s on s.id = e.sector_id
                    where e.user_id = auth.uid() and e.status <> 'terminated'),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('role', r.key, 'name', r.name, 'scope_type', ra.scope_type, 'scope_id', ra.scope_id,
                       'organization_id', ra.organization_id,
                       'permissions', (select jsonb_agg(rp.permission_key) from role_permissions rp where rp.role_id = r.id))), '[]'::jsonb)
              from role_assignments ra join roles r on r.id = ra.role_id where ra.user_id = auth.uid()),
    'mfa_required', exists (select 1 from role_assignments ra join organizations o on o.id = ra.organization_id
                            where ra.user_id = auth.uid() and coalesce((o.settings->>'require_mfa')::boolean, true)),
    'unread_notifications', (select count(*) from notifications where user_id = auth.uid() and read_at is null)
  )
$$;

-- Directorio administrativo de personal.
create or replace function public.admin_employees(p_branch uuid default null, p_query text default '', p_status text default null)
returns table (employment_id uuid, user_id uuid, first_name text, last_name text, avatar_path text, email text,
               job_title text, employee_code text, status text, branch_id uuid, branch_name text, brand_name text,
               legal_entity text, sector_name text, hire_date date, has_kiosk_pin boolean, kiosk_locked boolean)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select e.id, e.user_id, p.first_name, p.last_name, p.avatar_path, u.email, e.position, e.employee_code, e.status,
         b.id, b.name, br.name, le.legal_name, s.name, e.hire_date, e.kiosk_pin_hash is not null, coalesce(e.kiosk_locked_until > now(), false)
  from employments e
  join branches b on b.id = e.primary_branch_id
  join brands br on br.id = b.brand_id
  join legal_entities le on le.id = e.legal_entity_id
  left join sectors s on s.id = e.sector_id
  left join profiles p on p.user_id = e.user_id
  left join auth.users u on u.id = e.user_id
  where e.primary_branch_id in (select app.perm_branches('employees.view'))
    and (p_branch is null or e.primary_branch_id = p_branch)
    and (p_status is null or e.status = p_status)
    and (coalesce(p_query, '') = '' or lower(p.first_name || ' ' || p.last_name || ' ' || e.employee_code) like '%' || lower(p_query) || '%')
  order by p.last_name, p.first_name
$$;

create or replace function public.admin_unlock_kiosk_pin(p_employment uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not app.has_perm_branch('attendance.manage', e.primary_branch_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update employments set kiosk_failed_attempts = 0, kiosk_locked_until = null where id = p_employment;
  perform app.audit(e.organization_id, 'kiosk.pin_unlock', 'employment', p_employment::text, '{}');
end $$;

create or replace function app.audit_employment_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.status, new.primary_branch_id, new.position, new.sector_id, new.manager_user_id)
     is distinct from (old.status, old.primary_branch_id, old.position, old.sector_id, old.manager_user_id) and auth.uid() is not null
     and auth.uid() <> new.user_id then
    insert into audit_log (organization_id, actor_id, action, entity, entity_id, details)
    values (new.organization_id, auth.uid(), 'employment.update', 'employment', new.id::text,
            jsonb_build_object('before', jsonb_build_object('status', old.status, 'branch', old.primary_branch_id, 'position', old.position),
                               'after', jsonb_build_object('status', new.status, 'branch', new.primary_branch_id, 'position', new.position)));
  end if;
  return new;
end $$;
create trigger employments_audit after update on public.employments for each row execute function app.audit_employment_change();

create or replace function public.admin_overview(p_org uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when not app.has_perm_any('employees.view', p_org) then null else jsonb_build_object(
    'employees_active', (select count(*) from employments e where e.organization_id = p_org and e.status = 'active'
                          and e.primary_branch_id in (select app.perm_branches('employees.view'))),
    'employees_invited', (select count(*) from employments e where e.organization_id = p_org and e.status = 'invited'
                          and e.primary_branch_id in (select app.perm_branches('employees.view'))),
    'branches', (select count(*) from branches b where b.organization_id = p_org and b.id in (select app.perm_branches('employees.view'))),
    'branches_pending_verification', (select count(*) from branches b where b.organization_id = p_org and b.status = 'pending_verification'
                                       and b.id in (select app.perm_branches('employees.view'))),
    'hr_pending', (select count(*) from hr_requests r where r.organization_id = p_org and r.status = 'pending'
                    and r.branch_id in (select app.perm_branches('requests.review'))),
    'swaps_pending', (select count(*) from shift_swap_requests s join shifts sh on sh.id = s.requester_shift_id
                       where s.status = 'pending_manager' and sh.branch_id in (select app.perm_branches('schedules.manage'))),
    'meetings_pending', (select count(*) from meeting_requests m where m.responder_id = auth.uid() and m.status = 'requested'),
    'tickets_open', (select count(*) from mgmt_tickets t where t.recipient_id = auth.uid() and t.status in ('received','in_review')),
    'reports_open', case when app.has_perm_org('community.moderate', p_org) then
                       (select count(*) from content_reports c where c.organization_id = p_org and c.status = 'open') end
  ) end
$$;

-- ---------------------------------------------------------------------
-- Derechos de acceso (Ley 25.326): la persona titular puede exportar sus datos.
-- No incluye contenido de terceros.
-- ---------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'generated_at', now(),
    'profile', (select to_jsonb(p) from profiles p where user_id = auth.uid()),
    'private_data', (select to_jsonb(x) from employee_private x where user_id = auth.uid()),
    'employments', (select jsonb_agg(to_jsonb(e) - 'kiosk_pin_hash') from employments e where user_id = auth.uid()),
    'shifts', (select jsonb_agg(to_jsonb(s)) from shifts s where user_id = auth.uid() and status <> 'draft'),
    'attendance_punches', (select jsonb_agg(to_jsonb(a)) from attendance_punches a where user_id = auth.uid()),
    'hr_requests', (select jsonb_agg(to_jsonb(h)) from hr_requests h where user_id = auth.uid()),
    'posts', (select jsonb_agg(to_jsonb(p)) from posts p where author_id = auth.uid()),
    'comments', (select jsonb_agg(to_jsonb(c)) from post_comments c where author_id = auth.uid()),
    'messages_sent', (select jsonb_agg(jsonb_build_object('conversation_id', conversation_id, 'body', body, 'created_at', created_at))
                      from messages where sender_id = auth.uid()),
    'friendships', (select jsonb_agg(to_jsonb(f)) from friendships f where user_a = auth.uid() or user_b = auth.uid()),
    'document_events', (select jsonb_agg(to_jsonb(d)) from document_events d where user_id = auth.uid())
  )
$$;

-- ---------------------------------------------------------------------
-- Almacenamiento privado
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('media', 'media', false), ('chat', 'chat', false), ('documents', 'documents', false), ('branding', 'branding', false)
on conflict (id) do nothing;

-- media: org/{org_id}/u/{user_id}/archivo — fotos de perfil y publicaciones.
create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'org' and app.is_member(((storage.foldername(name))[2])::uuid));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'org'
              and app.is_member(((storage.foldername(name))[2])::uuid)
              and (storage.foldername(name))[3] = 'u' and (storage.foldername(name))[4] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[3] = 'u' and (storage.foldername(name))[4] = auth.uid()::text);

-- chat: conv/{conversation_id}/... — solo participantes.
create policy chat_read on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (storage.foldername(name))[1] = 'conv' and app.is_participant(((storage.foldername(name))[2])::uuid));
create policy chat_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = 'conv' and app.can_send(((storage.foldername(name))[2])::uuid));

-- documents: le/{legal_entity_id}/... — lectura solo si la fila de documents lo autoriza.
-- Conocer la ruta del archivo no alcanza: sin permiso no se emite la URL firmada.
create policy docs_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and exists (select 1 from public.documents d where d.storage_path = name and app.can_read_document(d.id)));
create policy docs_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'le'
              and app.has_perm_le('docs.manage', ((storage.foldername(name))[2])::uuid));

-- branding: org/{org_id}/... — logos de marcas.
create policy branding_read on storage.objects for select to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = 'org' and app.is_member(((storage.foldername(name))[2])::uuid));
create policy branding_write on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = 'org' and app.has_perm_org('org.manage', ((storage.foldername(name))[2])::uuid));

grant select, insert on public.employee_invitations to authenticated;
alter table public.employee_invitations enable row level security;
create policy inv_read on public.employee_invitations for select to authenticated using (app.has_perm_branch('employees.view', branch_id));
revoke insert on public.employee_invitations from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.complete_employee_invitation(uuid, uuid), public.fail_employee_invitation(uuid, text),
  public.find_user_id_by_email(text) from authenticated;
grant execute on function public.kiosk_pair(text), public.kiosk_info(text), public.kiosk_issue_qr(text),
  public.kiosk_punch(text, text, text, text, uuid) to anon;
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
