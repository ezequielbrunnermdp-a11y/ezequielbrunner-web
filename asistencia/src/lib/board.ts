import { q } from "./db";
import { evaluateDay, type ShiftEvaluation, type DayStatus, type Rules } from "./attendance";
import { scopeSql, type Actor } from "./permissions";
import { addDays, dateRange, zonedToUtc, DEFAULT_TZ } from "./time";

export interface Filters {
  companyId?: string; branchId?: string; employeeId?: string; sector?: string; supervisorId?: string;
}

export interface EmployeeDay {
  employeeId: string; name: string; fileNumber: string; sector: string | null; companyName: string; branchName: string;
  supervisorName: string | null; date: string; evaluations: ShiftEvaluation[]; status: DayStatus; tz: string;
}

const STATUS_PRIORITY: DayStatus[] = ["present", "incomplete", "missing", "absent", "finished", "scheduled", "unscheduled", "on_leave", "not_scheduled"];

/** Evalúa la asistencia de todos los empleados visibles para el actor en un rango de fechas locales. */
export async function evaluateRange(actor: Actor, from: string, to: string, f: Filters = {}): Promise<EmployeeDay[]> {
  const params: unknown[] = [];
  const scope = scopeSql(actor, "e.company_id", "eb.branch_id", params);
  const branchCond = f.branchId ? ` and eb.branch_id = $${params.push(f.branchId)}` : "";
  const conds = [`e.active`, `exists (select 1 from employee_branches eb where eb.employee_id = e.id and ${scope}${branchCond})`];
  if (f.companyId) conds.push(`e.company_id = $${params.push(f.companyId)}`);
  if (f.employeeId) conds.push(`e.id = $${params.push(f.employeeId)}`);
  if (f.sector) conds.push(`e.sector = $${params.push(f.sector)}`);
  if (f.supervisorId) conds.push(`e.supervisor_user_id = $${params.push(f.supervisorId)}`);

  const employees = await q(
    `select e.id, e.first_name || ' ' || e.last_name as name, e.file_number, e.sector, c.name as company_name, b.name as branch_name,
            c.timezone, c.late_tolerance_min, c.early_leave_tolerance_min, c.extra_hours_threshold_min, c.max_shift_hours,
            s.full_name as supervisor_name
     from employees e join companies c on c.id = e.company_id and c.active join branches b on b.id = e.primary_branch_id
     left join users s on s.id = e.supervisor_user_id
     where ${conds.join(" and ")} order by e.last_name, e.first_name`,
    params,
  );
  if (!employees.length) return [];
  const ids = employees.map((e) => e.id);
  const winFrom = zonedToUtc(addDays(from, -1), "00:00", DEFAULT_TZ);
  const winTo = zonedToUtc(addDays(to, 2), "00:00", DEFAULT_TZ);

  const [shifts, punches, leaves] = await Promise.all([
    q(`select s.id, s.employee_id, s.branch_id, to_char(s.work_date, 'YYYY-MM-DD') as work_date, s.start_at, s.end_at, s.break_minutes
       from shifts s where s.employee_id = any($1) and s.status = 'active' and s.work_date between $2 and $3`, [ids, from, to]),
    q(`select id, employee_id, type, occurred_at, source from effective_punches
       where employee_id = any($1) and occurred_at >= $2 and occurred_at < $3`, [ids, winFrom, winTo]),
    q(`select employee_id, type::text, to_char(start_date,'YYYY-MM-DD') as start_date, to_char(end_date,'YYYY-MM-DD') as end_date
       from leaves where employee_id = any($1) and start_date <= $3 and end_date >= $2`, [ids, from, to]),
  ]);
  const group = <T extends { employee_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const list = m.get(r.employee_id);
      if (list) list.push(r); else m.set(r.employee_id, [r]);
    }
    return m;
  };
  const gS = group(shifts), gP = group(punches), gL = group(leaves);
  const now = new Date();
  const out: EmployeeDay[] = [];

  for (const e of employees) {
    const rules: Rules = {
      lateToleranceMin: e.late_tolerance_min, earlyToleranceMin: e.early_leave_tolerance_min,
      extraThresholdMin: e.extra_hours_threshold_min, maxShiftHours: e.max_shift_hours,
    };
    const eShifts = gS.get(e.id) ?? [];
    const ePunches = gP.get(e.id) ?? [];
    for (const date of dateRange(from, to)) {
      const dayStart = zonedToUtc(date, "00:00", e.timezone);
      const dayEnd = zonedToUtc(addDays(date, 1), "00:00", e.timezone);
      const lo = dayStart.getTime() - 86400000, hi = dayEnd.getTime() + 86400000;
      const evaluations = evaluateDay({
        employeeId: e.id, date, rules, now, dayStart, dayEnd,
        shifts: eShifts.filter((s) => s.work_date === date),
        punches: ePunches.filter((p) => p.occurred_at.getTime() >= lo && p.occurred_at.getTime() < hi),
        leaves: gL.get(e.id) ?? [],
      });
      const status = STATUS_PRIORITY.find((s) => evaluations.some((ev) => ev.status === s)) ?? "not_scheduled";
      out.push({
        employeeId: e.id, name: e.name, fileNumber: e.file_number, sector: e.sector, companyName: e.company_name,
        branchName: e.branch_name, supervisorName: e.supervisor_name, date, evaluations, status, tz: e.timezone,
      });
    }
  }
  return out;
}

export interface Kpis {
  scheduled: number; present: number; absent: number; late: number; earlyLeave: number; incomplete: number;
  workedMinutes: number; extraMinutes: number; attendancePct: number | null; geoIncidents: number;
  finished: number; pending: number; onLeave: number;
}

export function computeKpis(days: EmployeeDay[], geoIncidents: number): Kpis {
  const evs = days.flatMap((d) => d.evaluations);
  const scheduledEvs = evs.filter((e) => e.shift && e.status !== "on_leave");
  const started = scheduledEvs.filter((e) => e.status !== "scheduled");
  const attended = started.filter((e) => e.session);
  return {
    scheduled: scheduledEvs.length,
    present: evs.filter((e) => e.status === "present").length,
    finished: evs.filter((e) => e.status === "finished").length,
    pending: evs.filter((e) => e.status === "scheduled").length,
    absent: evs.filter((e) => e.status === "absent" || e.status === "missing").length,
    late: evs.filter((e) => e.lateMinutes > 0).length,
    earlyLeave: evs.filter((e) => e.earlyLeaveMinutes > 0).length,
    incomplete: evs.filter((e) => e.status === "incomplete").length,
    onLeave: days.filter((d) => d.status === "on_leave").length,
    workedMinutes: evs.reduce((a, e) => a + e.workedMinutes, 0),
    extraMinutes: evs.reduce((a, e) => a + e.extraMinutes, 0),
    attendancePct: started.length ? Math.round((attended.length / started.length) * 1000) / 10 : null,
    geoIncidents,
  };
}

export async function countGeoIncidents(actor: Actor, from: Date, to: Date, f: Filters = {}): Promise<number> {
  const params: unknown[] = [from, to];
  const scope = scopeSql(actor, "a.company_id", "a.branch_id", params);
  const extra: string[] = [];
  if (f.companyId) extra.push(`a.company_id = $${params.push(f.companyId)}`);
  if (f.branchId) extra.push(`a.branch_id = $${params.push(f.branchId)}`);
  if (f.employeeId) extra.push(`a.employee_id = $${params.push(f.employeeId)}`);
  const r = await q(
    `select count(*)::int as n from punch_attempts a
     where a.created_at >= $1 and a.created_at < $2
       and a.reason in ('outside_fence','low_accuracy','invalid_reading','no_location')
       and ${scope} ${extra.length ? "and " + extra.join(" and ") : ""}`,
    params,
  );
  return r[0]?.n ?? 0;
}
