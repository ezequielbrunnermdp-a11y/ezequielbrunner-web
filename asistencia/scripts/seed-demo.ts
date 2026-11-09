/**
 * Datos de DEMOSTRACIÓN, claramente separados (empresa marcada is_demo, correos @demo.local).
 * No son registros laborales reales. Usar en una base de pruebas, no en producción.
 * Requiere ALLOW_DEMO_SEED=true.
 */
import "./env";
import { pool } from "../src/lib/db";
import { hashSecret } from "../src/lib/password";
import { materializeShifts } from "../src/lib/schedules";
import { createPairingCode } from "../src/lib/terminals";
import { localDate, addDays } from "../src/lib/time";

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Definí ALLOW_DEMO_SEED=true para cargar datos de demostración.");
  const p = pool();
  const lat = Number(process.env.DEMO_LAT ?? -38.0055), lng = Number(process.env.DEMO_LNG ?? -57.5426);
  const c = (await p.query(`insert into companies (name, slug, is_demo, report_emails) values ('DEMO — Datos de prueba','demo',true,'{gerencia@demo.local}')
    on conflict (slug) do update set name = excluded.name returning id`)).rows[0];
  const b = (await p.query(`insert into branches (company_id, name, address, latitude, longitude, radius_m, max_accuracy_m)
    values ($1,'Local demo','Dirección de prueba',$2,$3,100,80) on conflict (company_id, name) do update set latitude = excluded.latitude, longitude = excluded.longitude returning id`, [c.id, lat, lng])).rows[0];
  const t = (await p.query(`insert into terminals (branch_id, name) select $1, 'Pantalla demo' where not exists (select 1 from terminals where branch_id = $1) returning id`, [b.id])).rows[0]
    ?? (await p.query(`select id from terminals where branch_id = $1 limit 1`, [b.id])).rows[0];
  const pw = await hashSecret("Demo12345");
  const user = async (email: string, role: string, name: string) =>
    (await p.query(`insert into users (email, password_hash, role, full_name) values ($1,$2,$3,$4) on conflict (email) do update set password_hash = excluded.password_hash returning id`, [email, pw, role, name])).rows[0].id;
  const mgr = await user("gerencia@demo.local", "manager", "Gerencia Demo");
  const sup = await user("encargado@demo.local", "supervisor", "Encargado Demo");
  const adm = await user("admin@demo.local", "company_admin", "Admin Demo");
  await p.query(`insert into user_scopes (user_id, company_id) values ($1,$2),($3,$2) on conflict do nothing`, [mgr, c.id, adm]);
  await p.query(`insert into user_scopes (user_id, company_id, branch_id) values ($1,$2,$3) on conflict do nothing`, [sup, c.id, b.id]);
  const pin = await hashSecret("1234");
  const emps = [["Ana", "Prueba", "9001", "Salón", "08:00", "16:00"], ["Bruno", "Ejemplo", "9002", "Cocina", "10:00", "18:00"], ["Carla", "Muestra", "9003", "Cocina", "22:00", "06:00"]];
  for (const [i, [fn, ln, legajo, sector, st, et]] of emps.entries()) {
    const uid = await user(`empleado${i + 1}@demo.local`, "employee", `${fn} ${ln}`);
    const e = (await p.query(`insert into employees (company_id, user_id, file_number, first_name, last_name, sector, primary_branch_id, supervisor_user_id, pin_hash, is_demo)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) on conflict (company_id, file_number) do update set pin_hash = excluded.pin_hash returning id`, [c.id, uid, legajo, fn, ln, sector, b.id, sup, pin])).rows[0];
    await p.query(`insert into employee_branches values ($1,$2) on conflict do nothing`, [e.id, b.id]);
    const has = (await p.query(`select 1 from schedule_templates where employee_id = $1`, [e.id])).rowCount;
    if (!has) for (const wd of [1, 2, 3, 4, 5, 6])
      await p.query(`insert into schedule_templates (employee_id, branch_id, weekday, start_time, end_time, break_minutes, valid_from) values ($1,$2,$3,$4,$5,30,$6)`, [e.id, b.id, wd, st, et, addDays(localDate(), -30)]);
  }
  await materializeShifts(addDays(localDate(), -7), addDays(localDate(), 14));
  const code = await createPairingCode(t.id);
  console.log(`✔ Datos demo cargados.
  Usuarios (contraseña Demo12345): admin@demo.local · gerencia@demo.local · encargado@demo.local · empleado1..3@demo.local
  PIN de terminal de empleados demo: 1234 (legajos 9001, 9002, 9003)
  Código para vincular la terminal demo (15 min): ${code}
  Ubicación del local demo: ${lat}, ${lng} (radio 100 m)`);
}
main().then(() => pool().end()).catch((e) => { console.error(e.message); process.exit(1); });
