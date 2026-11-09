import { q } from "./db";
import { evaluateRange, type Filters } from "./board";
import { STATUS_LABEL } from "./attendance";
import { scopeSql, type Actor } from "./permissions";
import { addDays, fmtDateTime, fmtTime, localDate, zonedToUtc, DEFAULT_TZ } from "./time";

export type Period = "diario" | "semanal" | "quincenal" | "mensual" | "personalizado";

export function resolvePeriod(period: Period, ref: string, from?: string, to?: string): { from: string; to: string; label: string } {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : localDate(new Date(), DEFAULT_TZ);
  const fmt = (x: string) => x.split("-").reverse().join("/");
  switch (period) {
    case "diario": return { from: d, to: d, label: `Día ${fmt(d)}` };
    case "semanal": {
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
      const f = addDays(d, -((dow + 6) % 7));
      return { from: f, to: addDays(f, 6), label: `Semana ${fmt(f)} – ${fmt(addDays(f, 6))}` };
    }
    case "quincenal": {
      const day = Number(d.slice(8));
      const first = d.slice(0, 8) + "01";
      const last = addDays(addDays(first, 32).slice(0, 8) + "01", -1);
      return day <= 15
        ? { from: first, to: d.slice(0, 8) + "15", label: `1.ª quincena ${d.slice(5, 7)}/${d.slice(0, 4)}` }
        : { from: d.slice(0, 8) + "16", to: last, label: `2.ª quincena ${d.slice(5, 7)}/${d.slice(0, 4)}` };
    }
    case "mensual": {
      const first = d.slice(0, 8) + "01";
      return { from: first, to: addDays(addDays(first, 32).slice(0, 8) + "01", -1), label: `Mes ${d.slice(5, 7)}/${d.slice(0, 4)}` };
    }
    default: {
      const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : d;
      let t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : f;
      if (t < f) t = f;
      if (t > addDays(f, 92)) t = addDays(f, 92);
      return { from: f, to: t, label: `${fmt(f)} – ${fmt(t)}` };
    }
  }
}

const SRC: Record<string, string> = { mobile: "Celular", terminal: "Terminal", correction: "Corrección" };

export async function buildReport(actor: Actor, from: string, to: string, f: Filters) {
  const days = await evaluateRange(actor, from, to, f);
  const detail = days.flatMap((d) =>
    d.evaluations
      .filter((e) => e.status !== "not_scheduled")
      .map((e) => ({
        fecha: d.date.split("-").reverse().join("/"),
        empleado: d.name, legajo: d.fileNumber, empresa: d.companyName, sucursal: d.branchName, sector: d.sector ?? "",
        turno: e.shift ? `${fmtTime(e.shift.start_at, d.tz)}-${fmtTime(e.shift.end_at, d.tz)}` : "",
        entrada: e.session?.in ? fmtTime(e.session.in.occurred_at, d.tz) : "",
        origen_entrada: e.session?.in ? SRC[e.session.in.source] ?? e.session.in.source : "",
        salida: e.session?.out ? fmtTime(e.session.out.occurred_at, d.tz) : "",
        origen_salida: e.session?.out ? SRC[e.session.out.source] ?? e.session.out.source : "",
        estado: STATUS_LABEL[e.status] + (e.leaveType ? ` (${e.leaveType.replace("_", " ")})` : ""),
        min_programados: e.scheduledMinutes, min_trabajados: e.workedMinutes,
        min_tarde: e.lateMinutes, min_salida_anticipada: e.earlyLeaveMinutes, min_adicionales_a_revisar: e.extraMinutes,
        status: e.status,
      })),
  );
  const byEmp = new Map<string, any>();
  for (const r of detail) {
    const k = `${r.legajo}|${r.empresa}`;
    const s = byEmp.get(k) ?? { empleado: r.empleado, legajo: r.legajo, empresa: r.empresa, sucursal: r.sucursal, sector: r.sector,
      turnos: 0, asistidos: 0, ausencias: 0, tardanzas: 0, salidas_anticipadas: 0, incompletas: 0, novedades: 0, correcciones: 0,
      min_programados: 0, min_trabajados: 0, min_adicionales_a_revisar: 0 };
    if (r.turno) s.turnos++;
    if (r.entrada) s.asistidos++;
    if (["absent", "missing"].includes(r.status)) s.ausencias++;
    if (r.min_tarde) s.tardanzas++;
    if (r.min_salida_anticipada) s.salidas_anticipadas++;
    if (r.status === "incomplete") s.incompletas++;
    if (r.status === "on_leave") s.novedades++;
    if (r.origen_entrada === "Corrección" || r.origen_salida === "Corrección") s.correcciones++;
    s.min_programados += r.min_programados; s.min_trabajados += r.min_trabajados; s.min_adicionales_a_revisar += r.min_adicionales_a_revisar;
    byEmp.set(k, s);
  }

  // Registro crudo con trazabilidad (incluye anuladas).
  const p: unknown[] = [zonedToUtc(from), zonedToUtc(addDays(to, 1))];
  const conds = [scopeSql(actor, "p.company_id", "p.branch_id", p)];
  if (f.companyId) conds.push(`p.company_id = $${p.push(f.companyId)}`);
  if (f.branchId) conds.push(`p.branch_id = $${p.push(f.branchId)}`);
  if (f.employeeId) conds.push(`p.employee_id = $${p.push(f.employeeId)}`);
  if (f.sector) conds.push(`e.sector = $${p.push(f.sector)}`);
  if (f.supervisorId) conds.push(`e.supervisor_user_id = $${p.push(f.supervisorId)}`);
  const punches = (await q(
    `select p.id, p.occurred_at, p.recorded_at, p.type, p.source, p.distance_m, p.accuracy_m, p.flags, b.name as sucursal, b.timezone,
            e.first_name || ' ' || e.last_name as empleado, e.file_number as legajo, v.voided_at, cr.reason as motivo, ru.full_name as aprobo
     from punches p join employees e on e.id = p.employee_id join branches b on b.id = p.branch_id
     left join punch_voids v on v.punch_id = p.id left join correction_requests cr on cr.id = coalesce(p.correction_id, (select correction_id from punch_voids where punch_id = p.id))
     left join users ru on ru.id = cr.reviewed_by
     where p.occurred_at >= $1 and p.occurred_at < $2 and ${conds.join(" and ")} order by e.last_name, p.occurred_at`, p,
  )).map((r) => ({
    id: r.id, fecha_hora: fmtDateTime(r.occurred_at, r.timezone), registrado: fmtDateTime(r.recorded_at, r.timezone),
    empleado: r.empleado, legajo: r.legajo, sucursal: r.sucursal, tipo: r.type === "in" ? "Entrada" : "Salida",
    origen: r.source === "correction" ? "Corrección administrativa" : r.source === "terminal" ? "Terminal del local" : "Celular (GPS + QR)",
    estado: r.voided_at ? "Anulada" : "Vigente",
    distancia_m: r.distance_m == null ? "" : Math.round(r.distance_m), precision_m: r.accuracy_m == null ? "" : Math.round(r.accuracy_m),
    motivo_correccion: r.motivo ?? "", aprobo: r.aprobo ?? "", observaciones: (r.flags ?? []).join(", "),
  }));
  return { detail, summary: [...byEmp.values()], punches };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "﻿sin datos\n";
  const cols = Object.keys(rows[0]).filter((c) => c !== "status");
  const esc = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita inyección de fórmulas en Excel
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\r\n");
}
