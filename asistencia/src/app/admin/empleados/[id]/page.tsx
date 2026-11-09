import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { one, q } from "@/lib/db";
import { can, canAccessBranch } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/time";
import { Card, PageHeader, Badge, TableWrap, Empty } from "@/components/ui";
import { SourceBadge } from "@/components/status";
import { ActionForm, Submit } from "@/components/action-form";
import { InlineAction } from "@/components/inline-action";
import { saveEmployee, toggleEmployee, resetEmployeePassword } from "../../actions";
import { filterOptions, managersInScope } from "../../data";
import { EmployeeFields } from "../form";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireActor({ cap: "dashboard.view" });
  const { id } = await params;
  const e = /^[0-9a-f-]{36}$/.test(id) ? await one(`select e.*, u.email, u.last_login_at from employees e left join users u on u.id = e.user_id where e.id = $1`, [id]) : null;
  if (!e) notFound();
  const authorized = (await q(`select branch_id from employee_branches where employee_id = $1`, [id])).map((r) => r.branch_id);
  if (!authorized.some((b) => canAccessBranch(a, e.company_id, b))) notFound();
  const { branches } = await filterOptions(a);
  const punches = await q(
    `select p.*, b.name as branch_name, exists(select 1 from punch_voids v where v.punch_id = p.id) as voided
     from punches p join branches b on b.id = p.branch_id where p.employee_id = $1 order by p.occurred_at desc limit 30`, [id]);
  const attempts = await q(`select a.*, b.name as branch_name from punch_attempts a left join branches b on b.id = a.branch_id where a.employee_id = $1 order by a.created_at desc limit 10`, [id]);
  const manage = can(a, "employees.manage");
  return (
    <>
      <PageHeader title={`${e.first_name} ${e.last_name}`} subtitle={<>Legajo {e.file_number}{e.email ? ` · ${e.email}` : " · sin usuario de app"}{e.last_login_at ? ` · último ingreso ${fmtDateTime(e.last_login_at)}` : ""}</>}
        actions={<>
          <Link href={`/admin/horarios?employee=${e.id}`} className="surface rounded-xl px-3 py-1.5 text-xs font-medium">Horarios</Link>
          <Link href={`/admin/correcciones?employee=${e.id}`} className="surface rounded-xl px-3 py-1.5 text-xs font-medium">Solicitar corrección</Link>
          {manage && e.user_id && <InlineAction action={resetEmployeePassword} fields={{ id: e.id }} label="Restablecer contraseña" confirm="Se generará una contraseña temporal y se cerrarán sus sesiones." />}
          {manage && <InlineAction action={toggleEmployee} fields={{ id: e.id }} label={e.active ? "Desactivar" : "Activar"} variant={e.active ? "danger" : "primary"} confirm={e.active ? "¿Desactivar? No podrá ingresar ni fichar. Sus registros se conservan." : undefined} />}
        </>} />
      {manage && (
        <Card title="Datos del legajo" className="mb-6">
          <ActionForm action={saveEmployee}>
            <EmployeeFields e={e} branches={branches.filter((b) => b.company_id === e.company_id)} supervisors={await managersInScope(a)} authorized={authorized} hasUser={!!e.user_id} />
            <div className="mt-4"><Submit>Guardar cambios</Submit></div>
          </ActionForm>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Últimas fichadas" padded={false} className="lg:col-span-2">
          {punches.length === 0 ? <div className="p-5"><Empty>Sin fichadas.</Empty></div> : (
            <TableWrap><table className="tbl"><thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Sucursal</th><th>Origen</th><th>Validación</th></tr></thead><tbody>
              {punches.map((p) => (
                <tr key={p.id} className={p.voided ? "opacity-50" : ""}>
                  <td className="tabular-nums">{fmtDateTime(p.occurred_at)}</td>
                  <td>{p.type === "in" ? "Entrada" : "Salida"}</td>
                  <td>{p.branch_name}</td>
                  <td><SourceBadge source={p.source} voided={p.voided} /></td>
                  <td className="text-xs text-muted">{p.source === "mobile" ? `${Math.round(p.distance_m)} m · ±${Math.round(p.accuracy_m)} m` : "—"}{p.flags?.length ? <div className="text-amber-600">{p.flags.join(", ")}</div> : null}</td>
                </tr>
              ))}
            </tbody></table></TableWrap>
          )}
        </Card>
        <Card title="Intentos rechazados recientes">
          {attempts.length === 0 ? <Empty>Sin intentos rechazados.</Empty> : (
            <ul className="space-y-2 text-sm">{attempts.map((x) => (
              <li key={x.id}><Badge tone={x.reason === "outside_fence" ? "red" : "amber"}>{x.reason}</Badge> <span className="text-xs text-muted">{fmtDateTime(x.created_at)}{x.distance_m ? ` · ${Math.round(x.distance_m)} m` : ""}</span></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
