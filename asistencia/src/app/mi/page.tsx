import { redirect } from "next/navigation";
import { LogOut, CalendarDays, History, Clock3, Building2 } from "lucide-react";
import { requireActor } from "@/lib/session";
import { employeeHome } from "@/lib/employee";
import { fmtDate, fmtTime, fmtMinutes, localDate } from "@/lib/time";
import { Badge, Card, Empty } from "@/components/ui";
import { SourceBadge } from "@/components/status";
import { ThemeToggle } from "@/components/theme";
import { logoutAction } from "../actions";
import { PunchPanel } from "./punch-panel";

export const metadata = { title: "Mi asistencia" };
export const dynamic = "force-dynamic";

const LEAVE: Record<string, string> = { franco: "Franco", vacaciones: "Vacaciones", licencia_medica: "Licencia médica", licencia_especial: "Licencia especial", feriado: "Feriado", otro: "Novedad" };

export default async function MiPage({ searchParams }: { searchParams: Promise<{ qr?: string }> }) {
  const actor = await requireActor();
  if (actor.must_change_password) redirect("/cuenta?primer-ingreso=1");
  const data = await employeeHome(actor.id);
  const { qr } = await searchParams;
  if (!data) {
    return (
      <main className="mx-auto max-w-md p-6"><Card><p className="text-sm">Tu usuario no está vinculado a un legajo. Consultá con la administración.</p>
        {actor.role !== "employee" && <a className="mt-3 inline-block text-sm text-brand-600" href="/admin">Ir al panel</a>}</Card></main>
    );
  }
  const { employee: e, tz, today } = data;
  const todayShifts = data.shifts.filter((s) => s.work_date === today);
  const leaveToday = data.leaves.find((l) => l.s <= today && l.e >= today);
  const upcoming = data.shifts.filter((s) => s.work_date >= today);

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-[max(env(safe-area-inset-top),1rem)]">
      <header className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{e.first_name} {e.last_name}</h1>
          <p className="flex items-center gap-1 truncate text-xs text-muted"><Building2 className="size-3.5" />{e.company_name} · {e.branch_name}</p>
        </div>
        <div className="flex items-center">
          <ThemeToggle />
          {actor.role !== "employee" && <a href="/admin" className="rounded-lg px-2 py-2 text-xs font-medium text-brand-600">Panel</a>}
          <form action={logoutAction}><button className="rounded-lg p-2 text-muted hover:bg-[var(--surface-2)]" aria-label="Salir"><LogOut className="size-4" /></button></form>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {data.open
          ? <Badge tone="green">● Trabajando desde las {fmtTime(data.last!.occurred_at, tz)}</Badge>
          : <Badge tone="gray">Sin entrada registrada</Badge>}
        {leaveToday && <Badge tone="violet">{LEAVE[leaveToday.type]} hoy</Badge>}
        {todayShifts.map((s, i) => (
          <Badge key={i} tone="blue"><Clock3 className="size-3" />Hoy {fmtTime(s.start_at, tz)}–{fmtTime(s.end_at, tz)}</Badge>
        ))}
        {!todayShifts.length && !leaveToday && <Badge>Sin turno programado hoy</Badge>}
      </div>

      <PunchPanel open={data.open} tz={tz} initialQr={qr} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="surface rounded-2xl p-4"><div className="text-xs text-muted">Horas esta semana</div><div className="mt-1 text-xl font-semibold tabular-nums">{fmtMinutes(data.minutesWeek)}</div></div>
        <div className="surface rounded-2xl p-4"><div className="text-xs text-muted">Horas este mes</div><div className="mt-1 text-xl font-semibold tabular-nums">{fmtMinutes(data.minutesMonth)}</div></div>
      </div>

      <Card className="mt-4" title={<span className="flex items-center gap-2"><CalendarDays className="size-4" />Mis horarios</span>}>
        {upcoming.length === 0 && data.leaves.length === 0 ? <Empty>No tenés turnos cargados para los próximos días.</Empty> : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {data.leaves.map((l, i) => (
              <li key={"l" + i} className="flex justify-between py-2.5"><span>{fmtDate(l.s + "T12:00:00Z", tz)}{l.e !== l.s ? ` al ${fmtDate(l.e + "T12:00:00Z", tz)}` : ""}</span><Badge tone="violet">{LEAVE[l.type]}</Badge></li>
            ))}
            {upcoming.slice(0, 14).map((s, i) => (
              <li key={i} className="flex justify-between gap-2 py-2.5">
                <span className="capitalize">{fmtDate(s.start_at, tz, { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                <span className="text-right tabular-nums">{fmtTime(s.start_at, tz)} – {fmtTime(s.end_at, tz)}{localDate(s.end_at, tz) !== s.work_date && <span className="text-xs text-muted"> (+1)</span>}
                  <span className="block text-xs text-muted">{s.branch_name}{s.break_minutes ? ` · descanso ${s.break_minutes} min` : ""}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4" title={<span className="flex items-center gap-2"><History className="size-4" />Mis fichadas</span>}>
        {data.punches.length === 0 ? <Empty>Todavía no registraste fichadas.</Empty> : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {data.punches.slice(0, 40).map((p) => (
              <li key={p.id} className={`flex items-center justify-between gap-2 py-2.5 ${p.voided ? "opacity-50 line-through" : ""}`}>
                <div>
                  <div className="font-medium">{p.type === "in" ? "Entrada" : "Salida"} · {fmtTime(p.occurred_at, tz)} hs</div>
                  <div className="text-xs text-muted first-letter:uppercase">{fmtDate(p.occurred_at, tz, { weekday: "long", day: "2-digit", month: "2-digit" })} · {p.branch_name}</div>
                </div>
                <SourceBadge source={p.source} voided={p.voided} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 px-2 text-center text-[11px] leading-relaxed text-muted">
        Tu ubicación se consulta sólo al registrar una fichada o cuando tocás “Verificar mi ubicación”, y se usa para validar tu presencia en el establecimiento
        (Ley 25.326). Podés solicitar acceso o rectificación de tus datos a la administración.
        {e.has_pin ? " También podés fichar en la terminal del local con tu legajo y PIN." : ""}
      </p>
      <p className="mt-2 text-center"><a href="/cuenta" className="text-xs text-brand-600">Cambiar contraseña</a></p>
    </main>
  );
}
