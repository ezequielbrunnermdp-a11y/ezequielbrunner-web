-- Pruebas de base de datos: permisos (RLS), cálculo de ponderaciones, controles críticos y trazabilidad.
-- Se ejecutan con tests/db/run.sh sobre una base local que emula Supabase.
\set ON_ERROR_STOP 1

-- Usuarios de prueba (como lo haría la función administrativa con app_metadata)
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@prueba.local', '{"role":"admin","active":true,"full_name":"Admin Prueba"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'auditor@prueba.local', '{"role":"auditor","active":true,"full_name":"Auditora Prueba"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'fsl@prueba.local', '{"role":"franquiciado","active":true,"full_name":"Franq San Luis"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'fcolon@prueba.local', '{"role":"franquiciado","active":true,"full_name":"Franq Colón"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'intruso@prueba.local', '{}');

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'OK (rechazado) · %: %', p_label, sqlerrm;
    return;
  end;
  raise exception 'FALLA · se esperaba un rechazo: %', p_label;
end $$;

create or replace function pg_temp.check(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FALLA · %', p_label; end if;
  raise notice 'OK · %', p_label;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

select pg_temp.check((select count(*) from public.branches) = 9, 'Nueve sucursales iniciales');
select pg_temp.check((select sum(weight) from public.categories) = 100, 'Las ponderaciones suman 100');
select pg_temp.check((select role from public.profiles where email = 'intruso@prueba.local') = 'franquiciado'
  and not (select active from public.profiles where email = 'intruso@prueba.local'), 'Un alta sin app_metadata queda inactiva y sin privilegios');

-- Asignaciones (como administrador)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
update public.branches set assigned_auditor_id = '00000000-0000-0000-0000-0000000000b1' where name = 'San Luis';
insert into public.user_branches (user_id, branch_id) select '00000000-0000-0000-0000-0000000000c1', id from public.branches where name = 'San Luis';
insert into public.user_branches (user_id, branch_id) select '00000000-0000-0000-0000-0000000000c2', id from public.branches where name = 'Colón';
reset role;

-- ---------------------------------------------------------------------
-- Auditor: solo sucursales asignadas
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
select pg_temp.check((select count(*) from public.branches) = 1, 'El auditor ve solo su sucursal asignada');
select pg_temp.expect_error($$insert into public.audits (branch_id, auditor_id, visit_date) values ((select id from public.branches where name = 'Colón'), auth.uid(), current_date)$$, 'Auditor no puede auditar una sucursal no asignada');
select pg_temp.expect_error($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'Un usuario no puede elevar su propio rol');

insert into public.audits (id, branch_id, auditor_id, visit_date, audit_type)
select '11111111-1111-1111-1111-111111111111', id, auth.uid(), date '2026-11-10', 'programada' from public.branches where name = 'San Luis'
returning id;  -- como lo hace la aplicación (insert + select)
select pg_temp.check((select version_id is not null and auditor_name = 'Auditora Prueba' and status = 'borrador' from public.audits where id = '11111111-1111-1111-1111-111111111111'), 'La auditoría toma la versión publicada y el nombre del auditor');

-- Pendientes bloquean la finalización y no cuentan como cero
select pg_temp.check((public.preview_audit_score('11111111-1111-1111-1111-111111111111') ->> 'pending')::int = 196, 'Las 196 preguntas figuran como pendientes');
select pg_temp.expect_error($$select public.finalize_audit('11111111-1111-1111-1111-111111111111')$$, 'No se finaliza con preguntas pendientes');

-- Todas en 4 puntos → 80
insert into public.audit_answers (audit_id, question_id, score)
select '11111111-1111-1111-1111-111111111111', q.id, 4 from public.questions q;
select pg_temp.check((public.preview_audit_score('11111111-1111-1111-1111-111111111111') ->> 'final_score')::numeric = 80, 'Todas en 4 puntos = 80/100');
select pg_temp.check(public.preview_audit_score('11111111-1111-1111-1111-111111111111') ->> 'classification' = 'SATISFACTORIA', 'Clasificación 80 = SATISFACTORIA');

-- Pregunta no aplicable: se excluye del máximo, exige justificación
update public.audit_answers set score = null, not_applicable = true
where audit_id = '11111111-1111-1111-1111-111111111111'
  and question_id = (select q.id from public.questions q join public.categories c on c.id = q.category_id where c.code = 'delivery' and q.position = 1);
select pg_temp.check(jsonb_array_length(public.preview_audit_score('11111111-1111-1111-1111-111111111111') -> 'errors') = 1, 'Un "No aplica" sin justificar es un error');
update public.audit_answers set na_reason = 'La sucursal no opera delivery por aplicación'
where audit_id = '11111111-1111-1111-1111-111111111111' and not_applicable;
select pg_temp.check((public.preview_audit_score('11111111-1111-1111-1111-111111111111') ->> 'final_score')::numeric = 80, 'Excluir N/A no altera el porcentaje (sigue 80)');

-- Puntaje 0–2 exige observación
update public.audit_answers set score = 1
where audit_id = '11111111-1111-1111-1111-111111111111'
  and question_id = (select q.id from public.questions q join public.categories c on c.id = q.category_id where c.code = 'higiene_bromatologia' and q.position = 5);
select pg_temp.expect_error($$select public.finalize_audit('11111111-1111-1111-1111-111111111111')$$, 'Un puntaje de 1 sin observación bloquea la finalización');
update public.audit_answers set observation = 'Heladera de barra a 11 °C', is_critical = true
where audit_id = '11111111-1111-1111-1111-111111111111' and score = 1;

-- Categoría completa no aplicable: redistribución de pesos
insert into public.audit_category_states (audit_id, category_id, not_applicable, na_reason)
select '11111111-1111-1111-1111-111111111111', id, true, 'La sucursal no participa del Club en esta etapa' from public.categories where code = 'club_condor';
-- Higiene: 24 preguntas en 4 y una en 1 → 97/125 = 77,6 %
-- Resto en 4 → 80 %. Peso aplicable 97 (sin Club). Puntaje = (20·0,776 + 77·0,8)/97·100
select pg_temp.check(
  abs((public.preview_audit_score('11111111-1111-1111-1111-111111111111') ->> 'final_score')::numeric - round((20 * 0.776 + 77 * 0.8) / 97 * 100, 2)) < 0.01,
  'Redistribución proporcional de ponderaciones al excluir una categoría');
select pg_temp.check((public.preview_audit_score('11111111-1111-1111-1111-111111111111') ->> 'redistributed')::boolean, 'Se deja constancia de la redistribución');

-- Incumplimiento crítico durante el borrador
insert into public.nonconformities (id, audit_id, branch_id, category_id, question_id, description, severity, alert_type, responsible, due_date)
select '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', a.branch_id, q.category_id, q.id,
  'Temperatura de conservación fuera de rango', 'critica', 'temperatura', 'Encargado de turno', date '2026-11-12'
from public.audits a, public.questions q join public.categories c on c.id = q.category_id
where a.id = '11111111-1111-1111-1111-111111111111' and c.code = 'higiene_bromatologia' and q.position = 5;

select public.finalize_audit('11111111-1111-1111-1111-111111111111', 'Conclusión de prueba', 'Recomendación de prueba');
select pg_temp.check((select status = 'finalizada' and has_critical and report_number like 'EC-2026-%' from public.audits where id = '11111111-1111-1111-1111-111111111111'), 'Finalización con número de informe y marca de crítico');
select pg_temp.check((select count(*) from public.alerts where audit_id = '11111111-1111-1111-1111-111111111111' and type = 'temperatura' and resolved_at is null) = 1, 'Alerta crítica independiente del puntaje (sin duplicar el control marcado crítico)');
update public.audit_answers set score = 5 where audit_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select count(*) from public.audit_answers where score = 5) = 0, 'No se modifican respuestas de una auditoría finalizada');
update public.audits set final_score = 99 where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select final_score from public.audits where id = '11111111-1111-1111-1111-111111111111') <> 99, 'No se modifica el puntaje de una auditoría finalizada');
reset role;
-- Incluso sin RLS (p. ej. clave de servicio), el trigger impide alterar una auditoría finalizada
select pg_temp.expect_error($$update public.audit_answers set score = 5 where audit_id = '11111111-1111-1111-1111-111111111111'$$, 'Trigger de protección de respuestas finalizadas');
select pg_temp.expect_error($$update public.audits set final_score = 99 where id = '11111111-1111-1111-1111-111111111111'$$, 'Trigger de protección del puntaje finalizado');
set role authenticated;
select pg_temp.expect_error($$select public.begin_audit_correction('11111111-1111-1111-1111-111111111111', 'quiero cambiar')$$, 'El auditor no puede autorizar correcciones');
select pg_temp.check((select count(*) from public.notifications where user_id = auth.uid()) >= 1, 'El auditor asignado recibe notificaciones');
reset role;

-- ---------------------------------------------------------------------
-- Franquiciados: aislamiento entre franquicias
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
select pg_temp.check((select count(*) from public.audits) = 0, 'Franquiciado de Colón no ve auditorías de San Luis');
select pg_temp.check((select count(*) from public.nonconformities) = 0, 'Franquiciado de Colón no ve incumplimientos de San Luis');
select pg_temp.check((select count(*) from public.alerts) = 0, 'Franquiciado de Colón no ve alertas de San Luis');
select pg_temp.expect_error($$select public.franchisee_update_nc('22222222-2222-2222-2222-222222222222', 'corregido', 'x')$$, 'Franquiciado ajeno no puede actuar sobre incumplimientos de otra sucursal');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select pg_temp.check((select count(*) from public.audits) = 1, 'Franquiciado de San Luis ve su auditoría finalizada');
select pg_temp.check((select count(*) from public.audit_answers) = 196, 'Franquiciado ve el detalle de respuestas de su auditoría');
select pg_temp.check((select count(*) from public.notifications where user_id = auth.uid()) >= 1, 'El franquiciado recibe la alerta al finalizar la auditoría');
update public.audit_answers set score = 5;  -- RLS: no afecta filas
select pg_temp.check((select count(*) from public.audit_answers where score = 5) = 0, 'Franquiciado no puede modificar calificaciones');
delete from public.nonconformities;  -- sin política de borrado
select pg_temp.check((select count(*) from public.nonconformities) = 1, 'Franquiciado no puede eliminar observaciones ni incumplimientos');
update public.nonconformities set status = 'cerrado';  -- RLS: staff únicamente
select pg_temp.check((select status from public.nonconformities) = 'pendiente', 'Franquiciado no puede cerrar un incumplimiento');
select pg_temp.expect_error($$select public.franchisee_update_nc('22222222-2222-2222-2222-222222222222', 'cerrado', 'x')$$, 'Franquiciado no puede pasar a cerrado por la función');
select public.franchisee_update_nc('22222222-2222-2222-2222-222222222222', 'corregido', 'Se reemplazó el termostato', date '2026-11-11');
select pg_temp.check((select status = 'corregido' from public.nonconformities), 'Franquiciado informa la corrección');
select pg_temp.expect_error($$insert into public.audits (branch_id, auditor_id, visit_date) select id, auth.uid(), current_date from public.branches$$, 'Franquiciado no puede crear auditorías');
select pg_temp.check((select count(*) from public.branches) = 1, 'Franquiciado ve solo su sucursal');
reset role;

-- Auditor verifica y cierra
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
update public.nonconformities set status = 'cerrado' where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select closed_at is not null and verified_by = auth.uid() from public.nonconformities where id = '22222222-2222-2222-2222-222222222222'), 'El auditor verifica y cierra');
select pg_temp.check((select count(*) from public.nonconformity_events where nonconformity_id = '22222222-2222-2222-2222-222222222222') = 3, 'Historial de cambios del incumplimiento (alta, corregido, cerrado)');
reset role;

-- ---------------------------------------------------------------------
-- Administración: corrección autorizada con versión anterior conservada
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select pg_temp.check((select count(*) from public.branches) = 9, 'El administrador ve todas las sucursales');
select pg_temp.expect_error($$select public.begin_audit_correction('11111111-1111-1111-1111-111111111111', '')$$, 'La corrección exige motivo');
select public.begin_audit_correction('11111111-1111-1111-1111-111111111111', 'Error de carga en Imagen de marca');
select pg_temp.check((select count(*) from public.audit_revisions where audit_id = '11111111-1111-1111-1111-111111111111') = 1, 'Se conserva la versión anterior');
select pg_temp.check((select status = 'borrador' and revision = 2 from public.audits where id = '11111111-1111-1111-1111-111111111111'), 'La auditoría vuelve a borrador como revisión 2');
update public.audit_answers set score = 5 where audit_id = '11111111-1111-1111-1111-111111111111' and score = 4
  and question_id in (select q.id from public.questions q join public.categories c on c.id = q.category_id where c.code = 'imagen_marca');
select public.finalize_audit('11111111-1111-1111-1111-111111111111');
select pg_temp.check((select report_number from public.audits where id = '11111111-1111-1111-1111-111111111111') = (select snapshot -> 'audit' ->> 'report_number' from public.audit_revisions limit 1), 'El número de informe se conserva tras la corrección');
select pg_temp.check((select (snapshot -> 'audit' ->> 'final_score')::numeric < (select final_score from public.audits where id = '11111111-1111-1111-1111-111111111111') from public.audit_revisions limit 1), 'La revisión conserva el puntaje anterior');

-- Cuestionario publicado inmutable; versión nueva editable
select pg_temp.expect_error($$update public.questions set text = 'x' where category_id in (select id from public.categories where code = 'marketing')$$, 'El cuestionario publicado no se modifica');
select public.clone_questionnaire_version();
update public.categories set weight = 4 where code = 'marketing' and version_id = (select id from public.questionnaire_versions where status = 'borrador');
select pg_temp.expect_error($$select public.publish_questionnaire_version((select id from public.questionnaire_versions where status = 'borrador'))$$, 'No se publica si las ponderaciones no suman 100');
update public.categories set weight = 1 where code = 'contrato_franquicia' and version_id = (select id from public.questionnaire_versions where status = 'borrador');
select public.publish_questionnaire_version((select id from public.questionnaire_versions where status = 'borrador'));
select pg_temp.check((select number from public.questionnaire_versions where status = 'publicada') = 2, 'Nueva versión publicada');
select pg_temp.check((select v.number from public.audits a join public.questionnaire_versions v on v.id = a.version_id where a.id = '11111111-1111-1111-1111-111111111111') = 1, 'La auditoría histórica conserva la versión 1');

insert into public.nonconformities (branch_id, description, severity)
select id, 'Prueba de alta con retorno', 'leve' from public.branches where name = 'Colón' returning id;
-- Acciones vencidas
insert into public.nonconformities (branch_id, description, severity, due_date)
select id, 'Reparar matafuegos', 'grave', date '2026-01-01' from public.branches where name = 'Colón';
select pg_temp.check(public.refresh_overdue_alerts() = 1, 'Alerta por acción correctiva vencida');
select pg_temp.check(public.refresh_overdue_alerts() = 0, 'La alerta de vencimiento no se duplica');

-- Desactivar una sucursal no borra su historial
update public.branches set active = false where name = 'San Luis';
select pg_temp.check((select count(*) from public.audits a join public.branches b on b.id = a.branch_id where b.name = 'San Luis') = 1, 'Sucursal desactivada conserva sus auditorías');
delete from public.branches where name = 'San Luis';
select pg_temp.check((select count(*) from public.branches) = 9, 'No se eliminan sucursales (sin política de borrado)');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
select pg_temp.expect_error($$insert into public.audits (branch_id, auditor_id, visit_date) select id, auth.uid(), current_date from public.branches where name = 'San Luis'$$, 'No se audita una sucursal inactiva');
reset role;

-- Usuario sin activar no accede a nada
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
set role authenticated;
select pg_temp.check((select count(*) from public.branches) = 0 and (select count(*) from public.questions) = 0, 'Un usuario inactivo no accede a datos');
reset role;

-- Anónimo: solo la configuración de marca
set role anon;
select pg_temp.check((select count(*) from public.brand_settings) = 1, 'La marca es legible en la pantalla de ingreso');
select pg_temp.check((select count(*) from public.audits) = 0 and (select count(*) from public.branches) = 0, 'Anónimo no accede a auditorías ni sucursales');
select pg_temp.expect_error($$select public.finalize_audit('11111111-1111-1111-1111-111111111111')$$, 'Anónimo no ejecuta funciones de negocio');
reset role;

\echo '=== TODAS LAS PRUEBAS DE BASE DE DATOS PASARON ==='
