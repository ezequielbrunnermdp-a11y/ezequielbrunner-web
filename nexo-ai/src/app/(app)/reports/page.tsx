import type { Metadata } from "next";
import { FileDown, FileSpreadsheet, Lock } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { buildReport, type Period } from "@/lib/reports/service";
import { Button, buttonClass, Card, CardHeader, cx, EmptyState, Input, PageHeader, Select, Stat } from "@/components/ui";
import { todayLocal } from "@/components/labels";

export const metadata: Metadata = { title: "Reportes" };

function List({ title, items, empty }: { title: string; items: { key: string; main: string; meta: string }[]; empty: string }) {
  return (
    <Card>
      <CardHeader title={title} description={`${items.length} en el período`} />
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key} className="px-5 py-3 text-sm">
              <p className="text-fg">{i.main}</p>
              <p className="mt-0.5 text-xs text-muted">{i.meta}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm text-muted">{empty}</p>
      )}
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx("data.read");
  if (!can(ctx.role, "reports.read")) {
    return <Card><EmptyState icon={<Lock className="size-5" />} title="Sin acceso a reportes" /></Card>;
  }
  const period = (["day", "week", "month"].includes(sp.period ?? "") ? sp.period : "week") as Period;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayLocal();
  const r = await buildReport(ctx, period, date);
  const qs = `period=${period}&date=${date}`;

  return (
    <>
      <PageHeader
        eyebrow="Reportes"
        title={r.label}
        description="Resumen agregado del período. Sólo incluye hallazgos validados por personas y no evalúa a empleados."
        actions={
          <>
            <a href={`/api/reports/export?${qs}&format=pdf`} className={buttonClass("secondary")}><FileDown className="size-4" />PDF</a>
            <a href={`/api/reports/export?${qs}&format=xlsx`} className={buttonClass("secondary")}><FileSpreadsheet className="size-4" />Excel</a>
          </>
        }
      />

      <form className="mb-6 flex flex-wrap gap-2" aria-label="Período">
        <div className="flex rounded-lg bg-surface/70 p-1 ring-1 ring-inset ring-white/[0.06]">
          {(["day", "week", "month"] as const).map((p) => (
            <label key={p} className={cx("cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium has-[:checked]:bg-white/[0.08] has-[:checked]:text-fg", "text-muted")}>
              <input type="radio" name="period" value={p} defaultChecked={p === period} className="sr-only" />
              {{ day: "Diario", week: "Semanal", month: "Mensual" }[p]}
            </label>
          ))}
        </div>
        <Input type="date" name="date" defaultValue={date} className="w-44" aria-label="Fecha de referencia" />
        <Button type="submit">Ver</Button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Mensajes" value={r.totals.messages} hint={`${r.totals.conversationsActive} conversaciones activas`} />
        <Stat label="Tareas creadas" value={r.totals.tasksCreated} hint={`${r.totals.tasksDiscarded} descartadas`} />
        <Stat label="Cumplidas" value={r.totals.tasksCompleted} tone="ok" />
        <Stat label="Abiertas al cierre" value={r.totals.openAtEnd} tone={r.totals.overdueAtEnd ? "danger" : "neutral"} hint={`${r.totals.overdueAtEnd} vencidas`} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Hallazgos: {r.totals.findingsProposed} detectados · {r.totals.findingsApproved} validados · {r.totals.findingsRejected} descartados en el período.
      </p>

      <Card className="mt-4">
        <CardHeader title="Por sucursal" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2.5 font-medium">Sucursal</th>
                <th className="px-3 py-2.5 text-right font-medium">Abiertas</th>
                <th className="px-3 py-2.5 text-right font-medium">Vencidas</th>
                <th className="px-5 py-2.5 text-right font-medium">Cumplidas en el período</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.byBranch.map((b) => (
                <tr key={b.branch}>
                  <td className="px-5 py-2.5">{b.branch}</td>
                  <td className="px-3 py-2.5 text-right tabular">{b.open}</td>
                  <td className={cx("px-3 py-2.5 text-right tabular", b.overdue > 0 && "text-danger")}>{b.overdue}</td>
                  <td className="px-5 py-2.5 text-right tabular text-ok">{b.completed}</td>
                </tr>
              ))}
              {!r.byBranch.length && <tr><td colSpan={4} className="px-5 py-6 text-center text-muted">Sin tareas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <List title="Incidencias validadas" empty="Sin incidencias validadas." items={r.incidents.map((i, k) => ({ key: `${k}`, main: i.title, meta: `${i.date}${i.branch ? ` · ${i.branch}` : ""} · ${i.status}` }))} />
        <List title="Decisiones validadas" empty="Sin decisiones validadas." items={r.decisions.map((d, k) => ({ key: `${k}`, main: d.title, meta: `${d.date}${d.branch ? ` · ${d.branch}` : ""}` }))} />
        <List title="Tareas cumplidas" empty="Ninguna en el período." items={r.completed.map((c, k) => ({ key: `${k}`, main: c.title, meta: `${c.date}${c.branch ? ` · ${c.branch}` : ""}` }))} />
      </div>
    </>
  );
}
