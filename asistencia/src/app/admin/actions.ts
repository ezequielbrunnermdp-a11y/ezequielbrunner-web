"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { one, q, tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { requireActor, clientIp } from "@/lib/session";
import { assertBranch, assertCompany, hasCompanyWideScope, requireCap, type Actor, type Role } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { hashSecret } from "@/lib/password";
import { materializeShifts, dropFutureShiftsOfTemplate } from "@/lib/schedules";
import { requestCorrection, reviewCorrection } from "@/lib/corrections";
import { createPairingCode } from "@/lib/terminals";
import { localDate, addDays, zonedToUtc } from "@/lib/time";
import type { ActionState } from "@/components/action-form";

// ---------------------------------------------------------------- helpers
async function run(fn: (a: Actor, ip: string | null) => Promise<string | void>): Promise<ActionState> {
  try {
    const a = await requireActor();
    const msg = await fn(a, await clientIp());
    revalidatePath("/admin", "layout");
    return { ok: true, message: msg || "Cambios guardados." };
  } catch (e: any) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AppError) return { ok: false, message: e.message };
    if (e?.code === "23505") return { ok: false, message: "Ya existe un registro con esos datos (duplicado)." };
    if (e?.code === "23514") return { ok: false, message: "Algún valor está fuera del rango permitido." };
    console.error(e);
    return { ok: false, message: "Ocurrió un error inesperado. No se guardaron los cambios." };
  }
}
const str = (fd: FormData, k: string, max = 200) => {
  const v = String(fd.get(k) ?? "").trim();
  if (v.length > max) throw new AppError("too_long", `El campo ${k} es demasiado largo.`);
  return v;
};
const req = (fd: FormData, k: string, label: string, max = 200) => {
  const v = str(fd, k, max);
  if (!v) throw new AppError("required", `Completá: ${label}.`);
  return v;
};
const num = (fd: FormData, k: string, label: string, min: number, max: number, allowEmpty = false): number | null => {
  const raw = str(fd, k);
  if (!raw && allowEmpty) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new AppError("range", `${label}: debe estar entre ${min} y ${max}.`);
  return n;
};
const uuid = (fd: FormData, k: string, label = k) => {
  const v = str(fd, k);
  if (!/^[0-9a-f-]{36}$/i.test(v)) throw new AppError("bad_id", `Seleccioná ${label}.`);
  return v;
};
const uuids = (fd: FormData, k: string) => fd.getAll(k).map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
const time = (fd: FormData, k: string, label: string) => {
  const v = str(fd, k);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new AppError("time", `${label}: hora inválida.`);
  return v;
};
const date = (fd: FormData, k: string, label: string) => {
  const v = str(fd, k);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new AppError("date", `${label}: fecha inválida.`);
  return v;
};
function tempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz";
  const dig = "23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[randomInt(abc.length)];
  for (let i = 0; i < 4; i++) s += dig[randomInt(dig.length)];
  return s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8);
}
async function branchRow(id: string) {
  const b = await one(`select * from branches where id = $1`, [id]);
  if (!b) throw notFound("Sucursal inexistente.");
  return b;
}
async function employeeRow(a: Actor, id: string) {
  const e = await one(`select * from employees where id = $1`, [id]);
  if (!e) throw notFound("Empleado inexistente.");
  assertCompany(a, e.company_id);
  // Alcance por sucursal: debe tener acceso a alguna de sus sucursales autorizadas.
  if (!hasCompanyWideScope(a, e.company_id)) {
    const bs = await q(`select branch_id from employee_branches where employee_id = $1`, [id]);
    if (!bs.some((b) => a.scopes.some((s) => s.company_id === e.company_id && s.branch_id === b.branch_id))) throw forbidden();
  }
  return e;
}

// ---------------------------------------------------------------- empresas
export async function saveCompany(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "companies.manage");
    const id = str(fd, "id");
    const name = req(fd, "name", "Nombre", 120);
    const emails = str(fd, "report_emails", 1000).split(/[\s,;]+/).filter(Boolean).map((e) => e.toLowerCase());
    if (emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) throw new AppError("email", "Hay un correo de reporte inválido.");
    const vals = [
      name,
      num(fd, "late_tolerance_min", "Tolerancia de llegada", 0, 120),
      num(fd, "early_leave_tolerance_min", "Tolerancia de salida", 0, 120),
      num(fd, "extra_hours_threshold_min", "Umbral de horas adicionales", 0, 240),
      num(fd, "max_shift_hours", "Duración máxima de jornada", 4, 24),
      num(fd, "daily_report_hour", "Hora del reporte", 0, 23),
      emails,
      num(fd, "geo_retention_days", "Retención de ubicación", 30, 3650),
    ];
    if (id) {
      const before = await one(`select * from companies where id = $1`, [id]);
      const after = await one(
        `update companies set name=$2, late_tolerance_min=$3, early_leave_tolerance_min=$4, extra_hours_threshold_min=$5, max_shift_hours=$6,
           daily_report_hour=$7, report_emails=$8, geo_retention_days=$9, updated_at=now() where id=$1 returning *`, [id, ...vals]);
      await audit({ actorId: a.id, action: "company.updated", entity: "company", entityId: id, before, after, ip });
    } else {
      const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const after = await one(
        `insert into companies (slug, name, late_tolerance_min, early_leave_tolerance_min, extra_hours_threshold_min, max_shift_hours, daily_report_hour, report_emails, geo_retention_days)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [slug, ...vals]);
      await audit({ actorId: a.id, action: "company.created", entity: "company", entityId: after.id, after, ip });
    }
  });
}
export async function toggleCompany(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "companies.manage");
    const r = await one(`update companies set active = not active, updated_at = now() where id = $1 returning id, active`, [uuid(fd, "id")]);
    await audit({ actorId: a.id, action: r.active ? "company.activated" : "company.deactivated", entity: "company", entityId: r.id, ip });
    return r.active ? "Empresa activada." : "Empresa desactivada.";
  });
}

// ---------------------------------------------------------------- sucursales
export async function saveBranch(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "branches.manage");
    const id = str(fd, "id");
    const companyId = uuid(fd, "company_id", "la empresa");
    assertCompany(a, companyId);
    if (!hasCompanyWideScope(a, companyId)) throw forbidden();
    const lat = num(fd, "latitude", "Latitud", -90, 90, true);
    const lng = num(fd, "longitude", "Longitud", -180, 180, true);
    if ((lat == null) !== (lng == null)) throw new AppError("coords", "Completá latitud y longitud, o dejá ambas vacías.");
    const hours: Record<string, string> = {};
    for (let d = 0; d < 7; d++) { const v = str(fd, `hours_${d}`, 40); if (v) hours[d] = v; }
    const vals = [companyId, req(fd, "name", "Nombre", 120), str(fd, "address", 250) || null, lat, lng,
      num(fd, "radius_m", "Radio", 10, 2000), num(fd, "max_accuracy_m", "Precisión máxima", 5, 500), JSON.stringify(hours)];
    if (id) {
      const before = await branchRow(id);
      assertCompany(a, before.company_id);
      if (before.company_id !== companyId) throw new AppError("company", "No se puede mover una sucursal a otra empresa.");
      const after = await one(
        `update branches set company_id=$2, name=$3, address=$4, latitude=$5, longitude=$6, radius_m=$7, max_accuracy_m=$8, opening_hours=$9, updated_at=now()
         where id=$1 returning *`, [id, ...vals]);
      await audit({ actorId: a.id, action: "branch.updated", entity: "branch", entityId: id, before, after, ip });
    } else {
      const after = await one(
        `insert into branches (company_id, name, address, latitude, longitude, radius_m, max_accuracy_m, opening_hours) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, vals);
      await audit({ actorId: a.id, action: "branch.created", entity: "branch", entityId: after.id, after, ip });
    }
  });
}
export async function toggleBranch(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "branches.manage");
    const b = await branchRow(uuid(fd, "id"));
    assertBranch(a, b.company_id, b.id);
    const r = await one(`update branches set active = not active, updated_at = now() where id = $1 returning active`, [b.id]);
    await audit({ actorId: a.id, action: r.active ? "branch.activated" : "branch.deactivated", entity: "branch", entityId: b.id, ip });
    return r.active ? "Sucursal activada." : "Sucursal desactivada.";
  });
}

// ---------------------------------------------------------------- empleados
export async function saveEmployee(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "employees.manage");
    const id = str(fd, "id");
    const primary = uuid(fd, "primary_branch_id", "la sucursal principal");
    const pb = await branchRow(primary);
    assertBranch(a, pb.company_id, pb.id);
    const authorized = [...new Set([primary, ...uuids(fd, "branches")])];
    const bs = await q(`select id, company_id from branches where id = any($1)`, [authorized]);
    if (bs.length !== authorized.length || bs.some((b) => b.company_id !== pb.company_id)) throw new AppError("branches", "Las sucursales autorizadas deben ser de la misma empresa.");
    for (const b of bs) assertBranch(a, b.company_id, b.id);
    const supervisor = str(fd, "supervisor_user_id") || null;
    const pin = str(fd, "pin", 8);
    if (pin && !/^\d{4,8}$/.test(pin)) throw new AppError("pin", "El PIN debe tener entre 4 y 8 dígitos.");
    const email = str(fd, "email", 200).toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError("email", "Correo inválido.");
    const fields = [req(fd, "first_name", "Nombre", 80), req(fd, "last_name", "Apellido", 80), req(fd, "file_number", "Legajo", 20),
      str(fd, "document_number", 20) || null, str(fd, "sector", 60) || null, str(fd, "position", 60) || null, supervisor, primary];
    let msg = "Empleado guardado.";
    await tx(async (c) => {
      let empId = id;
      let before: any = null;
      if (id) {
        before = await employeeRow(a, id);
        if (before.company_id !== pb.company_id) throw new AppError("company", "No se puede cambiar la empresa de un legajo existente.");
        await q(`update employees set first_name=$2, last_name=$3, file_number=$4, document_number=$5, sector=$6, position=$7, supervisor_user_id=$8, primary_branch_id=$9, updated_at=now() where id=$1`, [id, ...fields], c);
        await q(`delete from employee_branches where employee_id = $1`, [id], c);
      } else {
        empId = (await one(`insert into employees (company_id, first_name, last_name, file_number, document_number, sector, position, supervisor_user_id, primary_branch_id)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [pb.company_id, ...fields], c)).id;
      }
      for (const b of authorized) await q(`insert into employee_branches values ($1,$2)`, [empId, b], c);
      if (pin) await q(`update employees set pin_hash = $2 where id = $1`, [empId, await hashSecret(pin)], c);
      const cur = await one(`select user_id from employees where id = $1`, [empId], c);
      if (email && !cur.user_id) {
        const pw = tempPassword();
        const u = await one(`insert into users (email, password_hash, role, full_name, must_change_password) values ($1,$2,'employee',$3,true) returning id`,
          [email, await hashSecret(pw), `${fields[0]} ${fields[1]}`], c);
        await q(`update employees set user_id = $2 where id = $1`, [empId, u.id], c);
        msg = `Empleado guardado. Usuario ${email} creado con contraseña temporal: ${pw} (se pedirá cambiarla al ingresar).`;
      }
      const after = await one(`select * from employees where id = $1`, [empId], c);
      await audit({ actorId: a.id, action: id ? "employee.updated" : "employee.created", entity: "employee", entityId: empId,
        before: before && { ...before, pin_hash: undefined }, after: { ...after, pin_hash: undefined, authorized, pinChanged: !!pin }, ip }, c);
    });
    return msg;
  });
}
export async function toggleEmployee(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "employees.manage");
    const e = await employeeRow(a, uuid(fd, "id"));
    const r = await one(`update employees set active = not active, updated_at = now() where id = $1 returning active, user_id`, [e.id]);
    if (r.user_id) {
      await q(`update users set active = $2 where id = $1`, [r.user_id, r.active]);
      if (!r.active) await q(`update sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [r.user_id]);
    }
    await audit({ actorId: a.id, action: r.active ? "employee.activated" : "employee.deactivated", entity: "employee", entityId: e.id, ip });
    return r.active ? "Empleado activado." : "Empleado desactivado (no podrá fichar ni ingresar).";
  });
}
export async function resetEmployeePassword(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "employees.manage");
    const e = await employeeRow(a, uuid(fd, "id"));
    if (!e.user_id) throw new AppError("nouser", "El empleado no tiene usuario.");
    const pw = tempPassword();
    await q(`update users set password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = null where id = $1`, [e.user_id, await hashSecret(pw)]);
    await q(`update sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [e.user_id]);
    await audit({ actorId: a.id, action: "user.password_reset", entity: "user", entityId: e.user_id, ip });
    return `Contraseña temporal: ${pw}`;
  });
}

// ---------------------------------------------------------------- usuarios de gestión
const ASSIGNABLE: Record<Role, Role[]> = {
  superadmin: ["superadmin", "company_admin", "manager", "supervisor"],
  company_admin: ["company_admin", "manager", "supervisor"],
  manager: [], supervisor: [], employee: [],
};
export async function saveUser(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "users.manage");
    const id = str(fd, "id");
    const role = str(fd, "role") as Role;
    if (!ASSIGNABLE[a.role].includes(role)) throw forbidden("No podés asignar ese rol.");
    const companyId = role === "superadmin" ? null : uuid(fd, "company_id", "la empresa");
    if (companyId) { assertCompany(a, companyId); if (!hasCompanyWideScope(a, companyId)) throw forbidden(); }
    const branchIds = uuids(fd, "branches");
    if (role === "supervisor" && !branchIds.length) throw new AppError("scope", "Un encargado necesita al menos una sucursal asignada.");
    if (branchIds.length) {
      const bs = await q(`select id from branches where id = any($1) and company_id = $2`, [branchIds, companyId]);
      if (bs.length !== branchIds.length) throw new AppError("scope", "Sucursales inválidas para esa empresa.");
    }
    const name = req(fd, "full_name", "Nombre", 120);
    const email = req(fd, "email", "Correo", 200).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError("email", "Correo inválido.");
    let msg = "Usuario guardado.";
    await tx(async (c) => {
      let uid = id;
      const before = id ? await one(`select id, email, role, full_name, active from users where id = $1`, [id], c) : null;
      if (id) {
        if (!before) throw notFound();
        if (before.role === "employee") throw new AppError("role", "Los usuarios de empleados se gestionan desde Empleados.");
        if (!ASSIGNABLE[a.role].includes(before.role)) throw forbidden();
        if (a.role !== "superadmin") {
          const sc = await q(`select company_id from user_scopes where user_id = $1`, [id], c);
          if (sc.some((s) => !a.scopes.some((x) => x.company_id === s.company_id && x.branch_id === null))) throw forbidden();
        }
        await q(`update users set full_name = $2, email = $3, role = $4, updated_at = now() where id = $1`, [id, name, email, role], c);
        await q(`delete from user_scopes where user_id = $1`, [id], c);
      } else {
        const pw = tempPassword();
        uid = (await one(`insert into users (email, password_hash, role, full_name, must_change_password) values ($1,$2,$3,$4,true) returning id`,
          [email, await hashSecret(pw), role, name], c)).id;
        msg = `Usuario creado. Contraseña temporal: ${pw} (se pedirá cambiarla al ingresar).`;
      }
      if (companyId) {
        if (role === "supervisor" || branchIds.length) for (const b of branchIds) await q(`insert into user_scopes (user_id, company_id, branch_id) values ($1,$2,$3)`, [uid, companyId, b], c);
        else await q(`insert into user_scopes (user_id, company_id) values ($1,$2)`, [uid, companyId], c);
      }
      await audit({ actorId: a.id, action: id ? "user.updated" : "user.created", entity: "user", entityId: uid, before, after: { email, role, name, companyId, branchIds }, ip }, c);
    });
    return msg;
  });
}
export async function toggleUser(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "users.manage");
    const id = uuid(fd, "id");
    if (id === a.id) throw new AppError("self", "No podés desactivar tu propio usuario.");
    const u = await one(`select role from users where id = $1`, [id]);
    if (!u || !ASSIGNABLE[a.role].includes(u.role)) throw forbidden();
    if (a.role !== "superadmin") {
      const sc = await q(`select company_id from user_scopes where user_id = $1`, [id]);
      if (sc.some((s) => !hasCompanyWideScope(a, s.company_id))) throw forbidden();
    }
    const r = await one(`update users set active = not active where id = $1 returning active`, [id]);
    if (!r.active) await q(`update sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [id]);
    await audit({ actorId: a.id, action: r.active ? "user.activated" : "user.deactivated", entity: "user", entityId: id, ip });
    return r.active ? "Usuario activado." : "Usuario desactivado y sesiones cerradas.";
  });
}
export async function resetUserPassword(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "users.manage");
    const id = uuid(fd, "id");
    const u = await one(`select role from users where id = $1`, [id]);
    if (!u || !ASSIGNABLE[a.role].includes(u.role)) throw forbidden();
    if (a.role !== "superadmin") {
      const sc = await q(`select company_id from user_scopes where user_id = $1`, [id]);
      if (sc.some((s) => !hasCompanyWideScope(a, s.company_id))) throw forbidden();
    }
    const pw = tempPassword();
    await q(`update users set password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = null where id = $1`, [id, await hashSecret(pw)]);
    await q(`update sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [id]);
    await audit({ actorId: a.id, action: "user.password_reset", entity: "user", entityId: id, ip });
    return `Contraseña temporal: ${pw}`;
  });
}

// ---------------------------------------------------------------- horarios
export async function addTemplate(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "schedules.manage");
    const e = await employeeRow(a, uuid(fd, "employee_id", "el empleado"));
    const branchId = uuid(fd, "branch_id", "la sucursal");
    const ok = await one(`select 1 from employee_branches where employee_id = $1 and branch_id = $2`, [e.id, branchId]);
    if (!ok) throw new AppError("branch", "El empleado no está autorizado en esa sucursal.");
    assertBranch(a, e.company_id, branchId);
    const days = fd.getAll("weekday").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!days.length) throw new AppError("days", "Elegí al menos un día de la semana.");
    const start = time(fd, "start_time", "Hora de inicio"), end = time(fd, "end_time", "Hora de fin");
    if (start === end) throw new AppError("time", "El inicio y el fin no pueden ser iguales.");
    const brk = num(fd, "break_minutes", "Descanso", 0, 240) ?? 0;
    const from = str(fd, "valid_from") ? date(fd, "valid_from", "Vigente desde") : localDate();
    const to = str(fd, "valid_to") ? date(fd, "valid_to", "Vigente hasta") : null;
    for (const d of days) {
      const t = await one(
        `insert into schedule_templates (employee_id, branch_id, weekday, start_time, end_time, break_minutes, valid_from, valid_to, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [e.id, branchId, d, start, end, brk, from, to, a.id]);
      await audit({ actorId: a.id, action: "schedule.template_created", entity: "schedule_template", entityId: t.id, after: t, ip });
    }
    const today = localDate();
    const n = await materializeShifts(today, addDays(today, 14), { employeeId: e.id });
    return `Horario agregado. ${n} turno(s) generado(s) para los próximos 14 días.${end < start ? " Turno nocturno: termina al día siguiente." : ""}`;
  });
}
export async function deleteTemplate(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "schedules.manage");
    const t = await one(`select * from schedule_templates where id = $1`, [uuid(fd, "id")]);
    if (!t) throw notFound();
    await employeeRow(a, t.employee_id);
    await tx(async (c) => {
      await dropFutureShiftsOfTemplate(t.id, c);
      await q(`delete from schedule_templates where id = $1`, [t.id], c);
      await audit({ actorId: a.id, action: "schedule.template_deleted", entity: "schedule_template", entityId: t.id, before: t, ip }, c);
    });
    return "Horario eliminado. Los turnos futuros fueron quitados; los pasados se conservan.";
  });
}
export async function addShift(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "schedules.manage");
    const e = await employeeRow(a, uuid(fd, "employee_id", "el empleado"));
    const branchId = uuid(fd, "branch_id", "la sucursal");
    const ok = await one(`select 1 from employee_branches where employee_id = $1 and branch_id = $2`, [e.id, branchId]);
    if (!ok) throw new AppError("branch", "El empleado no está autorizado en esa sucursal.");
    const b = await branchRow(branchId);
    const d = date(fd, "work_date", "Fecha");
    const st = time(fd, "start_time", "Inicio"), en = time(fd, "end_time", "Fin");
    const startAt = zonedToUtc(d, st, b.timezone);
    const endAt = zonedToUtc(en <= st ? addDays(d, 1) : d, en, b.timezone);
    const s = await one(
      `insert into shifts (employee_id, branch_id, work_date, start_at, end_at, break_minutes, notes, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [e.id, branchId, d, startAt, endAt, num(fd, "break_minutes", "Descanso", 0, 240) ?? 0, str(fd, "notes", 200) || null, a.id]);
    await audit({ actorId: a.id, action: "shift.created", entity: "shift", entityId: s.id, after: s, ip });
    return "Turno agregado.";
  });
}
export async function cancelShift(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "schedules.manage");
    const s = await one(`select * from shifts where id = $1`, [uuid(fd, "id")]);
    if (!s) throw notFound();
    await employeeRow(a, s.employee_id);
    const after = await one(`update shifts set status = 'cancelled', updated_at = now(), notes = coalesce(notes || ' · ', '') || $2 where id = $1 returning *`,
      [s.id, `Cancelado: ${req(fd, "reason", "Motivo", 200)}`]);
    await audit({ actorId: a.id, action: "shift.cancelled", entity: "shift", entityId: s.id, before: s, after, ip });
    return "Turno cancelado (queda registrado en auditoría).";
  });
}
export async function addLeave(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "schedules.manage");
    const e = await employeeRow(a, uuid(fd, "employee_id", "el empleado"));
    const type = str(fd, "type");
    if (!["franco", "vacaciones", "licencia_medica", "licencia_especial", "feriado", "otro"].includes(type)) throw new AppError("type", "Tipo de novedad inválido.");
    const from = date(fd, "start_date", "Desde"), to = str(fd, "end_date") ? date(fd, "end_date", "Hasta") : from;
    if (to < from) throw new AppError("range", "La fecha final es anterior a la inicial.");
    const l = await one(`insert into leaves (employee_id, type, start_date, end_date, notes, created_by) values ($1,$2,$3,$4,$5,$6) returning *`,
      [e.id, type, from, to, str(fd, "notes", 300) || null, a.id]);
    await audit({ actorId: a.id, action: "leave.created", entity: "leave", entityId: l.id, after: l, ip });
    return "Novedad registrada.";
  });
}
export async function deleteLeave(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "schedules.manage");
    const l = await one(`select * from leaves where id = $1`, [uuid(fd, "id")]);
    if (!l) throw notFound();
    await employeeRow(a, l.employee_id);
    await q(`delete from leaves where id = $1`, [l.id]);
    await audit({ actorId: a.id, action: "leave.deleted", entity: "leave", entityId: l.id, before: l, ip });
    return "Novedad eliminada.";
  });
}

// ---------------------------------------------------------------- correcciones
export async function requestCorrectionAction(_: ActionState, fd: FormData) {
  return run(async (a) => {
    const kind = str(fd, "kind") === "void_punch" ? "void_punch" : "add_punch";
    const employeeId = uuid(fd, "employee_id", "el empleado");
    if (kind === "void_punch") {
      await requestCorrection(a, { employeeId, kind, punchId: uuid(fd, "punch_id", "la fichada"), reason: req(fd, "reason", "Motivo", 500) });
    } else {
      const branchId = uuid(fd, "branch_id", "la sucursal");
      const b = await branchRow(branchId);
      const dt = str(fd, "datetime");
      const m = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      if (!m) throw new AppError("dt", "Fecha y hora inválidas.");
      await requestCorrection(a, {
        employeeId, branchId, kind, type: str(fd, "type") === "out" ? "out" : "in",
        time: zonedToUtc(m[1], m[2], b.timezone), reason: req(fd, "reason", "Motivo", 500),
      });
    }
    return "Solicitud de corrección enviada para revisión.";
  });
}
export async function reviewCorrectionAction(_: ActionState, fd: FormData) {
  return run(async (a) => {
    const d = str(fd, "decision");
    if (d !== "approve" && d !== "reject") throw new AppError("decision", "Indicá si aprobás o rechazás la solicitud.");
    const decision = d;
    await reviewCorrection(a, uuid(fd, "id"), decision, str(fd, "note", 500));
    return decision === "approve" ? "Corrección aprobada. La fichada original se conserva." : "Corrección rechazada.";
  });
}

// ---------------------------------------------------------------- alertas
export async function ackAlert(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "alerts.ack");
    const al = await one(`select * from alerts where id = $1`, [uuid(fd, "id")]);
    if (!al) throw notFound();
    if (al.company_id) { if (al.branch_id) assertBranch(a, al.company_id, al.branch_id); else assertCompany(a, al.company_id); }
    else if (a.role !== "superadmin") throw forbidden();
    await q(`update alerts set acknowledged_by = $2, acknowledged_at = now() where id = $1 and acknowledged_at is null`, [al.id, a.id]);
    await audit({ actorId: a.id, action: "alert.acknowledged", entity: "alert", entityId: al.id, ip });
    return "Alerta marcada como revisada.";
  });
}

// ---------------------------------------------------------------- terminales
export async function createTerminal(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "terminals.manage");
    const b = await branchRow(uuid(fd, "branch_id", "la sucursal"));
    assertBranch(a, b.company_id, b.id);
    const t = await one(`insert into terminals (branch_id, name, allow_kiosk_punch) values ($1,$2,$3) returning *`,
      [b.id, req(fd, "name", "Nombre", 80), fd.get("allow_kiosk_punch") === "on"]);
    await audit({ actorId: a.id, action: "terminal.created", entity: "terminal", entityId: t.id, after: t, ip });
    const code = await createPairingCode(t.id);
    return `Terminal creada. Código de vinculación (válido 15 min): ${code}. Abrí /terminal en el dispositivo del local e ingresalo.`;
  });
}
async function terminalOf(a: Actor, id: string) {
  const t = await one(`select t.*, b.company_id from terminals t join branches b on b.id = t.branch_id where t.id = $1`, [id]);
  if (!t) throw notFound();
  assertBranch(a, t.company_id, t.branch_id);
  return t;
}
export async function terminalPairing(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "terminals.manage");
    const t = await terminalOf(a, uuid(fd, "id"));
    const code = await createPairingCode(t.id);
    await audit({ actorId: a.id, action: "terminal.pairing_code", entity: "terminal", entityId: t.id, ip });
    return `Código de vinculación (válido 15 min): ${code}. Al vincular un nuevo dispositivo, el anterior deja de funcionar.`;
  });
}
export async function toggleTerminal(_: ActionState, fd: FormData) {
  return run(async (a, ip) => {
    requireCap(a, "terminals.manage");
    const t = await terminalOf(a, uuid(fd, "id"));
    const field = str(fd, "field") === "kiosk" ? "allow_kiosk_punch" : "active";
    const r = await one(`update terminals set ${field} = not ${field} where id = $1 returning active, allow_kiosk_punch`, [t.id]);
    await audit({ actorId: a.id, action: `terminal.${field}_toggled`, entity: "terminal", entityId: t.id, after: r, ip });
  });
}
