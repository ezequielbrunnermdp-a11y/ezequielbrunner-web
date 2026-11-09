/**
 * Tareas programadas del servidor. Se ejecutan desde el worker (`npm run worker`)
 * o desde /api/cron (protegido con CRON_SECRET). Todas son idempotentes.
 */
import { one, q } from "./db";
import { materializeShifts } from "./schedules";
import { processOutbox, enqueueEmail, esc } from "./email";
import { evaluateRange, computeKpis, countGeoIncidents } from "./board";
import { STATUS_LABEL } from "./attendance";
import type { Actor } from "./permissions";
import { addDays, localDate, fmtMinutes, fmtTime, zonedToUtc, DEFAULT_TZ } from "./time";

const LONG_SESSION_HOURS = 12;

async function onceKey(job: string, key: string): Promise<boolean> {
  const r = await one(`insert into job_runs (job, run_key) values ($1,$2) on conflict do nothing returning job`, [job, key]);
  return !!r;
}

/** Detecta incidencias de turnos y genera alertas (deduplicadas por turno). */
export async function detectShiftAlerts(): Promise<number> {
  const base = `
    from shifts s
    join employees e on e.id = s.employee_id and e.active
    join companies c on c.id = e.company_id and c.active
    where s.status = 'active'
      and not exists (select 1 from leaves l where l.employee_id = s.employee_id and s.work_date between l.start_date and l.end_date)`;
  const name = `e.first_name || ' ' || e.last_name`;
  const firstIn = `(select min(p.occurred_at) from effective_punches p where p.employee_id = s.employee_id and p.type = 'in'
                     and p.occurred_at >= s.start_at - interval '3 hours' and p.occurred_at < s.end_at)`;
  let n = 0;

  // No fichó al inicio del turno.
  n += (await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     select e.company_id, s.branch_id, e.id, 'no_show', 'warning',
            ${name} || ' no registró entrada (turno ' || to_char(s.start_at at time zone c.timezone, 'HH24:MI') || ')',
            jsonb_build_object('shiftId', s.id), 'noshow:' || s.id
     ${base}
       and now() > s.start_at + make_interval(mins => c.late_tolerance_min)
       and now() < s.end_at + interval '2 hours'
       and ${firstIn} is null
     on conflict (dedupe_key) do nothing returning id`,
  )).length;

  // Llegada tarde.
  n += (await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     select e.company_id, s.branch_id, e.id, 'late', 'info',
            ${name} || ' llegó ' || round(extract(epoch from (fi - s.start_at)) / 60) || ' min tarde',
            jsonb_build_object('shiftId', s.id, 'minutes', round(extract(epoch from (fi - s.start_at)) / 60)), 'late:' || s.id
     from (select s.*, ${firstIn} as fi from shifts s) s
     join employees e on e.id = s.employee_id and e.active
     join companies c on c.id = e.company_id and c.active
     where s.status = 'active' and s.fi is not null and s.fi > s.start_at + make_interval(mins => c.late_tolerance_min)
       and s.start_at > now() - interval '2 days'
     on conflict (dedupe_key) do nothing returning id`,
  )).length;

  // Salida anticipada: la última salida del turno ocurrió antes del fin (menos la tolerancia).
  n += (await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     select e.company_id, s.branch_id, e.id, 'early_leave', 'info',
            ${name} || ' se retiró ' || round(extract(epoch from (s.end_at - o.occurred_at)) / 60) || ' min antes del fin de turno',
            jsonb_build_object('shiftId', s.id), 'early:' || s.id
     from shifts s
     join employees e on e.id = s.employee_id and e.active
     join companies c on c.id = e.company_id and c.active
     cross join lateral (
       select p.occurred_at from effective_punches p
       where p.employee_id = s.employee_id and p.occurred_at >= s.start_at - interval '3 hours' and p.occurred_at < s.end_at + interval '6 hours'
       order by p.occurred_at desc limit 1) o
     where s.status = 'active' and s.end_at < now() and s.end_at > now() - interval '2 days'
       and exists (select 1 from effective_punches p where p.employee_id = s.employee_id and p.type = 'out'
                   and p.occurred_at = o.occurred_at)
       and o.occurred_at > s.start_at
       and o.occurred_at < s.end_at - make_interval(mins => c.early_leave_tolerance_min)
     on conflict (dedupe_key) do nothing returning id`,
  )).length;

  // Falta fichada de salida: pasaron 2 h del fin de turno y la entrada sigue abierta.
  n += (await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     select e.company_id, s.branch_id, e.id, 'missing_out', 'warning',
            ${name} || ' no registró la salida del turno del ' || to_char(s.work_date, 'DD/MM'),
            jsonb_build_object('shiftId', s.id), 'missingout:' || s.id
     ${base}
       and now() > s.end_at + interval '2 hours' and s.end_at > now() - interval '3 days'
       and ${firstIn} is not null
       and not exists (select 1 from effective_punches p where p.employee_id = s.employee_id and p.type = 'out'
                        and p.occurred_at > ${firstIn} and p.occurred_at < s.end_at + interval '8 hours')
     on conflict (dedupe_key) do nothing returning id`,
  )).length;

  // Jornada anormalmente extensa: entrada abierta hace más de 12 h.
  n += (await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     select p.company_id, p.branch_id, p.employee_id, 'long_shift', 'warning',
            e.first_name || ' ' || e.last_name || ' tiene una entrada abierta hace más de ${LONG_SESSION_HOURS} h',
            jsonb_build_object('punchId', p.id), 'long:' || p.id
     from effective_punches p join employees e on e.id = p.employee_id
     where p.type = 'in' and p.occurred_at < now() - interval '${LONG_SESSION_HOURS} hours' and p.occurred_at > now() - interval '3 days'
       and not exists (select 1 from effective_punches o where o.employee_id = p.employee_id and o.occurred_at > p.occurred_at)
     on conflict (dedupe_key) do nothing returning id`,
  )).length;

  // Registros duplicados (p. ej. corrección cargada sobre una fichada existente).
  n += (await q(
    `insert into alerts (company_id, branch_id, employee_id, type, severity, message, data, dedupe_key)
     select a.company_id, a.branch_id, a.employee_id, 'duplicate', 'warning',
            'Dos fichadas de ' || case a.type when 'in' then 'entrada' else 'salida' end || ' con menos de 10 min de diferencia',
            jsonb_build_object('punchIds', jsonb_build_array(a.id, b.id)), 'dup:' || least(a.id::text, b.id::text) || greatest(a.id::text, b.id::text)
     from effective_punches a join effective_punches b
       on b.employee_id = a.employee_id and b.type = a.type and b.id <> a.id
      and b.occurred_at between a.occurred_at and a.occurred_at + interval '10 minutes'
     where a.occurred_at > now() - interval '2 days'
     on conflict (dedupe_key) do nothing returning id`,
  )).length;

  return n;
}

const systemActor = (companyId: string): Actor => ({
  id: "00000000-0000-0000-0000-000000000000", role: "company_admin", full_name: "Sistema", email: "", must_change_password: false,
  employee_id: null, scopes: [{ company_id: companyId, branch_id: null }],
});

/** Construye el HTML del reporte diario de una empresa para una fecha local. */
export async function buildDailyReport(companyId: string, date: string): Promise<{ subject: string; html: string; companyName: string }> {
  const company = await one(`select name, timezone from companies where id = $1`, [companyId]);
  const actor = systemActor(companyId);
  const days = await evaluateRange(actor, date, date, { companyId });
  const geo = await countGeoIncidents(actor, zonedToUtc(date, "00:00", company.timezone), zonedToUtc(addDays(date, 1), "00:00", company.timezone), { companyId });
  const k = computeKpis(days, geo);
  const byBranch = new Map<string, typeof days>();
  for (const d of days) {
    const list = byBranch.get(d.branchName);
    if (list) list.push(d); else byBranch.set(d.branchName, [d]);
  }
  const rowsFor = (list: typeof days) =>
    list
      .flatMap((d) => d.evaluations.filter((e) => e.status !== "not_scheduled" && (e.status !== "finished" || e.lateMinutes || e.earlyLeaveMinutes || e.extraMinutes)).map((e) => ({ d, e })))
      .map(({ d, e }) => `<tr><td>${esc(d.name)}</td><td>${esc(STATUS_LABEL[e.status])}${e.leaveType ? ` (${esc(e.leaveType)})` : ""}</td>
        <td>${e.shift ? `${fmtTime(e.shift.start_at, d.tz)}–${fmtTime(e.shift.end_at, d.tz)}` : "—"}</td>
        <td>${e.lateMinutes ? `${e.lateMinutes} min` : ""}</td><td>${e.earlyLeaveMinutes ? `${e.earlyLeaveMinutes} min` : ""}</td>
        <td>${e.extraMinutes ? fmtMinutes(e.extraMinutes) : ""}</td></tr>`)
      .join("");
  const sections = [...byBranch.entries()].map(([b, list]) => {
    const kb = computeKpis(list, 0);
    const rows = rowsFor(list);
    return `<h3 style="margin:24px 0 8px">${esc(b)}</h3>
      <p style="margin:0 0 8px;color:#555">Programados ${kb.scheduled} · Ausentes ${kb.absent} · Tardanzas ${kb.late} · Salidas anticipadas ${kb.earlyLeave} · Incompletas ${kb.incomplete}</p>
      ${rows ? `<table cellpadding="6" style="border-collapse:collapse;font-size:13px;width:100%"><tr style="background:#f3f4f6;text-align:left"><th>Empleado</th><th>Estado</th><th>Turno</th><th>Tarde</th><th>Antes</th><th>Adicional*</th></tr>${rows}</table>` : `<p style="color:#16a34a">Sin novedades.</p>`}`;
  });
  const html = `<div style="font-family:system-ui,Segoe UI,Arial;max-width:760px;color:#111">
    <h2 style="margin:0">Reporte diario de asistencia — ${esc(company.name)}</h2>
    <p style="color:#555;margin:4px 0 16px">${date.split("-").reverse().join("/")}</p>
    <p>Programados: <b>${k.scheduled}</b> · Ausentes: <b>${k.absent}</b> · Llegadas tarde: <b>${k.late}</b> · Salidas anticipadas: <b>${k.earlyLeave}</b> ·
       Incompletas: <b>${k.incomplete}</b> · Horas registradas: <b>${fmtMinutes(k.workedMinutes)}</b> · Asistencia: <b>${k.attendancePct ?? "—"}%</b> ·
       Incidencias de ubicación: <b>${k.geoIncidents}</b></p>
    ${sections.join("")}
    <p style="color:#777;font-size:12px;margin-top:24px">* Horas adicionales a revisar: no constituyen horas extra liquidadas hasta su autorización.</p>
  </div>`;
  return { subject: `Asistencia ${company.name} — ${date.split("-").reverse().join("/")}`, html, companyName: company.name };
}

/** Envía el reporte del día anterior a la hora configurada por empresa (una vez por día). */
export async function dailyReports(now = new Date()): Promise<number> {
  const companies = await q(`select id, timezone, daily_report_hour, report_emails from companies where active`);
  let n = 0;
  for (const c of companies) {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: c.timezone, hour: "numeric", hourCycle: "h23" }).format(now));
    if (hour < c.daily_report_hour) continue;
    const date = addDays(localDate(now, c.timezone), -1);
    if (!(await onceKey("daily_report", `${c.id}:${date}`))) continue;
    const rep = await buildDailyReport(c.id, date);
    for (const to of c.report_emails as string[]) await enqueueEmail(to, rep.subject, rep.html, `daily:${c.id}:${date}:${to}`);
    await q(
      `insert into alerts (company_id, type, severity, message, dedupe_key) values ($1,'daily_report','info',$2,$3) on conflict do nothing`,
      [c.id, `Reporte diario del ${date.split("-").reverse().join("/")} generado${c.report_emails.length ? ` y enviado a ${c.report_emails.length} destinatario(s)` : ""}`, `dailyrep:${c.id}:${date}`],
    );
    n++;
  }
  return n;
}

/** Minimización de datos: purga coordenadas antiguas y datos técnicos vencidos. */
export async function retention(): Promise<void> {
  if (!(await onceKey("retention", localDate(new Date(), DEFAULT_TZ)))) return;
  const client = await (await import("./db")).pool().connect();
  try {
    await client.query("begin");
    await client.query(`set local app.geo_purge = 'on'`);
    await client.query(
      `update punches p set latitude = null, longitude = null from companies c
       where c.id = p.company_id and p.latitude is not null and p.occurred_at < now() - make_interval(days => c.geo_retention_days)`,
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  await q(`update punch_attempts a set latitude = null, longitude = null from companies c
           where c.id = a.company_id and a.latitude is not null and a.created_at < now() - make_interval(days => least(c.geo_retention_days, 90))`);
  await q(`delete from sessions where expires_at < now() - interval '30 days'`);
  await q(`delete from qr_uses where used_at < now() - interval '2 days'`);
  await q(`delete from rate_limits where window_start < now() - interval '1 day'`);
}

export async function runAllJobs() {
  const today = localDate(new Date(), DEFAULT_TZ);
  const hourKey = new Date().toISOString().slice(0, 13);
  const out: Record<string, unknown> = {};
  if (await onceKey("materialize", hourKey)) out.shifts = await materializeShifts(addDays(today, -1), addDays(today, 14));
  out.alerts = await detectShiftAlerts();
  out.reports = await dailyReports();
  out.emails = await processOutbox();
  await retention();
  return out;
}
