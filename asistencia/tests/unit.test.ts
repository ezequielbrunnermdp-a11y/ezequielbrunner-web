import { describe, it, expect } from "vitest";
import { haversineMeters, validateGeo, suspiciousGeoFlags } from "@/lib/geo";
import { issueQrToken, verifyQrToken } from "@/lib/qr";
import { checkSequence } from "@/lib/sequence";
import { evaluateDay, pairPunches, type Shift, type Punch } from "@/lib/attendance";
import { zonedToUtc, localDate } from "@/lib/time";

const fence = { latitude: -38, longitude: -57.55, radius_m: 80, max_accuracy_m: 60 };

describe("geolocalización", () => {
  it("calcula distancias correctamente", () => {
    expect(haversineMeters(-38, -57.55, -38 + 100 / 111320, -57.55)).toBeCloseTo(100, 0);
  });
  it("acepta dentro del radio con buena precisión", () => {
    expect(validateGeo(fence, { latitude: -38.0003, longitude: -57.55, accuracy: 15 })).toMatchObject({ ok: true });
  });
  it("rechaza fuera del perímetro", () => {
    expect(validateGeo(fence, { latitude: -38.01, longitude: -57.55, accuracy: 10 })).toMatchObject({ ok: false, reason: "outside_fence" });
  });
  it("distingue precisión insuficiente de estar afuera", () => {
    expect(validateGeo(fence, { latitude: -38, longitude: -57.55, accuracy: 500 })).toMatchObject({ ok: false, reason: "low_accuracy" });
  });
  it("rechaza lecturas imposibles y sucursal sin configurar", () => {
    expect(validateGeo(fence, { latitude: 0, longitude: 0, accuracy: 5 })).toMatchObject({ reason: "invalid_reading" });
    expect(validateGeo(fence, { latitude: NaN, longitude: 1, accuracy: 5 })).toMatchObject({ reason: "invalid_reading" });
    expect(validateGeo(fence, { latitude: -38, longitude: -57.55, accuracy: 0 })).toMatchObject({ reason: "invalid_reading" });
    expect(validateGeo({ ...fence, latitude: null }, { latitude: -38, longitude: -57.55, accuracy: 5 })).toMatchObject({ reason: "branch_not_configured" });
  });
  it("marca lecturas sospechosas", () => {
    const r = { latitude: -38.000123, longitude: -57.550456, accuracy: 12 };
    expect(suspiciousGeoFlags(r, { ...r, at: new Date(Date.now() - 3600e3) })).toContain("lectura_identica_repetida");
    expect(suspiciousGeoFlags(r, { latitude: -34.6, longitude: -58.38, accuracy: 10, at: new Date(Date.now() - 60e3) })).toContain("desplazamiento_imposible");
    expect(suspiciousGeoFlags({ latitude: -38, longitude: -57.55, accuracy: 0.5 })).toEqual(expect.arrayContaining(["precision_irreal", "coordenadas_redondeadas"]));
  });
});

describe("QR firmado", () => {
  process.env.QR_SIGNING_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
  it("valida un token vigente y acepta la URL completa", () => {
    const { token } = issueQrToken("b1", "t1");
    expect(verifyQrToken(token)).toMatchObject({ ok: true, branchId: "b1", terminalId: "t1" });
    expect(verifyQrToken(`https://app/fichar?qr=${encodeURIComponent(token)}`)).toMatchObject({ ok: true });
  });
  it("rechaza tokens vencidos", () => {
    const { token } = issueQrToken("b1", "t1", Date.now() - 120_000);
    expect(verifyQrToken(token)).toMatchObject({ ok: false, reason: "qr_expired" });
  });
  it("rechaza tokens alterados (otra sucursal, otra expiración)", () => {
    const { token } = issueQrToken("b1", "t1");
    const p = token.split(".");
    expect(verifyQrToken([p[0], "b2", ...p.slice(2)].join("."))).toMatchObject({ reason: "qr_bad_signature" });
    expect(verifyQrToken([...p.slice(0, 4), String(Number(p[4]) + 99999), ...p.slice(5)].join("."))).toMatchObject({ reason: "qr_bad_signature" });
    expect(verifyQrToken("basura")).toMatchObject({ reason: "qr_malformed" });
  });
  it("rechaza firmas con otro secreto", () => {
    const { token } = issueQrToken("b1", "t1");
    process.env.QR_SIGNING_SECRET = "otro-secreto-0123456789abcdef0123456789abcdef";
    expect(verifyQrToken(token)).toMatchObject({ reason: "qr_bad_signature" });
    process.env.QR_SIGNING_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
  });
});

describe("secuencia entrada/salida", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60000);
  it("exige entrada antes de salida", () => {
    expect(checkSequence("out", null, now, 16)).toMatchObject({ ok: false, code: "not_in" });
    expect(checkSequence("out", { type: "out", occurred_at: ago(60) }, now, 16)).toMatchObject({ ok: false, code: "not_in" });
  });
  it("impide doble entrada", () => {
    expect(checkSequence("in", { type: "in", occurred_at: ago(60) }, now, 16)).toMatchObject({ ok: false, code: "already_in" });
  });
  it("impide doble toque inmediato", () => {
    expect(checkSequence("out", { type: "in", occurred_at: ago(0.2) }, now, 16)).toMatchObject({ ok: false, code: "too_soon" });
  });
  it("entrada vieja sin salida: permite nueva entrada marcada; salida requiere corrección", () => {
    expect(checkSequence("in", { type: "in", occurred_at: ago(20 * 60) }, now, 16)).toMatchObject({ ok: true, flags: ["entrada_previa_sin_salida"] });
    expect(checkSequence("out", { type: "in", occurred_at: ago(20 * 60) }, now, 16)).toMatchObject({ ok: false, code: "open_in_expired" });
  });
  it("turno nocturno de 9 h es válido", () => {
    expect(checkSequence("out", { type: "in", occurred_at: ago(9 * 60) }, now, 16)).toMatchObject({ ok: true });
  });
});

describe("zonas horarias", () => {
  it("convierte hora local de Buenos Aires a UTC (UTC-3)", () => {
    expect(zonedToUtc("2026-03-10", "08:00", "America/Argentina/Buenos_Aires").toISOString()).toBe("2026-03-10T11:00:00.000Z");
    expect(localDate(new Date("2026-03-10T02:00:00Z"), "America/Argentina/Buenos_Aires")).toBe("2026-03-09");
  });
});

describe("evaluación de asistencia", () => {
  const rules = { lateToleranceMin: 10, earlyToleranceMin: 10, extraThresholdMin: 15, maxShiftHours: 16 };
  const tz = "America/Argentina/Buenos_Aires";
  const mk = (date: string, s: string, e: string, nextDay = false): Shift => ({
    id: "s1", employee_id: "e1", branch_id: "b1", work_date: date, break_minutes: 0,
    start_at: zonedToUtc(date, s, tz), end_at: zonedToUtc(nextDay ? "2026-03-11" : date, e, tz),
  });
  const p = (type: "in" | "out", d: string, t: string, id = Math.random().toString()): Punch => ({ id, employee_id: "e1", type, occurred_at: zonedToUtc(d, t, tz), source: "mobile" });
  const base = (date: string) => ({ employeeId: "e1", date, rules, leaves: [], dayStart: zonedToUtc(date, "00:00", tz), dayEnd: zonedToUtc("2026-03-11", "00:00", tz) });

  it("detecta llegada tarde y salida anticipada", () => {
    const [ev] = evaluateDay({ ...base("2026-03-10"), shifts: [mk("2026-03-10", "08:00", "16:00")], punches: [p("in", "2026-03-10", "08:25"), p("out", "2026-03-10", "15:30")], now: zonedToUtc("2026-03-10", "20:00", tz) });
    expect(ev.status).toBe("finished");
    expect(ev.lateMinutes).toBe(25);
    expect(ev.earlyLeaveMinutes).toBe(30);
  });
  it("respeta la tolerancia", () => {
    const [ev] = evaluateDay({ ...base("2026-03-10"), shifts: [mk("2026-03-10", "08:00", "16:00")], punches: [p("in", "2026-03-10", "08:09")], now: zonedToUtc("2026-03-10", "10:00", tz) });
    expect(ev.status).toBe("present");
    expect(ev.lateMinutes).toBe(0);
  });
  it("no marca ausente a quien tiene franco o licencia", () => {
    const [ev] = evaluateDay({ ...base("2026-03-10"), shifts: [mk("2026-03-10", "08:00", "16:00")], punches: [], now: zonedToUtc("2026-03-10", "20:00", tz),
      leaves: [{ employee_id: "e1", type: "vacaciones", start_date: "2026-03-09", end_date: "2026-03-15" }] });
    expect(ev.status).toBe("on_leave");
  });
  it("distingue no fichó (turno en curso) de ausente (turno terminado)", () => {
    const s = [mk("2026-03-10", "08:00", "16:00")];
    expect(evaluateDay({ ...base("2026-03-10"), shifts: s, punches: [], now: zonedToUtc("2026-03-10", "07:55", tz) })[0].status).toBe("scheduled");
    expect(evaluateDay({ ...base("2026-03-10"), shifts: s, punches: [], now: zonedToUtc("2026-03-10", "09:00", tz) })[0].status).toBe("missing");
    expect(evaluateDay({ ...base("2026-03-10"), shifts: s, punches: [], now: zonedToUtc("2026-03-10", "17:00", tz) })[0].status).toBe("absent");
  });
  it("turno nocturno que termina al día siguiente, con horas adicionales a revisar", () => {
    const [ev] = evaluateDay({ ...base("2026-03-10"), shifts: [mk("2026-03-10", "22:00", "06:00", true)],
      punches: [p("in", "2026-03-10", "21:55"), p("out", "2026-03-11", "07:00")], now: zonedToUtc("2026-03-11", "09:00", tz) });
    expect(ev.status).toBe("finished");
    expect(ev.workedMinutes).toBe(545);
    expect(ev.scheduledMinutes).toBe(480);
    expect(ev.extraMinutes).toBe(65);
  });
  it("salida sin entrada es fichada incompleta", () => {
    const r = evaluateDay({ ...base("2026-03-10"), shifts: [mk("2026-03-10", "08:00", "16:00")], punches: [p("out", "2026-03-10", "16:00")], now: zonedToUtc("2026-03-10", "18:00", tz) });
    expect(r[0].status).toBe("incomplete");
  });
  it("arma pares y detecta entradas abandonadas", () => {
    const s = pairPunches([p("in", "2026-03-10", "08:00"), p("in", "2026-03-10", "09:00"), p("out", "2026-03-10", "17:00")], zonedToUtc("2026-03-10", "18:00", tz), 16);
    expect(s.map((x) => x.abandoned)).toEqual([true, false]);
    expect(s[1].minutes).toBe(480);
  });
});
