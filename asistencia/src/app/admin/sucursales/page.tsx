import Link from "next/link";
import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { scopeSql } from "@/lib/permissions";
import { Card, PageHeader, Badge, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveBranch } from "../actions";
import { filterOptions } from "../data";
import { BranchFields } from "./form";

export const metadata = { title: "Sucursales" };

export default async function Sucursales() {
  const a = await requireActor({ cap: "branches.manage" });
  const p: unknown[] = [];
  const rows = await q(
    `select b.*, c.name as company_name,
       (select count(*)::int from employee_branches eb join employees e on e.id = eb.employee_id and e.active where eb.branch_id = b.id) as employees,
       (select count(*)::int from terminals t where t.branch_id = b.id and t.active) as terminals
     from branches b join companies c on c.id = b.company_id where ${scopeSql(a, "b.company_id", "b.id", p)} order by c.name, b.name`, p);
  const { companies } = await filterOptions(a);
  return (
    <>
      <PageHeader title="Sucursales" subtitle="Ubicación, perímetro autorizado y horarios de cada establecimiento." />
      <Card padded={false} className="mb-6">
        <TableWrap>
          <table className="tbl">
            <thead><tr><th>Sucursal</th><th>Empresa</th><th>Perímetro</th><th>Empleados</th><th>Terminales</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium">{b.name}<div className="text-xs font-normal text-muted">{b.address}</div></td>
                  <td>{b.company_name}</td>
                  <td>{b.latitude == null ? <Badge tone="amber">Sin configurar</Badge> : <span className="tabular-nums">{b.radius_m} m · ±{b.max_accuracy_m} m</span>}</td>
                  <td className="tabular-nums">{b.employees}</td>
                  <td>{b.terminals ? b.terminals : <Badge tone="amber">Ninguna</Badge>}</td>
                  <td>{b.active ? <Badge tone="green">Activa</Badge> : <Badge tone="red">Inactiva</Badge>}</td>
                  <td className="text-right"><Link href={`/admin/sucursales/${b.id}`} className="text-sm font-medium text-brand-600">Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <Card title="Nueva sucursal">
        <ActionForm action={saveBranch} resetOnSuccess><BranchFields companies={companies} /><div className="mt-4"><Submit>Crear sucursal</Submit></div></ActionForm>
      </Card>
    </>
  );
}
