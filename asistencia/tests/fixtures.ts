import { randomUUID } from "node:crypto";
import { one, q } from "@/lib/db";
import { hashSecret } from "@/lib/password";
import { issueQrToken } from "@/lib/qr";

/** Coordenadas de prueba (no corresponden a ningún local real). */
export const CENTER = { lat: -38.0, lng: -57.55 };

export async function makeCompany(name = "Empresa " + randomUUID().slice(0, 6)) {
  return one(`insert into companies (name, slug, is_demo) values ($1,$2,true) returning *`, [name, name.toLowerCase().replace(/\W+/g, "-") + randomUUID().slice(0, 4)]);
}
export async function makeBranch(companyId: string, opts: Partial<{ lat: number | null; lng: number | null; radius: number; maxAcc: number }> = {}) {
  return one(
    `insert into branches (company_id, name, latitude, longitude, radius_m, max_accuracy_m) values ($1,$2,$3,$4,$5,$6) returning *`,
    [companyId, "Sucursal " + randomUUID().slice(0, 6), opts.lat === undefined ? CENTER.lat : opts.lat, opts.lng === undefined ? CENTER.lng : opts.lng, opts.radius ?? 80, opts.maxAcc ?? 60],
  );
}
export async function makeTerminal(branchId: string) {
  return one(`insert into terminals (branch_id, name) values ($1,'Pantalla') returning *`, [branchId]);
}
let n = 0;
export async function makeUser(role: string, scopes: { company_id: string; branch_id?: string | null }[] = []) {
  const u = await one(`insert into users (email, password_hash, role, full_name) values ($1,$2,$3,$4) returning *`, [
    `u${++n}-${randomUUID().slice(0, 6)}@test.local`, await hashSecret("Clave12345"), role, `Usuario ${n}`,
  ]);
  for (const s of scopes) await q(`insert into user_scopes (user_id, company_id, branch_id) values ($1,$2,$3)`, [u.id, s.company_id, s.branch_id ?? null]);
  return u;
}
export async function makeEmployee(companyId: string, branchId: string, extraBranches: string[] = [], pin?: string) {
  const u = await makeUser("employee");
  const e = await one(
    `insert into employees (company_id, user_id, file_number, first_name, last_name, primary_branch_id, pin_hash, is_demo)
     values ($1,$2,$3,'Prueba','Empleado',$4,$5,true) returning *`,
    [companyId, u.id, String(1000 + ++n), branchId, pin ? await hashSecret(pin) : null],
  );
  for (const b of [branchId, ...extraBranches]) await q(`insert into employee_branches values ($1,$2)`, [e.id, b]);
  return { user: u, employee: e };
}
export function qrFor(branchId: string, terminalId: string, now = Date.now()) {
  return issueQrToken(branchId, terminalId, now).token;
}
/** Desplaza un punto `meters` hacia el norte. */
export function north(meters: number) {
  return { lat: CENTER.lat + meters / 111_320, lng: CENTER.lng };
}
export const ctx = { ip: "127.0.0.1", userAgent: "vitest" };
export const key = () => randomUUID().replace(/-/g, "");

/** Mueve hacia atrás todas las fichadas de un empleado (sólo para pruebas: desactiva el trigger en la sesión). */
export async function shiftPunchesBack(employeeId: string, minutes: number) {
  const { tx } = await import("@/lib/db");
  await tx(async (c) => {
    await c.query(`alter table punches disable trigger punches_immutable`);
    await c.query(`update punches set occurred_at = occurred_at - make_interval(mins => $2) where employee_id = $1`, [employeeId, minutes]);
    await c.query(`alter table punches enable trigger punches_immutable`);
  });
}
