import { q, type Db, pool } from "./db";

export async function raiseAlert(
  a: {
    companyId: string | null; branchId?: string | null; employeeId?: string | null; type: string;
    severity?: "info" | "warning" | "critical"; message: string; data?: Record<string, unknown>; dedupeKey?: string;
  },
  db: Db = pool(),
) {
  // Con dedupe_key: no duplica, pero actualiza mensaje y escala severidad si corresponde.
  await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (dedupe_key) do update set
       message = excluded.message, data = excluded.data,
       severity = case when excluded.severity = 'critical' then 'critical' else alerts.severity end`,
    [a.companyId, a.branchId ?? null, a.employeeId ?? null, a.type, a.severity ?? "warning", a.message, JSON.stringify(a.data ?? {}), a.dedupeKey ?? null],
    db,
  );
}

export const ALERT_LABEL: Record<string, string> = {
  geo_outside: "Fuera del perímetro",
  punch_suspicious: "Intento sospechoso",
  punch_flags: "Señales a revisar",
  no_show: "No fichó al inicio",
  late: "Llegada tarde",
  early_leave: "Salida anticipada",
  missing_out: "Falta fichada de salida",
  long_shift: "Jornada extensa",
  login_lockout: "Bloqueo de cuenta",
  kiosk_bad_pin: "PIN incorrecto en terminal",
  duplicate: "Registro duplicado",
};
