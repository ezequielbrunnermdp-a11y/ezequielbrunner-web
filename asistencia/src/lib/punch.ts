import type { PoolClient } from "pg";
import { one, q, tx } from "./db";
import { validateGeo, suspiciousGeoFlags } from "./geo";
import { verifyQrToken } from "./qr";
import { checkSequence } from "./sequence";
import { hit } from "./rate-limit";
import { verifySecret } from "./password";
import { audit } from "./audit";
import { raiseAlert } from "./alerts";

export type PunchType = "in" | "out";

export interface PunchOk {
  ok: true;
  punchId: string;
  type: PunchType;
  occurredAt: string;
  branchName: string;
  timezone: string;
  replay: boolean;
}
export interface PunchFail {
  ok: false;
  code: string;
  message: string;
}
export type PunchResult = PunchOk | PunchFail;

export const MESSAGES: Record<string, string> = {
  outside_fence: "Estás fuera del área autorizada. Para registrar tu asistencia debés encontrarte dentro de tu lugar de trabajo.",
  low_accuracy:
    "No pudimos confirmar tu ubicación con suficiente precisión. Acercate a una ventana o salí a un lugar abierto dentro del establecimiento y volvé a intentar. Si el problema persiste, usá la terminal del local.",
  invalid_reading: "La ubicación recibida no es válida. Volvé a intentarlo.",
  no_location: "No se recibió tu ubicación. Para fichar desde el celular tenés que permitir el acceso a la ubicación.",
  branch_not_configured: "Esta sucursal todavía no tiene configurada su ubicación. Avisá a la administración.",
  qr_missing: "Escaneá el código QR vigente del establecimiento para continuar.",
  qr_malformed: "El código escaneado no es un QR de fichaje válido.",
  qr_bad_signature: "El código QR no es auténtico.",
  qr_expired: "El código QR venció. Escaneá el código que se muestra ahora en la pantalla del local.",
  qr_future: "El código QR no es válido todavía. Verificá la hora del dispositivo de la terminal.",
  qr_reused: "Ese código QR ya fue utilizado. Escaneá el código actual de la pantalla.",
  qr_terminal_inactive: "La terminal que muestra el QR no está habilitada.",
  branch_not_authorized: "No estás autorizado a fichar en esta sucursal.",
  branch_inactive: "La sucursal no está habilitada para fichar.",
  employee_inactive: "Tu legajo no está habilitado para fichar. Consultá con la administración.",
  rate_limited: "Demasiados intentos en poco tiempo. Esperá unos minutos antes de volver a intentar.",
  bad_pin: "Legajo o PIN incorrectos.",
  idempotency_conflict: "Solicitud duplicada con datos distintos.",
};

interface Ctx { ip: string | null; userAgent: string | null }

interface EmployeeRow {
  id: string; company_id: string; active: boolean; company_active: boolean; max_shift_hours: number; full_name: string; user_id: string | null;
}

async function loadEmployee(where: string, params: unknown[]): Promise<EmployeeRow | null> {
  return one<EmployeeRow>(
    `select e.id, e.company_id, e.active, c.active as company_active, c.max_shift_hours, e.user_id,
            e.first_name || ' ' || e.last_name as full_name
     from employees e join companies c on c.id = e.company_id where ${where}`,
    params,
  );
}

async function logAttempt(a: {
  employeeId: string | null; companyId: string | null; branchId: string | null; type: PunchType | null; reason: string;
  lat?: number | null; lng?: number | null; accuracy?: number | null; distance?: number | null; ctx: Ctx;
}) {
  await q(
    `insert into punch_attempts (employee_id, company_id, branch_id, type, reason, latitude, longitude, accuracy_m, distance_m, ip, user_agent)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [a.employeeId, a.companyId, a.branchId, a.type, a.reason, a.lat ?? null, a.lng ?? null, a.accuracy ?? null, a.distance ?? null, a.ctx.ip, a.ctx.userAgent?.slice(0, 300) ?? null],
  );
  // Alertas por intentos fuera del perímetro o reiterados.
  if (a.employeeId && ["outside_fence", "qr_bad_signature", "qr_reused", "branch_not_authorized"].includes(a.reason)) {
    const recent = await one<{ n: number }>(
      `select count(*)::int as n from punch_attempts where employee_id = $1 and created_at > now() - interval '30 minutes'`,
      [a.employeeId],
    );
    const n = recent?.n ?? 1;
    const severity = a.reason === "qr_bad_signature" || n >= 3 ? "critical" : "warning";
    await raiseAlert({
      companyId: a.companyId, branchId: a.branchId, employeeId: a.employeeId,
      type: a.reason === "outside_fence" ? "geo_outside" : "punch_suspicious",
      severity,
      message: a.reason === "outside_fence"
        ? `Intento de fichaje fuera del perímetro${a.distance ? ` (a ${Math.round(a.distance)} m)` : ""}${n > 1 ? ` — ${n} intentos en 30 min` : ""}`
        : `Intento de fichaje rechazado: ${a.reason}${n > 1 ? ` — ${n} intentos en 30 min` : ""}`,
      data: { reason: a.reason, distance: a.distance, accuracy: a.accuracy, attempts30m: n },
      // Una alerta por empleado/motivo por hora, se actualiza la severidad si escala.
      dedupeKey: `attempt:${a.employeeId}:${a.reason}:${new Date().toISOString().slice(0, 13)}`,
    });
  }
}

/** Inserción común: lock por empleado, idempotencia, secuencia y registro con hora del servidor. */
async function insertPunchTx(
  c: PoolClient,
  p: {
    employeeId: string; companyId: string; branchId: string; type: PunchType; source: "mobile" | "terminal"; maxShiftHours: number;
    lat?: number; lng?: number; accuracy?: number; distance?: number; qrJti?: string; terminalId?: string | null;
    idempotencyKey: string | null; userId: string | null; ctx: Ctx; flags: string[];
  },
): Promise<{ id: string; occurred_at: Date; replay: boolean; flags: string[] } | PunchFail> {
  // Serializa las fichadas de un mismo empleado: evita duplicados por doble toque o reintentos simultáneos.
  await c.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [p.employeeId]);

  if (p.idempotencyKey) {
    const prev = await one(`select id, occurred_at, type, employee_id, flags from punches where idempotency_key = $1`, [p.idempotencyKey], c);
    if (prev) {
      if (prev.employee_id !== p.employeeId || prev.type !== p.type) return { ok: false, code: "idempotency_conflict", message: MESSAGES.idempotency_conflict };
      return { id: prev.id, occurred_at: prev.occurred_at, replay: true, flags: prev.flags };
    }
  }

  if (p.qrJti) {
    const used = await one(
      `insert into qr_uses (jti, employee_id, branch_id) values ($1,$2,$3) on conflict do nothing returning jti`,
      [p.qrJti, p.employeeId, p.branchId],
      c,
    );
    if (!used) return { ok: false, code: "qr_reused", message: MESSAGES.qr_reused };
  }

  const nowRow = await one<{ now: Date }>(`select now() as now`, [], c);
  const now = nowRow!.now;
  const last = await one<{ type: PunchType; occurred_at: Date }>(
    `select type, occurred_at from effective_punches where employee_id = $1 order by occurred_at desc limit 1`,
    [p.employeeId],
    c,
  );
  const seq = checkSequence(p.type, last, now, p.maxShiftHours);
  if (!seq.ok) return { ok: false, code: seq.code, message: seq.message };

  const flags = [...p.flags, ...seq.flags];
  const row = await one<{ id: string; occurred_at: Date }>(
    `insert into punches (employee_id, company_id, branch_id, type, source, latitude, longitude, accuracy_m, distance_m, qr_jti, terminal_id,
                          idempotency_key, user_id, ip, user_agent, flags)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning id, occurred_at`,
    [p.employeeId, p.companyId, p.branchId, p.type, p.source, p.lat ?? null, p.lng ?? null, p.accuracy ?? null, p.distance ?? null,
     p.qrJti ?? null, p.terminalId ?? null, p.idempotencyKey, p.userId, p.ctx.ip, p.ctx.userAgent?.slice(0, 300) ?? null, flags],
    c,
  );
  return { id: row!.id, occurred_at: row!.occurred_at, replay: false, flags };
}

class Rollback extends Error {
  constructor(public result: PunchFail) { super(result.code); }
}

/** Ejecuta la inserción; si las reglas la rechazan, revierte toda la transacción (incluido el uso del QR). */
async function runInsert(p: Parameters<typeof insertPunchTx>[1]) {
  try {
    return await tx(async (c) => {
      const r = await insertPunchTx(c, p);
      if ("ok" in r) throw new Rollback(r);
      return r;
    });
  } catch (e) {
    if (e instanceof Rollback) return e.result;
    throw e;
  }
}

function cleanKey(k: unknown): string | null {
  return typeof k === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(k) ? k : null;
}

/**
 * Fichada desde el celular del empleado. Requiere sesión, QR vigente de la sucursal y GPS dentro del perímetro.
 * Todo se valida aquí, en el servidor. La hora la pone la base de datos.
 */
export async function mobilePunch(
  userId: string,
  input: { type: unknown; latitude: unknown; longitude: unknown; accuracy: unknown; qr: unknown; idempotencyKey: unknown },
  ctx: Ctx,
): Promise<PunchResult> {
  const type = input.type === "in" || input.type === "out" ? input.type : null;
  if (!type) return { ok: false, code: "bad_request", message: "Tipo de fichada inválido." };

  const emp = await loadEmployee(`e.user_id = $1`, [userId]);
  if (!emp) return { ok: false, code: "no_employee", message: "Tu usuario no está vinculado a un legajo de empleado." };
  if (!emp.active || !emp.company_active) return { ok: false, code: "employee_inactive", message: MESSAGES.employee_inactive };

  const rl = await hit(`punch:${emp.id}`, 12, 10 * 60);
  if (!rl.allowed) {
    await logAttempt({ employeeId: emp.id, companyId: emp.company_id, branchId: null, type, reason: "rate_limited", ctx });
    return { ok: false, code: "rate_limited", message: MESSAGES.rate_limited };
  }

  const fail = async (code: string, extra: { branchId?: string | null; distance?: number | null } = {}) => {
    await logAttempt({
      employeeId: emp.id, companyId: emp.company_id, branchId: extra.branchId ?? null, type, reason: code,
      lat: typeof input.latitude === "number" ? input.latitude : null,
      lng: typeof input.longitude === "number" ? input.longitude : null,
      accuracy: typeof input.accuracy === "number" ? input.accuracy : null,
      distance: extra.distance ?? null, ctx,
    });
    return { ok: false as const, code, message: MESSAGES[code] ?? "No se pudo registrar la fichada." };
  };

  // 1) QR firmado y vigente → identifica la sucursal.
  if (typeof input.qr !== "string" || !input.qr) return fail("qr_missing");
  const qr = verifyQrToken(input.qr);
  if (!qr.ok) return fail(qr.reason);

  const branch = await one(
    `select b.id, b.name, b.company_id, b.active, b.latitude, b.longitude, b.radius_m, b.max_accuracy_m, b.timezone,
            t.active as terminal_active, t.branch_id as terminal_branch,
            exists(select 1 from employee_branches eb where eb.employee_id = $3 and eb.branch_id = b.id) as authorized
     from branches b left join terminals t on t.id::text = $2
     where b.id::text = $1`,
    [qr.branchId, qr.terminalId, emp.id],
  );
  if (!branch) return fail("qr_malformed");
  if (!branch.terminal_active || branch.terminal_branch !== branch.id) return fail("qr_terminal_inactive", { branchId: branch.id });
  if (!branch.active) return fail("branch_inactive", { branchId: branch.id });
  if (branch.company_id !== emp.company_id || !branch.authorized) return fail("branch_not_authorized", { branchId: branch.id });

  // 2) Ubicación GPS validada contra el perímetro.
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number" || typeof input.accuracy !== "number")
    return fail("no_location", { branchId: branch.id });
  const reading = { latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy };
  const geo = validateGeo(branch, reading);
  if (!geo.ok) return fail(geo.reason, { branchId: branch.id, distance: geo.distance ?? null });

  const prevReading = await one(
    `select latitude, longitude, accuracy_m as accuracy, occurred_at as at from punches
     where employee_id = $1 and source = 'mobile' and latitude is not null order by occurred_at desc limit 1`,
    [emp.id],
  );
  const flags = suspiciousGeoFlags(reading, prevReading);

  // 3) Registro transaccional.
  let res;
  try {
    res = await runInsert({
      employeeId: emp.id, companyId: emp.company_id, branchId: branch.id, type, source: "mobile", maxShiftHours: emp.max_shift_hours,
      lat: reading.latitude, lng: reading.longitude, accuracy: reading.accuracy, distance: geo.distance,
      qrJti: qr.jti, terminalId: qr.terminalId, idempotencyKey: cleanKey(input.idempotencyKey), userId, ctx, flags,
    });
  } catch (e: any) {
    if (e?.code === "23505") return fail("duplicate", { branchId: branch.id }); // carrera con la misma clave
    throw e;
  }
  if ("ok" in res) return fail(res.code, { branchId: branch.id });

  if (res.flags.length && !res.replay) {
    await raiseAlert({
      companyId: emp.company_id, branchId: branch.id, employeeId: emp.id, type: "punch_flags", severity: "warning",
      message: `Fichada registrada con señales a revisar: ${res.flags.join(", ")}`, data: { punchId: res.id, flags: res.flags },
      dedupeKey: `flags:${res.id}`,
    });
  }
  return { ok: true, punchId: res.id, type, occurredAt: new Date(res.occurred_at).toISOString(), branchName: branch.name, timezone: branch.timezone, replay: res.replay };
}

/**
 * Fichada en terminal física (empleados sin celular o con problemas de señal).
 * La presencia se acredita por estar frente al dispositivo registrado en la sucursal; la identidad, con legajo + PIN.
 */
export async function kioskPunch(
  terminalId: string,
  input: { fileNumber: unknown; pin: unknown; type: unknown; idempotencyKey: unknown },
  ctx: Ctx,
): Promise<PunchResult> {
  const type = input.type === "in" || input.type === "out" ? input.type : null;
  if (!type || typeof input.fileNumber !== "string" || typeof input.pin !== "string")
    return { ok: false, code: "bad_request", message: "Datos incompletos." };

  const term = await one(
    `select t.id, t.branch_id, t.allow_kiosk_punch, t.active, b.company_id, b.name as branch_name, b.timezone, b.active as branch_active
     from terminals t join branches b on b.id = t.branch_id where t.id = $1`,
    [terminalId],
  );
  if (!term || !term.active || !term.allow_kiosk_punch || !term.branch_active)
    return { ok: false, code: "terminal_disabled", message: "Esta terminal no está habilitada para fichar." };

  const rlTerm = await hit(`kiosk:${terminalId}`, 60, 10 * 60);
  const rlEmp = await hit(`kiosk:${terminalId}:${input.fileNumber.trim()}`, 5, 10 * 60);
  if (!rlTerm.allowed || !rlEmp.allowed) return { ok: false, code: "rate_limited", message: MESSAGES.rate_limited };

  const emp = await one(
    `select e.id, e.company_id, e.active, e.pin_hash, c.active as company_active, c.max_shift_hours, e.user_id,
            exists(select 1 from employee_branches eb where eb.employee_id = e.id and eb.branch_id = $3) as authorized
     from employees e join companies c on c.id = e.company_id where e.company_id = $1 and e.file_number = $2`,
    [term.company_id, input.fileNumber.trim(), term.branch_id],
  );
  const pinOk = await verifySecret(input.pin, emp?.pin_hash);
  if (!emp || !pinOk) {
    await logAttempt({ employeeId: emp?.id ?? null, companyId: term.company_id, branchId: term.branch_id, type, reason: "bad_pin", ctx });
    if (emp && rlEmp.count >= 3)
      await raiseAlert({
        companyId: term.company_id, branchId: term.branch_id, employeeId: emp.id, type: "kiosk_bad_pin", severity: "warning",
        message: `Intentos repetidos de PIN incorrecto en terminal`, dedupeKey: `kioskpin:${emp.id}:${new Date().toISOString().slice(0, 13)}`,
      });
    return { ok: false, code: "bad_pin", message: MESSAGES.bad_pin };
  }
  if (!emp.active || !emp.company_active) return { ok: false, code: "employee_inactive", message: MESSAGES.employee_inactive };
  if (!emp.authorized) {
    await logAttempt({ employeeId: emp.id, companyId: term.company_id, branchId: term.branch_id, type, reason: "branch_not_authorized", ctx });
    return { ok: false, code: "branch_not_authorized", message: MESSAGES.branch_not_authorized };
  }

  const res = await runInsert({
    employeeId: emp.id, companyId: emp.company_id, branchId: term.branch_id, type, source: "terminal", maxShiftHours: emp.max_shift_hours,
    terminalId, idempotencyKey: cleanKey(input.idempotencyKey), userId: null, ctx, flags: [],
  });
  if ("ok" in res) {
    await logAttempt({ employeeId: emp.id, companyId: emp.company_id, branchId: term.branch_id, type, reason: res.code, ctx });
    return res;
  }
  return { ok: true, punchId: res.id, type, occurredAt: new Date(res.occurred_at).toISOString(), branchName: term.branch_name, timezone: term.timezone, replay: res.replay };
}

// ---------------------------------------------------------------------------
// Correcciones: nunca modifican la fichada original.
// ---------------------------------------------------------------------------
export async function applyApprovedCorrection(c: PoolClient, correctionId: string, reviewerId: string) {
  const cr = await one(`select * from correction_requests where id = $1 for update`, [correctionId], c);
  if (!cr || cr.status !== "pending") throw new Error("La solicitud ya fue resuelta.");
  let resultPunchId: string | null = null;
  if (cr.kind === "add_punch") {
    const r = await one(
      `insert into punches (employee_id, company_id, branch_id, type, source, occurred_at, correction_id, user_id, flags)
       values ($1,$2,$3,$4,'correction',$5,$6,$7,'{correccion_administrativa}') returning id`,
      [cr.employee_id, cr.company_id, cr.branch_id, cr.proposed_type, cr.proposed_time, cr.id, reviewerId],
      c,
    );
    resultPunchId = r!.id;
  } else {
    await q(`insert into punch_voids (punch_id, correction_id, voided_by) values ($1,$2,$3)`, [cr.punch_id, cr.id, reviewerId], c);
  }
  await q(
    `update correction_requests set status = 'approved', reviewed_by = $2, reviewed_at = now(), result_punch_id = $3 where id = $1`,
    [cr.id, reviewerId, resultPunchId],
    c,
  );
  await audit({ actorId: reviewerId, action: "correction.approved", entity: "correction_request", entityId: cr.id, before: cr, after: { resultPunchId } }, c);
  return resultPunchId;
}

