import { describe, it, expect, beforeAll } from "vitest";
import { one, q } from "@/lib/db";
import { mobilePunch, kioskPunch } from "@/lib/punch";
import { issueQrToken } from "@/lib/qr";
import { resetDb } from "./setup";
import { makeCompany, makeBranch, makeTerminal, makeEmployee, qrFor, north, ctx, key, CENTER, shiftPunchesBack } from "./fixtures";

let company: any, branch: any, terminal: any, otherBranch: any, otherTerminal: any;

beforeAll(async () => {
  await resetDb();
  company = await makeCompany();
  branch = await makeBranch(company.id);
  terminal = await makeTerminal(branch.id);
  otherBranch = await makeBranch(company.id, { lat: -38.1, lng: -57.6 });
  otherTerminal = await makeTerminal(otherBranch.id);
});

const at = (m: number) => ({ latitude: north(m).lat, longitude: north(m).lng });

describe("fichaje móvil — bloqueo de fichadas remotas", () => {
  it("registra una entrada válida dentro del perímetro con QR vigente y hora del servidor", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    const before = Date.now();
    const r = await mobilePunch(user.id, { type: "in", ...at(20), accuracy: 15, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Math.abs(new Date(r.occurredAt).getTime() - before)).toBeLessThan(5000);
    const p = await one(`select * from punches where id = $1`, [r.punchId]);
    expect(p).toMatchObject({ source: "mobile", employee_id: employee.id, branch_id: branch.id });
    expect(p.distance_m).toBeGreaterThan(15);
  });

  it("rechaza estando fuera del perímetro con el mensaje exigido y deja registro + alerta", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    const r = await mobilePunch(user.id, { type: "in", ...at(500), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "outside_fence" });
    if (!r.ok) expect(r.message).toBe("Estás fuera del área autorizada. Para registrar tu asistencia debés encontrarte dentro de tu lugar de trabajo.");
    expect(await one(`select count(*)::int n from punches where employee_id = $1`, [employee.id])).toMatchObject({ n: 0 });
    expect(await one(`select reason from punch_attempts where employee_id = $1`, [employee.id])).toMatchObject({ reason: "outside_fence" });
    expect(await one(`select type from alerts where employee_id = $1`, [employee.id])).toMatchObject({ type: "geo_outside" });
  });

  it("rechaza ubicación imprecisa, distinguiéndola de estar afuera", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    const r = await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 400, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "low_accuracy" });
  });

  it("rechaza si no se envía ubicación (permiso denegado / sin GPS)", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    const r = await mobilePunch(user.id, { type: "in", latitude: undefined, longitude: undefined, accuracy: undefined, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "no_location" });
  });

  it("rechaza parámetros manipulados (strings en lugar de números)", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    const r = await mobilePunch(user.id, { type: "in", latitude: String(CENTER.lat), longitude: String(CENTER.lng), accuracy: "5", qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "no_location" });
    const bad = await mobilePunch(user.id, { type: "IN; drop table punches", ...at(0), accuracy: 5, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(bad).toMatchObject({ ok: false, code: "bad_request" });
  });

  it("rechaza sin QR, con QR vencido o con QR falsificado", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: "", idempotencyKey: key() }, ctx)).toMatchObject({ code: "qr_missing" });
    const expired = issueQrToken(branch.id, terminal.id, Date.now() - 10 * 60_000).token;
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: expired, idempotencyKey: key() }, ctx)).toMatchObject({ code: "qr_expired" });
    const forged = qrFor(branch.id, terminal.id).replace(/\.[^.]+$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: forged, idempotencyKey: key() }, ctx)).toMatchObject({ code: "qr_bad_signature" });
  });

  it("no permite reutilizar el mismo QR", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    const qr = qrFor(branch.id, terminal.id);
    expect((await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr, idempotencyKey: key() }, ctx)).ok).toBe(true);
    await shiftPunchesBack((await one(`select id from employees where user_id = $1`, [user.id])).id, 120);
    expect(await mobilePunch(user.id, { type: "out", ...at(0), accuracy: 10, qr, idempotencyKey: key() }, ctx)).toMatchObject({ code: "qr_reused" });
  });

  it("no permite usar el QR de una sucursal estando físicamente en otra", async () => {
    const { user } = await makeEmployee(company.id, branch.id, [otherBranch.id]);
    // GPS en la sucursal 1, QR de la sucursal 2 (p. ej. foto enviada por un compañero)
    const r = await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(otherBranch.id, otherTerminal.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "outside_fence" });
  });

  it("no permite fichar en una sucursal no autorizada", async () => {
    const { user } = await makeEmployee(company.id, otherBranch.id);
    const r = await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "branch_not_authorized" });
  });

  it("no permite usar un QR de otra empresa", async () => {
    const other = await makeCompany();
    const ob = await makeBranch(other.id);
    const ot = await makeTerminal(ob.id);
    const { user } = await makeEmployee(company.id, branch.id);
    const r = await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(ob.id, ot.id), idempotencyKey: key() }, ctx);
    expect(r).toMatchObject({ ok: false, code: "branch_not_authorized" });
  });

  it("rechaza QR emitido por una terminal desactivada", async () => {
    const t = await makeTerminal(branch.id);
    await q(`update terminals set active = false where id = $1`, [t.id]);
    const { user } = await makeEmployee(company.id, branch.id);
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, t.id), idempotencyKey: key() }, ctx)).toMatchObject({ code: "qr_terminal_inactive" });
  });

  it("rechaza en sucursal sin coordenadas configuradas", async () => {
    const b = await makeBranch(company.id, { lat: null, lng: null });
    const t = await makeTerminal(b.id);
    const { user } = await makeEmployee(company.id, b.id);
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(b.id, t.id), idempotencyKey: key() }, ctx)).toMatchObject({ code: "branch_not_configured" });
  });

  it("rechaza empleados desactivados", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    await q(`update employees set active = false where id = $1`, [employee.id]);
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx)).toMatchObject({ code: "employee_inactive" });
  });
});

describe("duplicados, secuencia y concurrencia", () => {
  it("una solicitud repetida con la misma clave no duplica la fichada", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    const k = key();
    const qr = qrFor(branch.id, terminal.id);
    const a = await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr, idempotencyKey: k }, ctx);
    const b = await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr, idempotencyKey: k }, ctx);
    expect(a.ok && b.ok && a.punchId === b.punchId && b.replay).toBe(true);
    expect(await one(`select count(*)::int n from punches where employee_id = $1`, [employee.id])).toMatchObject({ n: 1 });
  });

  it("solicitudes simultáneas (doble toque) generan una sola fichada", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await one(`select count(*)::int n from punches where employee_id = $1`, [employee.id])).toMatchObject({ n: 1 });
  });

  it("exige secuencia entrada → salida", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    expect(await mobilePunch(user.id, { type: "out", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx)).toMatchObject({ code: "not_in" });
    expect((await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx)).ok).toBe(true);
    await shiftPunchesBack(employee.id, 30);
    expect(await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx)).toMatchObject({ code: "already_in" });
    expect((await mobilePunch(user.id, { type: "out", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx)).ok).toBe(true);
  });

  it("un rechazo por secuencia no consume el QR", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    const qr = qrFor(branch.id, terminal.id);
    expect(await mobilePunch(user.id, { type: "out", ...at(0), accuracy: 10, qr, idempotencyKey: key() }, ctx)).toMatchObject({ code: "not_in" });
    expect((await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr, idempotencyKey: key() }, ctx)).ok).toBe(true);
  });

  it("limita intentos abusivos", async () => {
    const { user } = await makeEmployee(company.id, branch.id);
    let last: any;
    for (let i = 0; i < 14; i++) last = await mobilePunch(user.id, { type: "in", ...at(900), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    expect(last).toMatchObject({ code: "rate_limited" });
    expect(await one(`select severity from alerts where employee_id = (select id from employees where user_id = $1) and type = 'geo_outside'`, [user.id])).toMatchObject({ severity: "critical" });
  });
});

describe("registros inmutables", () => {
  it("la base de datos impide modificar o borrar fichadas", async () => {
    const { user, employee } = await makeEmployee(company.id, branch.id);
    await mobilePunch(user.id, { type: "in", ...at(0), accuracy: 10, qr: qrFor(branch.id, terminal.id), idempotencyKey: key() }, ctx);
    await expect(q(`update punches set occurred_at = now() - interval '1 hour' where employee_id = $1`, [employee.id])).rejects.toThrow(/inmutable/);
    await expect(q(`delete from punches where employee_id = $1`, [employee.id])).rejects.toThrow(/inmutable/);
    await q(`insert into audit_log (action, entity) values ('test', 'test')`);
    await expect(q(`delete from audit_log`)).rejects.toThrow(/inmutable/);
    await expect(q(`update audit_log set action = 'x'`)).rejects.toThrow(/inmutable/);
  });
  it("la base rechaza una fichada móvil sin coordenadas o sin QR aunque se inserte directo", async () => {
    const { employee } = await makeEmployee(company.id, branch.id);
    await expect(q(`insert into punches (employee_id, company_id, branch_id, type, source, accuracy_m, distance_m, qr_jti) values ($1,$2,$3,'in','mobile',5,5,'x')`, [employee.id, company.id, branch.id])).rejects.toThrow(/coordenadas/);
    await expect(q(`insert into punches (employee_id, company_id, branch_id, type, source, latitude, longitude) values ($1,$2,$3,'in','mobile',1,1)`, [employee.id, company.id, branch.id])).rejects.toThrow(/check/);
  });
});

describe("terminal presencial", () => {
  it("permite fichar con legajo + PIN en una terminal de la sucursal", async () => {
    const { employee } = await makeEmployee(company.id, branch.id, [], "4321");
    const r = await kioskPunch(terminal.id, { fileNumber: employee.file_number, pin: "4321", type: "in", idempotencyKey: key() }, ctx);
    expect(r.ok).toBe(true);
    expect(await one(`select source, terminal_id, latitude from punches where employee_id = $1`, [employee.id])).toMatchObject({ source: "terminal", terminal_id: terminal.id, latitude: null });
  });
  it("rechaza PIN incorrecto y sucursal no autorizada", async () => {
    const { employee } = await makeEmployee(company.id, otherBranch.id, [], "1111");
    expect(await kioskPunch(otherTerminal.id, { fileNumber: employee.file_number, pin: "9999", type: "in", idempotencyKey: key() }, ctx)).toMatchObject({ code: "bad_pin" });
    expect(await kioskPunch(terminal.id, { fileNumber: employee.file_number, pin: "1111", type: "in", idempotencyKey: key() }, ctx)).toMatchObject({ code: "branch_not_authorized" });
  });
});
