import { describe, it, expect, beforeAll } from "vitest";
import { one, q, tx } from "@/lib/db";
import { actorFromUserId, login } from "@/lib/auth";
import { requestCorrection, reviewCorrection } from "@/lib/corrections";
import { evaluateRange } from "@/lib/board";
import { materializeShifts } from "@/lib/schedules";
import { detectShiftAlerts, retention, buildDailyReport } from "@/lib/jobs";
import { mobilePunch } from "@/lib/punch";
import { canAccessBranch, scopeSql } from "@/lib/permissions";
import { localDate, addDays } from "@/lib/time";
import { resetDb } from "./setup";
import { makeCompany, makeBranch, makeTerminal, makeEmployee, makeUser, qrFor, north, ctx, key, shiftPunchesBack } from "./fixtures";

let A: any, B: any, a1: any, a2: any, b1: any;

beforeAll(async () => {
  await resetDb();
  A = await makeCompany("Alfa");
  B = await makeCompany("Beta");
  a1 = await makeBranch(A.id);
  a2 = await makeBranch(A.id, { lat: -38.05, lng: -57.6 });
  b1 = await makeBranch(B.id);
});

describe("aislamiento entre empresas y alcance de encargados", () => {
  it("un administrador de una empresa no ve empleados de otra", async () => {
    await makeEmployee(A.id, a1.id);
    await makeEmployee(B.id, b1.id);
    const admA = await actorFromUserId((await makeUser("company_admin", [{ company_id: A.id }])).id);
    const days = await evaluateRange(admA!, localDate(), localDate());
    expect(days.length).toBeGreaterThan(0);
    expect(days.every((d) => d.companyName === "Alfa")).toBe(true);
  });

  it("un encargado sólo ve su sucursal", async () => {
    await makeEmployee(A.id, a2.id);
    const sup = await actorFromUserId((await makeUser("supervisor", [{ company_id: A.id, branch_id: a1.id }])).id);
    expect(canAccessBranch(sup!, A.id, a1.id)).toBe(true);
    expect(canAccessBranch(sup!, A.id, a2.id)).toBe(false);
    expect(canAccessBranch(sup!, B.id, b1.id)).toBe(false);
    const days = await evaluateRange(sup!, localDate(), localDate());
    const ids = days.map((d) => d.employeeId);
    const inA2 = await q(`select employee_id from employee_branches where branch_id = $1`, [a2.id]);
    expect(inA2.some((r) => ids.includes(r.employee_id))).toBe(false);
  });

  it("un usuario sin alcance no ve nada", async () => {
    const nobody = await actorFromUserId((await makeUser("manager")).id);
    const params: unknown[] = [];
    expect(scopeSql(nobody!, "c", "b", params)).toBe("false");
    expect(await evaluateRange(nobody!, localDate(), localDate())).toHaveLength(0);
  });

  it("un encargado no puede pedir correcciones fuera de su alcance ni aprobarlas", async () => {
    const { employee } = await makeEmployee(A.id, a2.id);
    const sup = await actorFromUserId((await makeUser("supervisor", [{ company_id: A.id, branch_id: a1.id }])).id);
    await expect(requestCorrection(sup!, { employeeId: employee.id, kind: "add_punch", type: "in", time: new Date(Date.now() - 3600e3), reason: "Se olvidó de fichar al ingresar" })).rejects.toThrow(/acceso/);
    const { employee: e1 } = await makeEmployee(A.id, a1.id);
    const cr = await requestCorrection(sup!, { employeeId: e1.id, kind: "add_punch", type: "in", time: new Date(Date.now() - 3600e3), reason: "Se olvidó de fichar al ingresar" });
    await expect(reviewCorrection(sup!, cr.id, "approve", "")).rejects.toThrow(/permiso/);
  });

  it("un gerente de otra empresa no puede aprobar", async () => {
    const { employee } = await makeEmployee(A.id, a1.id);
    const supA = await actorFromUserId((await makeUser("supervisor", [{ company_id: A.id, branch_id: a1.id }])).id);
    const mgrB = await actorFromUserId((await makeUser("manager", [{ company_id: B.id }])).id);
    const cr = await requestCorrection(supA!, { employeeId: employee.id, kind: "add_punch", type: "in", time: new Date(Date.now() - 3600e3), reason: "Corte de luz en el local" });
    await expect(reviewCorrection(mgrB!, cr.id, "approve", "")).rejects.toThrow(/acceso/);
  });
});

describe("correcciones auditables", () => {
  it("aprobar agrega una fichada de origen 'corrección' sin coordenadas y conserva el original", async () => {
    const t = await makeTerminal(a1.id);
    const { user, employee } = await makeEmployee(A.id, a1.id);
    const r = await mobilePunch(user.id, { type: "in", latitude: north(5).lat, longitude: north(5).lng, accuracy: 10, qr: qrFor(a1.id, t.id), idempotencyKey: key() }, ctx);
    expect(r.ok).toBe(true);
    const supA = await actorFromUserId((await makeUser("supervisor", [{ company_id: A.id, branch_id: a1.id }])).id);
    const mgr = await actorFromUserId((await makeUser("manager", [{ company_id: A.id }])).id);

    const add = await requestCorrection(supA!, { employeeId: employee.id, kind: "add_punch", type: "out", time: new Date(Date.now() + 1000 - 1000), reason: "Se quedó sin batería al salir" });
    const newId = await reviewCorrection(mgr!, add.id, "approve", "Verificado con cámaras");
    const p = await one(`select * from punches where id = $1`, [newId]);
    expect(p).toMatchObject({ source: "correction", latitude: null, qr_jti: null, correction_id: add.id });

    const voidReq = await requestCorrection(supA!, { employeeId: employee.id, kind: "void_punch", punchId: newId!, reason: "Carga duplicada por error" });
    await reviewCorrection(mgr!, voidReq.id, "approve", "");
    expect(await one(`select count(*)::int n from punches where employee_id = $1`, [employee.id])).toMatchObject({ n: 2 }); // ambas siguen existiendo
    expect(await one(`select count(*)::int n from effective_punches where employee_id = $1`, [employee.id])).toMatchObject({ n: 1 });
    expect(await one(`select count(*)::int n from audit_log where entity_id in ($1,$2)`, [add.id, voidReq.id])).toMatchObject({ n: 4 });
    await expect(reviewCorrection(mgr!, add.id, "approve", "")).rejects.toThrow(/resuelta/);
  });

  it("un empleado-encargado no puede aprobar sus propias correcciones", async () => {
    const { user, employee } = await makeEmployee(A.id, a1.id);
    await q(`update users set role = 'manager' where id = $1`, [user.id]);
    await q(`insert into user_scopes (user_id, company_id) values ($1,$2)`, [user.id, A.id]);
    const self = await actorFromUserId(user.id);
    const cr = await requestCorrection(self!, { employeeId: employee.id, kind: "add_punch", type: "in", time: new Date(Date.now() - 600e3), reason: "Me olvidé de fichar la entrada" });
    await expect(reviewCorrection(self!, cr.id, "approve", "")).rejects.toThrow(/propias/);
  });
});

describe("turnos y alertas", () => {
  it("materializa turnos nocturnos que terminan al día siguiente (UTC correcto)", async () => {
    const { employee } = await makeEmployee(A.id, a1.id);
    const today = localDate();
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    await q(`insert into schedule_templates (employee_id, branch_id, weekday, start_time, end_time, valid_from) values ($1,$2,$3,'22:00','06:00',$4)`, [employee.id, a1.id, dow, addDays(today, -7)]);
    expect(await materializeShifts(today, today, { employeeId: employee.id })).toBe(1);
    expect(await materializeShifts(today, today, { employeeId: employee.id })).toBe(0); // idempotente
    const s = await one(`select start_at, end_at, to_char(work_date,'YYYY-MM-DD') d from shifts where employee_id = $1`, [employee.id]);
    expect(s.d).toBe(today);
    expect((s.end_at - s.start_at) / 3600e3).toBe(8);
    expect(new Date(s.start_at).toISOString().slice(11, 16)).toBe("01:00"); // 22:00 ART = 01:00 UTC
  });

  it("genera alerta de ausencia, pero no si el empleado está de franco", async () => {
    const { employee: e1 } = await makeEmployee(A.id, a1.id);
    const { employee: e2 } = await makeEmployee(A.id, a1.id);
    const today = localDate();
    for (const e of [e1, e2])
      await q(`insert into shifts (employee_id, branch_id, work_date, start_at, end_at) values ($1,$2,$3, now() - interval '1 hour', now() + interval '6 hours')`, [e.id, a1.id, today]);
    await q(`insert into leaves (employee_id, type, start_date, end_date) values ($1,'franco',$2,$2)`, [e2.id, today]);
    await detectShiftAlerts();
    expect(await one(`select count(*)::int n from alerts where employee_id = $1 and type = 'no_show'`, [e1.id])).toMatchObject({ n: 1 });
    expect(await one(`select count(*)::int n from alerts where employee_id = $1`, [e2.id])).toMatchObject({ n: 0 });
    await detectShiftAlerts();
    expect(await one(`select count(*)::int n from alerts where employee_id = $1 and type = 'no_show'`, [e1.id])).toMatchObject({ n: 1 }); // sin duplicar
  });

  it("detecta llegada tarde y jornada extensa", async () => {
    const t = await makeTerminal(a1.id);
    const { user, employee } = await makeEmployee(A.id, a1.id);
    await mobilePunch(user.id, { type: "in", latitude: north(1).lat, longitude: north(1).lng, accuracy: 10, qr: qrFor(a1.id, t.id), idempotencyKey: key() }, ctx);
    await shiftPunchesBack(employee.id, 13 * 60);
    await q(`insert into shifts (employee_id, branch_id, work_date, start_at, end_at) values ($1,$2,$3, now() - interval '13 hours 30 minutes', now() - interval '5 hours 30 minutes')`, [employee.id, a1.id, localDate()]);
    await detectShiftAlerts();
    const types = (await q(`select type from alerts where employee_id = $1`, [employee.id])).map((r) => r.type).sort();
    expect(types).toEqual(expect.arrayContaining(["late", "long_shift", "missing_out"]));
  });

  it("genera el reporte diario", async () => {
    const rep = await buildDailyReport(A.id, localDate());
    expect(rep.subject).toContain("Alfa");
    expect(rep.html).toContain("Reporte diario");
  });
});

describe("autenticación y retención", () => {
  it("bloquea la cuenta tras intentos fallidos", async () => {
    const u = await makeUser("manager", [{ company_id: A.id }]);
    for (let i = 0; i < 5; i++) expect((await login(u.email, "incorrecta", "10.0.0.9", null)).ok).toBe(false);
    const r = await login(u.email, "Clave12345", "10.0.0.9", null);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.message).toMatch(/bloqueada/);
  });
  it("login correcto crea sesión", async () => {
    const u = await makeUser("manager", [{ company_id: A.id }]);
    const r = await login(u.email.toUpperCase(), "Clave12345", "10.0.0.8", null);
    expect(r.ok).toBe(true);
  });
  it("la purga de retención borra coordenadas viejas sin tocar el resto de la fichada", async () => {
    const t = await makeTerminal(a1.id);
    const { user, employee } = await makeEmployee(A.id, a1.id);
    await mobilePunch(user.id, { type: "in", latitude: north(1).lat, longitude: north(1).lng, accuracy: 10, qr: qrFor(a1.id, t.id), idempotencyKey: key() }, ctx);
    await shiftPunchesBack(employee.id, 400 * 24 * 60);
    await retention();
    const p = await one(`select latitude, distance_m, accuracy_m, source from punches where employee_id = $1`, [employee.id]);
    expect(p).toMatchObject({ latitude: null, source: "mobile" });
    expect(p.distance_m).not.toBeNull();
    // Fuera de la purga, el trigger sigue bloqueando cambios
    await expect(tx(async (c) => { await c.query(`set local app.geo_purge = 'on'`); await c.query(`update punches set type = 'out' where employee_id = $1`, [employee.id]); })).rejects.toThrow(/inmutable/);
  });
});
