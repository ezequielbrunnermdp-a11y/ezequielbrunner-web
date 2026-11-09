import Link from "next/link";
import { requireActor } from "@/lib/session";
import { evaluateRange, computeKpis, countGeoIncidents, type EmployeeDay } from "@/lib/board";
import { localDate, addDays, zonedToUtc, fmtTime, fmtMinutes, fmtDate, DEFAULT_TZ } from "@/lib/time";
import { q } from "@/lib/db";
import { scopeSql } from "@/lib/permissions";
import { ALERT_LABEL } from "@/lib/alerts";
import { Card, PageHeader, Stat, Badge, Empty } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { AutoRefresh } from "@/components/auto-refresh";
import { Filters } from "./filters";
import { filterOptions, sp, isUuid, type SP } from "./data";

export const metadata = { title: "Tablero" };

function Row({ d }: { d: EmployeeDay }) {
  const ev = d.evaluations.find((e) => e.status === d.status) ?? d.evaluations[0];
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{d.name}</div>
        <div className="truncate text-xs text-muted">
          {d.branchName}{d.sector ? ` · ${d.sector}` : ""}
          {ev.shift ? ` · turno ${fmtTime(ev.shift.start_at, d.tz)}–${fmtTime(ev.shift.end_at, d.tz)}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={d.status} leaveType={ev.leaveType} />
        <span className="text-[11px] tabular-nums text-muted">
          {ev.session?.in && `E ${fmtTime(ev.session.in.occurred_at, d.tz)}`}
          {ev.session?.out && ` · S ${fmtTime(ev.session.out.occurred_at, d.tz)}`}
          {ev.lateMinutes > 0 && <span className="text-amber-600"> · +{ev.lateMinutes}′</span>}
        </span>
      </div>
    </li>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "dashboard.view" });
  const s = await searchParams;
  const today = localDate(new Date(), DEFAULT_TZ);
  const date = sp(s, "date")?.match(/^\d{4}-\d{2}-\d{2}$/) ? sp(s, "date")! : today;
  const f = {
    companyId: isUuid(sp(s, "company")) ? sp(s, "company") : undefined,
    branchId: isUuid(sp(s, "branch")) ? sp(s, "branch") : undefined,
    employeeId: isUuid(sp(s, "employee")) ? sp(s, "employee") : undefined,
    supervisorId: isUuid(sp(s, "supervisor")) ? sp(s, "supervisor") : undefined,
    sector: sp(s, "sector"),
  };
  const [options, days, geo] = await Promise.all([
    filterOptions(a),
    evaluateRange(a, date, date, f),
    countGeoIncidents(a, zonedToUtc(date), zonedToUtc(addDays(date, 1)), f),
  ]);
  const k = computeKpis(days, geo);
  const relevant = days.filter((d) => d.status !== "not_scheduled");
  const groups = [
    { title: "Presentes ahora", items: relevant.filter((d) => d.status === "present"), tone: "green" as const },
    { title: "Todavía no ficharon", items: relevant.filter((d) => ["missing", "scheduled"].includes(d.status)), tone: "amber" as const },
    { title: "Finalizaron su jornada", items: relevant.filter((d) => d.status === "finished"), tone: "blue" as const },
    { title: "Ausentes / incompletas", items: relevant.filter((d) => ["absent", "incomplete"].includes(d.status)), tone: "red" as const },
    { title: "Con novedad o sin turno", items: relevant.filter((d) => ["on_leave", "unscheduled"].includes(d.status)), tone: "violet" as const },
  ];
  const p: unknown[] = [];
  const alerts = await q(
    `select al.id, al.type, al.severity, al.message, al.created_at from alerts al
     where al.acknowledged_at is null and al.severity <> 'info' and ${scopeSql(a, "al.company_id", "al.branch_id", p)}
     order by al.created_at desc limit 6`, p);

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader
        title="Tablero de asistencia"
        subtitle={<span className="inline-block first-letter:uppercase">{fmtDate(zonedToUtc(date, "12:00"), DEFAULT_TZ, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{date === today ? " · se actualiza cada minuto" : ""}</span>}
      />
      <Filters values={{ company: f.companyId, branch: f.branchId, employee: f.employeeId, supervisor: f.supervisorId, sector: f.sector, date }} options={options} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Programados" value={k.scheduled} hint={`${k.onLeave} con novedad`} />
        <Stat label="Presentes" value={k.present} tone="good" hint={`${k.finished} finalizaron`} />
        <Stat label="Ausentes / sin fichar" value={k.absent} tone={k.absent ? "bad" : undefined} hint={`${k.pending} aún no inician`} />
        <Stat label="Llegadas tarde" value={k.late} tone={k.late ? "warn" : undefined} />
        <Stat label="Salidas anticipadas" value={k.earlyLeave} tone={k.earlyLeave ? "warn" : undefined} />
        <Stat label="Fichadas incompletas" value={k.incomplete} tone={k.incomplete ? "warn" : undefined} />
        <Stat label="Horas registradas" value={fmtMinutes(k.workedMinutes)} />
        <Stat label="Horas adicionales a revisar" value={fmtMinutes(k.extraMinutes)} hint="No son horas extra liquidadas" />
        <Stat label="Asistencia" value={k.attendancePct == null ? "—" : `${k.attendancePct}%`} tone={k.attendancePct != null && k.attendancePct < 90 ? "warn" : "good"} hint="Sobre turnos ya iniciados" />
        <Stat label="Incidencias de ubicación" value={k.geoIncidents} tone={k.geoIncidents ? "warn" : undefined} hint="Intentos rechazados" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
          {groups.map((g) => (
            <Card key={g.title} title={<span className="flex items-center gap-2">{g.title}<Badge tone={g.tone}>{g.items.length}</Badge></span>}>
              {g.items.length === 0 ? <p className="text-sm text-muted">Nadie en este estado.</p> : (
                <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">{g.items.map((d) => <Row key={d.employeeId} d={d} />)}</ul>
              )}
            </Card>
          ))}
        </div>
        <Card title="Alertas recientes" action={<Link href="/admin/alertas" className="text-xs font-medium text-brand-600">Ver todas</Link>}>
          {alerts.length === 0 ? <Empty>Sin alertas pendientes.</Empty> : (
            <ul className="space-y-3">
              {alerts.map((al) => (
                <li key={al.id} className="text-sm">
                  <div className="flex items-center gap-2"><Badge tone={al.severity === "critical" ? "red" : "amber"}>{ALERT_LABEL[al.type] ?? al.type}</Badge><span className="text-xs text-muted">{fmtTime(al.created_at)}</span></div>
                  <p className="mt-1">{al.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
