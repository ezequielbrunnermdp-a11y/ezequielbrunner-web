import "server-only";
import { q } from "@/lib/db";
import { scopeSql, type Actor } from "@/lib/permissions";

/** Opciones de filtros limitadas al alcance del usuario. */
export async function filterOptions(actor: Actor) {
  const companies = actor.role === "superadmin"
    ? await q(`select id, name, active from companies order by name`)
    : await q(`select id, name, active from companies where id = any($1) order by name`, [[...new Set(actor.scopes.map((s) => s.company_id))]]);
  const p2: unknown[] = [];
  const branches = await q(
    `select b.id, b.name, b.company_id, c.name as company_name, b.active from branches b join companies c on c.id = b.company_id
     where ${scopeSql(actor, "b.company_id", "b.id", p2)} order by c.name, b.name`, p2);
  const p3: unknown[] = [];
  const employees = await q(
    `select e.id, e.first_name || ' ' || e.last_name as name, e.file_number, e.company_id, e.sector, e.primary_branch_id from employees e
     where e.active and exists (select 1 from employee_branches eb where eb.employee_id = e.id and ${scopeSql(actor, "e.company_id", "eb.branch_id", p3)})
     order by e.last_name, e.first_name`, p3);
  const sectors = [...new Set(employees.map((e) => e.sector).filter(Boolean))].sort() as string[];
  const p4: unknown[] = [];
  const supervisors = await q(
    `select distinct u.id, u.full_name from users u join employees e on e.supervisor_user_id = u.id
     where ${scopeSql(actor, "e.company_id", "e.primary_branch_id", p4)} order by u.full_name`, p4);
  return { companies, branches, employees, sectors, supervisors };
}

export type SP = Record<string, string | string[] | undefined>;
export const sp = (s: SP, k: string) => {
  const v = s[k];
  const x = Array.isArray(v) ? v[0] : v;
  return x && x.length < 100 ? x : undefined;
};
export const isUuid = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s);

export async function managersInScope(a: Actor) {
  const p: unknown[] = [];
  return q(`select distinct u.id, u.full_name from users u join user_scopes s on s.user_id = u.id
            where u.active and u.role in ('supervisor','manager','company_admin') and ${scopeSql(a, "s.company_id", "s.branch_id", p)} order by u.full_name`, p);
}
