-- Alta del primer administrador. Se ejecuta UNA vez desde el editor SQL de
-- Supabase (rol postgres), después de crear la persona en Authentication.
-- No es invocable desde la API.
create or replace function public.bootstrap_first_admin(p_email text, p_first_name text, p_last_name text,
                                                        p_org_slug text, p_branch_name text, p_employee_code text)
returns text language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_user uuid; v_org uuid; v_branch branches; v_role uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'Primero creá la persona en Authentication > Users (%).', p_email; end if;
  select id into v_org from organizations where slug = p_org_slug;
  select * into v_branch from branches where organization_id = v_org and name = p_branch_name limit 1;
  if v_branch.id is null then raise exception 'Sucursal % no encontrada', p_branch_name; end if;
  insert into profiles (user_id, organization_id, first_name, last_name) values (v_user, v_org, p_first_name, p_last_name)
    on conflict (user_id) do nothing;
  insert into employments (user_id, organization_id, legal_entity_id, primary_branch_id, position, employee_code, status)
  values (v_user, v_org, v_branch.legal_entity_id, v_branch.id, 'Gerencia general', upper(p_employee_code), 'active')
  on conflict do nothing;
  select id into v_role from roles where key = 'company_admin' and organization_id is null;
  insert into role_assignments (user_id, role_id, organization_id, scope_type, scope_id)
  values (v_user, v_role, v_org, 'organization', v_org) on conflict do nothing;
  insert into audit_log (organization_id, actor_id, action, entity, entity_id) values (v_org, v_user, 'bootstrap.first_admin', 'user', v_user::text);
  return 'Administrador configurado: ' || p_email;
end $$;
revoke execute on function public.bootstrap_first_admin(text, text, text, text, text, text) from public, anon, authenticated;
