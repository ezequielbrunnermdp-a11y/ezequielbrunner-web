import Link from "next/link";
import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { can, scopeSql } from "@/lib/permissions";
import { Card, PageHeader, Badge, TableWrap, Empty, Input } from "@/components/ui";
import { filterOptions, sp, isUuid, type SP } from "../data";
import { Filters } from "../filters";

export const metadata = { title: "Empleados" };

export default async function Empleados({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "dashboard.view" });
  const s = await searchParams;
  const p: unknown[] = [];
  const conds = [`exists (select 1 from employee_branches eb where eb.employee_id = e.id and ${scopeSql(a, "e.company_id", "eb.branch_id", p)})`];
  if (isUuid(sp(s, "company"))) conds.push(`e.company_id = $${p.push(sp(s, "company"))}`);
  if (isUuid(sp(s, "branch"))) conds.push(`exists (select 1 from employee_branches x where x.employee_id = e.id and x.branch_id = $${p.push(sp(s, "branch"))})`);
  if (sp(s, "sector")) conds.push(`e.sector = $${p.push(sp(s, "sector"))}`);
  if (sp(s, "q")) conds.push(`(e.first_name || ' ' || e.last_name || ' ' || e.file_number || ' ' || coalesce(e.document_number,'')) ilike $${p.push(`%${sp(s, "q")}%`)}`);
  const rows = await q(
    `select e.*, b.name as branch_name, c.name as company_name, u.email, u.last_login_at,
       (select string_agg(b2.name, ', ' order by b2.name) from employee_branches eb2 join branches b2 on b2.id = eb2.branch_id where eb2.employee_id = e.id) as branches
     from employees e join branches b on b.id = e.primary_branch_id join companies c on c.id = e.company_id left join users u on u.id = e.user_id
     where ${conds.join(" and ")} order by e.active desc, e.last_name, e.first_name limit 500`, p);
  const options = await filterOptions(a);
  return (
    <>
      <PageHeader title="Empleados" subtitle={`${rows.length} legajos`}
        actions={can(a, "employees.manage") && <Link href="/admin/empleados/nuevo" className="rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white">Nuevo empleado</Link>} />
      <Filters values={{ company: sp(s, "company"), branch: sp(s, "branch"), sector: sp(s, "sector") }} options={options} show={["company", "branch", "sector"]}
        extra={<Input name="q" defaultValue={sp(s, "q")} placeholder="Buscar nombre, legajo, DNI" />} />
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty>No hay empleados con esos filtros.</Empty></div> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Empleado</th><th>Legajo</th><th>Sector</th><th>Sucursales</th><th>Acceso</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className={e.active ? "" : "opacity-60"}>
                    <td className="font-medium">{e.last_name}, {e.first_name}<div className="text-xs font-normal text-muted">{e.company_name}</div></td>
                    <td className="tabular-nums">{e.file_number}</td>
                    <td>{e.sector ?? "—"}</td>
                    <td className="max-w-64 truncate text-xs">{e.branches}</td>
                    <td className="space-x-1">{e.email ? <Badge tone="blue">App</Badge> : <Badge>Sin app</Badge>}{e.pin_hash && <Badge tone="violet">PIN</Badge>}{e.is_demo && <Badge tone="amber">Demo</Badge>}</td>
                    <td>{e.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
                    <td className="text-right"><Link href={`/admin/empleados/${e.id}`} className="text-sm font-medium text-brand-600">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
