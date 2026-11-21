// Genera la migración de datos iniciales (sucursales + cuestionario v1) desde supabase/seed/cuestionario_v1.json
import { readFileSync, writeFileSync } from 'node:fs';

const cats = JSON.parse(readFileSync(new URL('../supabase/seed/cuestionario_v1.json', import.meta.url), 'utf8'));
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const branches = ['San Luis', 'Colón', 'Alem', 'Tucumán', 'San Juan', 'Chile', 'Torreón', 'Rivadavia', 'Balcarce'];

let sql = `-- =====================================================================
-- Migración 2: datos iniciales (generada por scripts/generar-seed.mjs)
-- Sucursales iniciales y versión 1 del cuestionario integral (15 categorías)
-- =====================================================================
insert into public.branches (name) values
${branches.map((b) => `  (${q(b)})`).join(',\n')}
on conflict (name) do nothing;

do $$
declare
  v_version uuid;
  v_cat uuid;
begin
  if exists (select 1 from public.questionnaire_versions) then
    return;
  end if;
  perform set_config('app.seeding', 'on', true);
  insert into public.questionnaire_versions (number, name, status, published_at, notes)
  values (1, 'Cuestionario integral de auditoría', 'publicada', now(), 'Versión inicial')
  returning id into v_version;
`;
cats.forEach((c, i) => {
  sql += `
  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, ${i + 1}, ${q(c.code)}, ${q(c.name)}, ${c.weight}, ${q(c.description)}, ${q(c.extras)}, '${c.kind === 'document' ? 'documento' : 'puntaje'}')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
${c.questions
  .map((qq, j) => {
    const o = typeof qq === 'string' ? { text: qq } : qq;
    return `    (v_cat, ${j + 1}, ${q(o.text)}, ${q(o.guidance)}, ${o.critical ? 'true' : 'false'})`;
  })
  .join(',\n')};
`;
});
sql += `  perform set_config('app.seeding', 'off', true);
end $$;
`;
writeFileSync(new URL('../supabase/migrations/20261121000002_datos_iniciales.sql', import.meta.url), sql);
console.log('OK', cats.length, 'categorías');
