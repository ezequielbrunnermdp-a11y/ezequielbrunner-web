/**
 * Cálculo de estado de asistencia a partir de turnos, novedades y fichadas vigentes.
 * Módulo puro: no accede a la base de datos.
 */
export interface Shift { id: string; employee_id: string; branch_id: string; work_date: string; start_at: Date; end_at: Date; break_minutes: number }
export interface Punch { id: string; employee_id: string; type: "in" | "out"; occurred_at: Date; source: string }
export interface Leave { employee_id: string; type: string; start_date: string; end_date: string }
export interface Rules { lateToleranceMin: number; earlyToleranceMin: number; extraThresholdMin: number; maxShiftHours: number }

export interface WorkSession { in?: Punch; out?: Punch; minutes: number; open: boolean; orphanOut: boolean; abandoned: boolean }

/** Arma pares entrada → salida. Una entrada sin salida seguida de otra entrada queda "abandonada". */
export function pairPunches(punches: Punch[], now: Date, maxShiftHours: number): WorkSession[] {
  const sorted = [...punches].sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime());
  const out: WorkSession[] = [];
  let open: Punch | null = null;
  for (const p of sorted) {
    if (p.type === "in") {
      if (open) out.push({ in: open, minutes: 0, open: false, orphanOut: false, abandoned: true });
      open = p;
    } else if (open) {
      out.push({ in: open, out: p, minutes: (p.occurred_at.getTime() - open.occurred_at.getTime()) / 60000, open: false, orphanOut: false, abandoned: false });
      open = null;
    } else {
      out.push({ out: p, minutes: 0, open: false, orphanOut: true, abandoned: false });
    }
  }
  if (open) {
    const expired = (now.getTime() - open.occurred_at.getTime()) / 3600000 >= maxShiftHours;
    out.push({ in: open, minutes: expired ? 0 : (now.getTime() - open.occurred_at.getTime()) / 60000, open: !expired, orphanOut: false, abandoned: expired });
  }
  return out;
}

export type DayStatus =
  | "on_leave"        // franco / vacaciones / licencia
  | "not_scheduled"   // sin turno y sin fichadas
  | "scheduled"       // turno aún no iniciado (o dentro de la tolerancia)
  | "missing"         // pasó la tolerancia y no fichó entrada
  | "absent"          // turno terminado sin fichadas
  | "present"         // entrada registrada, sin salida
  | "finished"        // jornada completa
  | "incomplete"      // falta entrada o salida
  | "unscheduled";    // fichó sin turno programado

export const STATUS_LABEL: Record<DayStatus, string> = {
  on_leave: "Con novedad",
  not_scheduled: "Sin turno",
  scheduled: "Programado",
  missing: "No fichó",
  absent: "Ausente",
  present: "Presente",
  finished: "Finalizó",
  incomplete: "Fichada incompleta",
  unscheduled: "Fichó sin turno",
};

export interface ShiftEvaluation {
  shift: Shift | null;
  status: DayStatus;
  session: WorkSession | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  scheduledMinutes: number;
  extraMinutes: number; // horas adicionales a revisar (no son horas extra liquidadas)
  leaveType?: string;
}

const MATCH_BEFORE_MIN = 180; // una entrada hasta 3 h antes del turno se asocia a ese turno

export function onLeave(leaves: Leave[], employeeId: string, date: string): Leave | undefined {
  return leaves.find((l) => l.employee_id === employeeId && l.start_date <= date && l.end_date >= date);
}

/**
 * Evalúa un empleado en una fecha local: sus turnos de esa fecha y las sesiones de trabajo
 * que comienzan cerca de ellos. Devuelve una evaluación por turno (o una sin turno).
 */
export function evaluateDay(args: {
  employeeId: string;
  date: string;
  shifts: Shift[];      // turnos del empleado con work_date = date
  punches: Punch[];     // fichadas vigentes del empleado en una ventana amplia (date-1 .. date+1)
  leaves: Leave[];
  rules: Rules;
  now: Date;
  dayStart: Date;       // 00:00 local de date
  dayEnd: Date;         // 00:00 local de date+1
}): ShiftEvaluation[] {
  const { rules, now } = args;
  const sessions = pairPunches(args.punches, now, rules.maxShiftHours);
  const used = new Set<WorkSession>();
  const leave = onLeave(args.leaves, args.employeeId, args.date);
  const result: ShiftEvaluation[] = [];

  const shifts = [...args.shifts].sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
  for (const shift of shifts) {
    const scheduledMinutes = (shift.end_at.getTime() - shift.start_at.getTime()) / 60000 - shift.break_minutes;
    const session = sessions.find((s) => {
      if (used.has(s)) return false;
      const t = (s.in ?? s.out)!.occurred_at.getTime();
      // Una salida huérfana suele ocurrir al final o después del turno.
      const until = s.in ? shift.end_at.getTime() : shift.end_at.getTime() + 6 * 3600000;
      return t >= shift.start_at.getTime() - MATCH_BEFORE_MIN * 60000 && t < until;
    }) ?? null;
    if (session) used.add(session);

    let status: DayStatus;
    let late = 0, early = 0;
    if (!session) {
      if (leave) status = "on_leave";
      else if (now < new Date(shift.start_at.getTime() + rules.lateToleranceMin * 60000)) status = "scheduled";
      else if (now >= shift.end_at) status = "absent";
      else status = "missing";
    } else {
      if (session.in) {
        const lateMin = (session.in.occurred_at.getTime() - shift.start_at.getTime()) / 60000;
        if (lateMin > rules.lateToleranceMin) late = Math.round(lateMin);
      }
      if (session.out) {
        const earlyMin = (shift.end_at.getTime() - session.out.occurred_at.getTime()) / 60000;
        if (earlyMin > rules.earlyToleranceMin) early = Math.round(earlyMin);
      }
      if (session.orphanOut || session.abandoned) status = "incomplete";
      else if (session.open) status = now.getTime() > shift.end_at.getTime() + 4 * 3600000 ? "incomplete" : "present";
      else status = "finished";
    }
    const worked = session && !session.open ? session.minutes - (session.out ? shift.break_minutes : 0) : session?.minutes ?? 0;
    const extra = session && !session.open && session.out ? worked - scheduledMinutes : 0;
    result.push({
      shift, status, session,
      lateMinutes: late, earlyLeaveMinutes: early,
      workedMinutes: Math.max(0, Math.round(worked)),
      scheduledMinutes: Math.round(scheduledMinutes),
      extraMinutes: extra > rules.extraThresholdMin ? Math.round(extra) : 0,
      leaveType: leave?.type,
    });
  }

  // Sesiones que empiezan este día y no corresponden a ningún turno.
  for (const s of sessions) {
    if (used.has(s)) continue;
    const t = (s.in ?? s.out)!.occurred_at;
    if (t < args.dayStart || t >= args.dayEnd) continue;
    result.push({
      shift: null, session: s,
      status: s.orphanOut || s.abandoned ? "incomplete" : "unscheduled",
      lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: Math.round(s.minutes), scheduledMinutes: 0, extraMinutes: 0,
      leaveType: leave?.type,
    });
  }

  if (result.length === 0)
    result.push({ shift: null, session: null, status: leave ? "on_leave" : "not_scheduled", lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, scheduledMinutes: 0, extraMinutes: 0, leaveType: leave?.type });
  return result;
}
