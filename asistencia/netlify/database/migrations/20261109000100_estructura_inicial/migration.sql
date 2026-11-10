-- Estructura inicial real (editable desde el panel). Sin coordenadas: no se puede fichar
-- en una sucursal hasta que un administrador cargue su ubicación real y su radio.
insert into companies (name, slug) values ('Puerto de Palos', 'puerto-de-palos'), ('El Cóndor', 'el-condor')
on conflict (slug) do nothing;

insert into branches (company_id, name)
select c.id, b.name
from companies c
join (values
  ('puerto-de-palos', 'Casino Central'),
  ('puerto-de-palos', 'Local 15, Centro Comercial del Puerto'),
  ('el-condor', 'Güemes'),
  ('el-condor', 'Colón'),
  ('el-condor', 'Peña'),
  ('el-condor', 'Juan B. Justo'),
  ('el-condor', 'Alem'),
  ('el-condor', 'Fábrica central')
) as b(slug, name) on b.slug = c.slug
on conflict (company_id, name) do nothing;
