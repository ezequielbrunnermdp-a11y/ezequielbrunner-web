-- Defensa en profundidad para despliegues en Supabase.
-- La aplicación se conecta con un rol de servidor y aplica los permisos en código.
-- Este script habilita RLS y no crea políticas para los roles anon/authenticated,
-- de modo que la API pública de Supabase (PostgREST) NO puede leer ni escribir
-- ninguna tabla aunque alguien obtenga la anon key.
-- Ejecutar manualmente en el SQL Editor de Supabase luego de 001_init.sql.

do $$
declare t text;
begin
  foreach t in array array[
    'users','sessions','companies','memberships','branches','conversations',
    'participants','imports','messages','analysis_runs','findings',
    'finding_evidence','tasks','task_events','audit_log','schema_migrations'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
