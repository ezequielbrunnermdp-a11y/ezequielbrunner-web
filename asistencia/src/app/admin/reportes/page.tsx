import { requireActor } from "@/lib/session";
import { buildReport, resolvePeriod, type Period } from "@/lib/reports";
import { fmtMinutes, localDate, DEFAULT_TZ } from "@/lib/time";
import { Card, PageHeader, Select, TableWrap, Empty } from "@/components/ui";
import { filterOptions, sp, isUuid, type SP } from "../data";
import { Filters } from "../filters";

export const metadata = { title: "Reportes" };

export default async function Reportes({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "reports.view" });
  const s = await searchParams;
  const period = (["diario", "semanal", "quincenal", "mensual", "personalizado"].includes(sp(s, "period") ?? "") ? sp(s, "period") : "semanal") as Period;
  const date = sp(s, "date") ?? localDate(new Date(), DEFAULT_TZ);
  const per = resolvePeriod(period, date, sp(s, "from"), sp(s, "to"));
  const f = {
    companyId: isUuid(sp(s, "company")) ? sp(s, "company") : undefined, branchId: isUuid(sp(s, "branch")) ? sp(s, "branch") : undefined,
    employeeId: isUuid(sp(s, "employee")) ? sp(s, "employee") : undefined, supervisorId: isUuid(sp(s, "supervisor")) ? sp(s, "supervisor") : undefined, sector: sp(s, "sector"),
  };
  const [options, rep] = await Promise.all([filterOptions(a), buildReport(a, per.from, per.to, f)]);
  const qs = new URLSearchParams(Object.entries({ period, date, from: sp(s, "from"), to: sp(s, "to"), company: f.companyId, branch: f.branchId, employee: f.employeeId, supervisor: f.supervisorId, sector: f.sector })
    .filter(([, v]) => v) as [string, string][]);
  const link = (format: string, sheet?: string) => `/api/reports/export?${qs}&format=${format}${sheet ? `&sheet=${sheet}` : ""}`;
  return (
    <>
      <PageHeader title="Reportes" subtitle={per.label}
        actions={<>
          <a href={link("xlsx")} className="rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white">Excel</a>
          <a href={link("pdf")} className="surface rounded-xl px-3.5 py-2 text-sm font-medium">PDF</a>
          <a href={link("csv", "detalle")} className="surface rounded-xl px-3.5 py-2 text-sm font-medium">CSV detalle</a>
          <a href={link("csv", "fichadas")} className="surface rounded-xl px-3.5 py-2 text-sm font-medium">CSV fichadas</a>
        </>} />
      <Filters values={{ company: f.companyId, branch: f.branchId, employee: f.employeeId, supervisor: f.supervisorId, sector: f.sector, date, from: sp(s, "from"), to: sp(s, "to") }}
        options={options} show={["company", "branch", "sector", "supervisor", "employee", "date", ...(period === "personalizado" ? ["from", "to"] : [])]}
        extra={<Select name="period" defaultValue={period} aria-label="Período">
          <option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="personalizado">Personalizado</option>
        </Select>} />
      <Card padded={false} title="Resumen por empleado">
        {rep.summary.length === 0 ? <div className="p-5"><Empty>Sin datos para el período.</Empty></div> : (
          <TableWrap><table className="tbl"><thead><tr><th>Empleado</th><th>Sucursal</th><th>Turnos</th><th>Asistidos</th><th>Ausencias</th><th>Tardanzas</th><th>Sal. antic.</th><th>Incompl.</th><th>Novedades</th><th>Correcciones</th><th>Programado</th><th>Trabajado</th><th>Adic. a revisar</th></tr></thead>
            <tbody>{rep.summary.map((r) => (
              <tr key={r.legajo + r.empresa}>
                <td className="font-medium">{r.empleado}<div className="text-xs font-normal text-muted">Legajo {r.legajo}</div></td>
                <td>{r.sucursal}</td><td className="tabular-nums">{r.turnos}</td><td className="tabular-nums">{r.asistidos}</td>
                <td className={`tabular-nums ${r.ausencias ? "text-rose-600" : ""}`}>{r.ausencias}</td><td className={`tabular-nums ${r.tardanzas ? "text-amber-600" : ""}`}>{r.tardanzas}</td>
                <td className="tabular-nums">{r.salidas_anticipadas}</td><td className="tabular-nums">{r.incompletas}</td><td className="tabular-nums">{r.novedades}</td><td className="tabular-nums">{r.correcciones}</td>
                <td className="tabular-nums">{fmtMinutes(r.min_programados)}</td><td className="tabular-nums">{fmtMinutes(r.min_trabajados)}</td><td className="tabular-nums">{fmtMinutes(r.min_adicionales_a_revisar)}</td>
              </tr>
            ))}</tbody></table></TableWrap>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">El Excel incluye tres hojas: resumen, detalle diario y fichadas con trazabilidad (origen, anulaciones, motivo y aprobador de cada corrección).</p>
    </>
  );
}
