-- =====================================================================
-- Migración 4: borrado de registros y reinicio de datos (solo administración,
-- con clave de confirmación validada en la base).
-- =====================================================================

alter table auth.secrets add column if not exists reset_code_hash text;
update auth.secrets set reset_code_hash = crypt('1532', gen_salt('bf', 8)) where id = 1 and reset_code_hash is null;

create or replace function public.check_reset_code(p_code text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_hash text;
begin
  if not public.is_admin() then
    raise exception 'Solo la administración puede borrar registros';
  end if;
  select reset_code_hash into v_hash from auth.secrets where id = 1;
  if v_hash is null or coalesce(p_code, '') = '' or crypt(p_code, v_hash) <> v_hash then
    perform pg_sleep(0.8);
    raise exception 'Clave incorrecta';
  end if;
end $$;
revoke all on function public.check_reset_code(text) from public, app_anon, app_authenticated;

-- Borra una auditoría (borrador o finalizada) con todo lo que depende de ella.
-- Devuelve las rutas de archivos borrados para eliminarlos también del almacenamiento.
create or replace function public.admin_delete_audit(p_audit uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_files text[];
  v_audit public.audits;
begin
  perform public.check_reset_code(p_code);
  select * into v_audit from public.audits where id = p_audit;
  if v_audit.id is null then raise exception 'La auditoría no existe'; end if;
  perform set_config('app.audit_procedure', 'on', true);

  select coalesce(array_agg(storage_path), '{}') into v_files from public.attachments
  where audit_id = p_audit or nonconformity_id in (select id from public.nonconformities where audit_id = p_audit);
  delete from public.attachments where audit_id = p_audit or nonconformity_id in (select id from public.nonconformities where audit_id = p_audit);
  delete from storage.objects where bucket_id = 'evidencias' and name = any(v_files);
  delete from public.alerts where audit_id = p_audit or nonconformity_id in (select id from public.nonconformities where audit_id = p_audit);
  delete from public.nonconformities where audit_id = p_audit;
  delete from public.audit_revisions where audit_id = p_audit;
  delete from public.audit_answers where audit_id = p_audit;
  delete from public.audit_category_states where audit_id = p_audit;
  delete from public.audits where id = p_audit;

  perform set_config('app.audit_procedure', 'off', true);
  perform public.log_activity('eliminar', 'auditoria', p_audit::text,
    jsonb_build_object('informe', v_audit.report_number, 'fecha', v_audit.visit_date, 'estado', v_audit.status));
  return jsonb_build_object('ok', true, 'deleted_files', to_jsonb(v_files));
end $$;

-- Borra un incumplimiento con su historial, alertas y evidencias.
create or replace function public.admin_delete_nonconformity(p_nc uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_files text[];
  v_desc text;
begin
  perform public.check_reset_code(p_code);
  select description into v_desc from public.nonconformities where id = p_nc;
  if v_desc is null then raise exception 'El incumplimiento no existe'; end if;
  select coalesce(array_agg(storage_path), '{}') into v_files from public.attachments where nonconformity_id = p_nc;
  delete from public.attachments where nonconformity_id = p_nc;
  delete from storage.objects where bucket_id = 'evidencias' and name = any(v_files);
  delete from public.alerts where nonconformity_id = p_nc;
  delete from public.nonconformities where id = p_nc;
  perform public.log_activity('eliminar', 'incumplimiento', p_nc::text, jsonb_build_object('descripcion', v_desc));
  return jsonb_build_object('ok', true, 'deleted_files', to_jsonb(v_files));
end $$;

-- Reinicio total de los datos operativos. Conserva usuarios, sucursales, cuestionarios,
-- identidad visual y manual. Reinicia la numeración de informes.
create or replace function public.admin_reset_data(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_files text[];
  v_audits integer;
  v_ncs integer;
begin
  perform public.check_reset_code(p_code);
  perform set_config('app.audit_procedure', 'on', true);
  select count(*) into v_audits from public.audits;
  select count(*) into v_ncs from public.nonconformities;
  select coalesce(array_agg(storage_path), '{}') into v_files from public.attachments;

  delete from public.notifications where true;
  delete from public.attachments where true;
  delete from storage.objects where bucket_id = 'evidencias' and name = any(v_files);
  delete from public.alerts where true;
  delete from public.nonconformity_events where true;
  delete from public.nonconformities where true;
  delete from public.audit_revisions where true;
  delete from public.audit_answers where true;
  delete from public.audit_category_states where true;
  delete from public.generated_reports where true;
  delete from public.audits where true;
  delete from public.commercial_indicators where true;
  delete from public.activity_log where true;
  perform setval('public.report_number_seq', 1, false);

  perform set_config('app.audit_procedure', 'off', true);
  perform public.log_activity('reiniciar_datos', 'sistema', null,
    jsonb_build_object('auditorias', v_audits, 'incumplimientos', v_ncs, 'archivos', coalesce(array_length(v_files, 1), 0)));
  return jsonb_build_object('ok', true, 'audits', v_audits, 'nonconformities', v_ncs, 'deleted_files', to_jsonb(v_files));
end $$;

revoke all on function public.admin_delete_audit(uuid, text) from public, app_anon;
revoke all on function public.admin_delete_nonconformity(uuid, text) from public, app_anon;
revoke all on function public.admin_reset_data(text) from public, app_anon;
grant execute on function public.admin_delete_audit(uuid, text) to app_authenticated;
grant execute on function public.admin_delete_nonconformity(uuid, text) to app_authenticated;
grant execute on function public.admin_reset_data(text) to app_authenticated;
