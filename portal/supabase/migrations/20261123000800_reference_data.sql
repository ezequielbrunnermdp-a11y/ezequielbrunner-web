-- =====================================================================
-- Datos de referencia: catálogo de permisos y roles iniciales del sistema.
-- Las organizaciones pueden crear roles propios combinando permisos.
-- =====================================================================
insert into public.permissions (key, category, description) values
  ('org.manage',                 'Organización', 'Configurar organización, marcas, razones sociales, reglas y categorías'),
  ('branches.manage',            'Organización', 'Administrar sucursales, coordenadas, perímetros y sectores'),
  ('roles.manage',               'Organización', 'Asignar y quitar roles'),
  ('audit.view',                 'Organización', 'Consultar el registro de auditoría'),
  ('employees.view',             'Personal',     'Ver personal y su información laboral básica'),
  ('employees.view_private',     'Personal',     'Ver datos personales sensibles (DNI, CUIL, domicilio)'),
  ('employees.manage',           'Personal',     'Invitar, dar de baja y modificar asignaciones de personal'),
  ('schedules.view',             'Horarios',     'Ver horarios del equipo'),
  ('schedules.manage',           'Horarios',     'Crear, publicar y modificar horarios; aprobar cambios de turno'),
  ('attendance.view',            'Asistencia',   'Ver fichadas, jornadas y alertas'),
  ('attendance.manage',          'Asistencia',   'Revisar fichadas, aprobar correcciones y registrar fichadas supervisadas'),
  ('kiosk.manage',               'Asistencia',   'Vincular y revocar tablets y pantallas de QR'),
  ('requests.review',            'RR. HH.',      'Aprobar o rechazar solicitudes de vacaciones, permisos y otras'),
  ('meetings.manage',            'RR. HH.',      'Recibir y gestionar solicitudes de reunión'),
  ('tickets.receive',            'RR. HH.',      'Recibir mensajes de "Hablar con gerencia"'),
  ('docs.manage',                'Documentos',   'Publicar documentación laboral no sensible y general'),
  ('payroll.view',               'Documentos',   'Publicar y ver recibos, contratos y documentación disciplinaria o médica'),
  ('community.publish',          'Comunidad',    'Publicar contenido institucional, eventos, beneficios y encuestas'),
  ('community.moderate',         'Comunidad',    'Moderar denuncias de contenido (sin acceso a mensajes privados)'),
  ('trainings.manage',           'Capacitación', 'Crear y asignar capacitaciones; ver progreso'),
  ('reports.view',               'Reportes',     'Generar y exportar reportes')
on conflict (key) do update set category = excluded.category, description = excluded.description;

with r(key, name, description) as (values
  ('company_admin',   'Administrador de empresa', 'Configuración completa de la organización'),
  ('general_manager', 'Gerente general',          'Supervisión operativa de todas las sucursales autorizadas'),
  ('branch_manager',  'Gerente de sucursal',      'Gestión de su sucursal'),
  ('supervisor',      'Encargado',                'Horarios y asistencia de su equipo'),
  ('hr',              'Recursos Humanos',         'Personal, solicitudes, documentos y legajos'),
  ('auditor',         'Auditor autorizado',       'Lectura de asistencia, reportes y auditoría'))
insert into public.roles (organization_id, key, name, description, is_system)
select null, key, name, description, true from r
on conflict do nothing;

with m(role_key, perms) as (values
  ('company_admin',   array['org.manage','branches.manage','roles.manage','audit.view','employees.view','employees.view_private','employees.manage',
                            'schedules.view','schedules.manage','attendance.view','attendance.manage','kiosk.manage','requests.review',
                            'meetings.manage','tickets.receive','docs.manage','payroll.view','community.publish','community.moderate',
                            'trainings.manage','reports.view']),
  ('general_manager', array['branches.manage','employees.view','employees.manage','schedules.view','schedules.manage','attendance.view',
                            'attendance.manage','kiosk.manage','requests.review','meetings.manage','tickets.receive','docs.manage',
                            'community.publish','community.moderate','trainings.manage','reports.view']),
  ('branch_manager',  array['employees.view','schedules.view','schedules.manage','attendance.view','attendance.manage','kiosk.manage',
                            'requests.review','meetings.manage','tickets.receive','community.publish','trainings.manage','reports.view']),
  ('supervisor',      array['employees.view','schedules.view','schedules.manage','attendance.view','attendance.manage']),
  ('hr',              array['employees.view','employees.view_private','employees.manage','requests.review','meetings.manage',
                            'tickets.receive','docs.manage','payroll.view','trainings.manage','reports.view','attendance.view']),
  ('auditor',         array['employees.view','attendance.view','schedules.view','reports.view','audit.view']))
insert into public.role_permissions (role_id, permission_key)
select r.id, unnest(m.perms) from m join public.roles r on r.key = m.role_key and r.organization_id is null
on conflict do nothing;
