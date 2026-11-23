-- =====================================================================
-- Datos iniciales EDITABLES. Todas las sucursales quedan en estado
-- "pending_verification" y SIN coordenadas: el administrador debe confirmar
-- nombre, dirección, coordenadas, razón social y estado antes de operar.
-- Las razones sociales son marcadores a confirmar (no se presume ninguna).
-- =====================================================================
do $$
declare v_org uuid; v_condor uuid; v_palos uuid; v_le_condor uuid; v_le_palos uuid; n text;
begin
  insert into organizations (name, slug) values ('Grupo gastronómico (a configurar)', 'grupo-gastronomico')
    on conflict (slug) do nothing;
  select id into v_org from organizations where slug = 'grupo-gastronomico';

  insert into brands (organization_id, name, slug, accent_color) values
    (v_org, 'El Cóndor Coffee Shop', 'el-condor', '#8A5A3B'),
    (v_org, 'Puerto de Palos', 'puerto-de-palos', '#1F4E5F')
  on conflict (organization_id, slug) do nothing;
  select id into v_condor from brands where organization_id = v_org and slug = 'el-condor';
  select id into v_palos from brands where organization_id = v_org and slug = 'puerto-de-palos';

  select id into v_le_condor from legal_entities where organization_id = v_org and legal_name = 'Razón social a confirmar · El Cóndor';
  if v_le_condor is null then
    insert into legal_entities (organization_id, legal_name, verified) values (v_org, 'Razón social a confirmar · El Cóndor', false) returning id into v_le_condor;
  end if;
  select id into v_le_palos from legal_entities where organization_id = v_org and legal_name = 'Razón social a confirmar · Puerto de Palos';
  if v_le_palos is null then
    insert into legal_entities (organization_id, legal_name, verified) values (v_org, 'Razón social a confirmar · Puerto de Palos', false) returning id into v_le_palos;
  end if;

  foreach n in array array['Güemes','Colón','Alem','Peña','Juan B. Justo','San Luis','Tucumán','San Juan','Chile','Torreón','Rivadavia','Balcarce'] loop
    insert into branches (organization_id, brand_id, legal_entity_id, name, status)
    values (v_org, v_condor, v_le_condor, n, 'pending_verification') on conflict do nothing;
  end loop;
  insert into branches (organization_id, brand_id, legal_entity_id, name, status) values
    (v_org, v_palos, v_le_palos, 'Casino Central', 'pending_verification'),
    (v_org, v_palos, v_le_palos, 'Local 15, Centro Comercial del Puerto', 'pending_verification')
  on conflict do nothing;

  insert into sectors (organization_id, name)
  select v_org, s from unnest(array['Salón','Barra','Cafetería','Cocina','Caja','Limpieza','Administración']) s
  on conflict do nothing;

  insert into mgmt_categories (organization_id, key, name, hr_only, sort) values
    (v_org, 'personal', 'Consulta personal', false, 1),
    (v_org, 'labor_issue', 'Problema laboral', false, 2),
    (v_org, 'interview', 'Solicitud de entrevista', false, 3),
    (v_org, 'suggestion', 'Sugerencia', false, 4),
    (v_org, 'operations', 'Inquietud operativa', false, 5),
    (v_org, 'hr', 'Recursos Humanos', true, 6),
    (v_org, 'other', 'Otro motivo', false, 7)
  on conflict do nothing;

  if not exists (select 1 from labor_rules where organization_id = v_org) then
    insert into labor_rules (organization_id, name, agreement, max_shift_hours, min_rest_hours)
    values (v_org, 'Regla operativa general (a validar con asesoría laboral)', null, 12, 12);
  end if;
end $$;
