import type { PoolClient } from "pg";
import { hashSecret } from "./password";
import { materializeShifts } from "./schedules";
import { localDate, addDays } from "./time";

/**
 * Empresa de DEMOSTRACIÓN, separada y marcada (is_demo, correos @demo.local).
 * No son registros laborales reales. Se puede desactivar desde Empresas.
 */
export async function seedDemo(c: PoolClient, opts: { password: string; pin: string; lat?: number; lng?: number }) {
  const lat = opts.lat ?? -38.0055, lng = opts.lng ?? -57.5426;
  const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows;
  const [co] = await q(`insert into companies (name, slug, is_demo) values ('DEMO — Datos de prueba','demo',true)
    on conflict (slug) do update set name = excluded.name returning id`);
  const [b] = await q(`insert into branches (company_id, name, address, latitude, longitude, radius_m, max_accuracy_m)
    values ($1,'Local demo','Ubicación de prueba (editable)',$2,$3,100,80)
    on conflict (company_id, name) do update set latitude = excluded.latitude, longitude = excluded.longitude returning id`, [co.id, lat, lng]);
  let [t] = await q(`select id from terminals where branch_id = $1 limit 1`, [b.id]);
  if (!t) [t] = await q(`insert into terminals (branch_id, name) values ($1, 'Pantalla demo') returning id`, [b.id]);
  const pw = await hashSecret(opts.password);
  const user = async (email: string, role: string, name: string) =>
    (await q(`insert into users (email, password_hash, role, full_name) values ($1,$2,$3,$4)
      on conflict (email) do update set password_hash = excluded.password_hash returning id`, [email, pw, role, name]))[0].id as string;
  const mgr = await user("gerencia@demo.local", "manager", "Gerencia Demo");
  const sup = await user("encargado@demo.local", "supervisor", "Encargado Demo");
  const adm = await user("admin@demo.local", "company_admin", "Admin Demo");
  await q(`insert into user_scopes (user_id, company_id) values ($1,$2),($3,$2) on conflict do nothing`, [mgr, co.id, adm]);
  await q(`insert into user_scopes (user_id, company_id, branch_id) values ($1,$2,$3) on conflict do nothing`, [sup, co.id, b.id]);
  const pin = await hashSecret(opts.pin);
  const emps: [string, string, string, string, string, string][] = [
    ["Ana", "Prueba", "9001", "Salón", "08:00", "16:00"],
    ["Bruno", "Ejemplo", "9002", "Cocina", "10:00", "18:00"],
    ["Carla", "Muestra", "9003", "Cocina", "22:00", "06:00"],
  ];
  for (const [i, [fn, ln, legajo, sector, st, et]] of emps.entries()) {
    const uid = await user(`empleado${i + 1}@demo.local`, "employee", `${fn} ${ln}`);
    const [e] = await q(`insert into employees (company_id, user_id, file_number, first_name, last_name, sector, primary_branch_id, supervisor_user_id, pin_hash, is_demo)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) on conflict (company_id, file_number) do update set pin_hash = excluded.pin_hash returning id`,
      [co.id, uid, legajo, fn, ln, sector, b.id, sup, pin]);
    await q(`insert into employee_branches values ($1,$2) on conflict do nothing`, [e.id, b.id]);
    const has = await q(`select 1 from schedule_templates where employee_id = $1`, [e.id]);
    if (!has.length) for (const wd of [1, 2, 3, 4, 5, 6])
      await q(`insert into schedule_templates (employee_id, branch_id, weekday, start_time, end_time, break_minutes, valid_from) values ($1,$2,$3,$4,$5,30,$6)`,
        [e.id, b.id, wd, st, et, addDays(localDate(), -30)]);
  }
  await materializeShifts(addDays(localDate(), -7), addDays(localDate(), 14), {}, c);
  return { terminalId: t.id as string, branchId: b.id as string, lat, lng };
}
