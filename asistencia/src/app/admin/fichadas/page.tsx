import Link from "next/link";
import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { scopeSql } from "@/lib/permissions";
import { fmtDateTime, localDate, addDays, zonedToUtc, DEFAULT_TZ } from "@/lib/time";
import { MESSAGES } from "@/lib/punch";
import { Card, PageHeader, Badge, TableWrap, Empty } from "@/components/ui";
import { SourceBadge } from "@/components/status";
import { filterOptions, sp, isUuid, type SP } from "../data";
import { Filters } from "../filters";

export const metadata = { title: "Fichadas" };

export default async function Fichadas({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "dashboard.view" });
  const s = await searchParams;
  const today = localDate(new Date(), DEFAULT_TZ);
  const from = sp(s, "from")?.match(/^\d{4}-\d{2}-\d{2}$/) ? sp(s, "from")! : addDays(today, -6);
  const to = sp(s, "to")?.match(/^\d{4}-\d{2}-\d{2}$/) ? sp(s, "to")! : today;
  const tab = sp(s, "tab") === "rechazos" ? "rechazos" : "fichadas";
  const p: unknown[] = [zonedToUtc(from), zonedToUtc(addDays(to, 1))];
  const alias = tab === "fichadas" ? "p" : "x";
  const conds = [`${scopeSql(a, `${alias}.company_id`, `${alias}.branch_id`, p)}`];
  if (isUuid(sp(s, "company"))) conds.push(`${alias}.company_id = $${p.push(sp(s, "company"))}`);
  if (isUuid(sp(s, "branch"))) conds.push(`${alias}.branch_id = $${p.push(sp(s, "branch"))}`);
  if (isUuid(sp(s, "employee"))) conds.push(`${alias}.employee_id = $${p.push(sp(s, "employee"))}`);
  const rows = tab === "fichadas"
    ? await q(
      `select p.*, e.first_name || ' ' || e.last_name as name, e.file_number, b.name as branch_name, b.timezone,
              v.voided_at, cr.reason as correction_reason, u.full_name as approver
       from punches p join employees e on e.id = p.employee_id join branches b on b.id = p.branch_id
       left join punch_voids v on v.punch_id = p.id left join correction_requests cr on cr.id = p.correction_id left join users u on u.id = cr.reviewed_by
       where p.occurred_at >= $1 and p.occurred_at < $2 and ${conds.join(" and ")} order by p.occurred_at desc limit 1000`, p)
    : await q(
      `select x.*, e.first_name || ' ' || e.last_name as name, e.file_number, b.name as branch_name from punch_attempts x
       left join employees e on e.id = x.employee_id left join branches b on b.id = x.branch_id
       where x.created_at >= $1 and x.created_at < $2 and ${conds.join(" and ")} order by x.created_at desc limit 1000`, p);
  const options = await filterOptions(a);
  const qs = (t: string) => { const u = new URLSearchParams(Object.entries(s).filter(([, v]) => typeof v === "string") as [string, string][]); u.set("tab", t); return `?${u}`; };
  return (
    <>
      <PageHeader title="Fichadas" subtitle="Registro original e inmutable. Las correcciones se muestran aparte y las anulaciones conservan el dato original." />
      <Filters values={{ company: sp(s, "company"), branch: sp(s, "branch"), employee: sp(s, "employee"), from, to }} options={options}
        show={["company", "branch", "employee", "from", "to"]} extra={<input type="hidden" name="tab" value={tab} />} />
      <div className="mb-4 flex gap-1">
        <Link href={qs("fichadas")} className={`rounded-lg px-3 py-1.5 text-sm ${tab === "fichadas" ? "bg-brand-500/10 font-medium text-brand-700 dark:text-blue-300" : "text-muted"}`}>Fichadas</Link>
        <Link href={qs("rechazos")} className={`rounded-lg px-3 py-1.5 text-sm ${tab === "rechazos" ? "bg-brand-500/10 font-medium text-brand-700 dark:text-blue-300" : "text-muted"}`}>Intentos rechazados</Link>
      </div>
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty>Sin registros en el período.</Empty></div> : tab === "fichadas" ? (
          <TableWrap><table className="tbl"><thead><tr><th>Fecha y hora</th><th>Empleado</th><th>Tipo</th><th>Sucursal</th><th>Origen</th><th>Validación / detalle</th></tr></thead><tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.voided_at ? "opacity-55" : ""}>
                <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.occurred_at, r.timezone)}</td>
                <td><Link href={`/admin/empleados/${r.employee_id}`} className="font-medium hover:text-brand-600">{r.name}</Link><div className="text-xs text-muted">Legajo {r.file_number}</div></td>
                <td>{r.type === "in" ? "Entrada" : "Salida"}</td>
                <td>{r.branch_name}</td>
                <td><SourceBadge source={r.source} voided={!!r.voided_at} /></td>
                <td className="text-xs text-muted">
                  {r.source === "mobile" && <>A {Math.round(r.distance_m)} m · precisión ±{Math.round(r.accuracy_m)} m · QR verificado</>}
                  {r.source === "terminal" && <>Terminal física de la sucursal</>}
                  {r.source === "correction" && <>Cargada el {fmtDateTime(r.recorded_at, r.timezone)} · aprobó {r.approver} · “{r.correction_reason}”</>}
                  {r.flags?.filter((f: string) => f !== "correccion_administrativa").length > 0 && <div className="text-amber-600">{r.flags.join(", ")}</div>}
                </td>
              </tr>
            ))}
          </tbody></table></TableWrap>
        ) : (
          <TableWrap><table className="tbl"><thead><tr><th>Fecha y hora</th><th>Empleado</th><th>Intento</th><th>Sucursal</th><th>Motivo</th><th>Detalle</th></tr></thead><tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.created_at)}</td>
                <td>{r.name ?? "Desconocido"}{r.file_number && <div className="text-xs text-muted">Legajo {r.file_number}</div>}</td>
                <td>{r.type === "in" ? "Entrada" : r.type === "out" ? "Salida" : "—"}</td>
                <td>{r.branch_name ?? "—"}</td>
                <td><Badge tone={["outside_fence", "qr_bad_signature", "qr_reused"].includes(r.reason) ? "red" : "amber"}>{r.reason}</Badge></td>
                <td className="max-w-80 text-xs text-muted">{r.distance_m ? `A ${Math.round(r.distance_m)} m · ` : ""}{r.accuracy_m ? `±${Math.round(r.accuracy_m)} m · ` : ""}{MESSAGES[r.reason]?.slice(0, 80)}</td>
              </tr>
            ))}
          </tbody></table></TableWrap>
        )}
      </Card>
    </>
  );
}
