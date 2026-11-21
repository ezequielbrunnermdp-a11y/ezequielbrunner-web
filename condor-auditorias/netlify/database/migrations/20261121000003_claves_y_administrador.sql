-- =====================================================================
-- Migración 3: clave de firma de sesiones y administrador inicial.
-- La clave se genera aleatoriamente dentro de la base al instalar (no está en el código)
-- y solo es legible por el usuario propietario (no por los roles de la aplicación).
-- =====================================================================

create table if not exists auth.secrets (
  id integer primary key default 1 check (id = 1),
  jwt_secret text not null
);
revoke all on auth.secrets from public, app_anon, app_authenticated;

insert into auth.secrets (id, jwt_secret)
values (1, encode(gen_random_bytes(48), 'base64'))
on conflict (id) do nothing;

-- Administrador inicial (la contraseña se entrega por un canal privado y debe cambiarse
-- desde «Cambiar contraseña» en el primer ingreso). Solo se crea si no hay administradores.
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    return;
  end if;
  insert into auth.users (email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
  values ('admin@condor.local', '$2a$12$NSW9RFTPyvhL6YExSENDM.XYs2XKbiFKhx2GbQzo7F5ydbygiqSn2',
          '{"role": "admin", "active": true, "full_name": "Administración El Cóndor"}',
          '{"full_name": "Administración El Cóndor"}')
  on conflict (email) do nothing
  returning id into v_id;
  if v_id is not null then
    insert into public.profiles (id, email, full_name, role, active)
    values (v_id, 'admin@condor.local', 'Administración El Cóndor', 'admin', true)
    on conflict (id) do update set role = 'admin', active = true;
  end if;
end $$;
