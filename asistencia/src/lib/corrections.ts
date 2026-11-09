import { one, q, tx } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { assertBranch, requireCap, type Actor } from "./permissions";
import { applyApprovedCorrection } from "./punch";
import { audit } from "./audit";

/**
 * Solicitud de corrección. Nunca modifica fichadas: si se aprueba, agrega una fichada
 * de origen "correction" (sin coordenadas) o anula una existente conservándola.
 */
export async function requestCorrection(
  actor: Actor,
  input: { employeeId: string; branchId?: string; kind: "add_punch" | "void_punch"; punchId?: string; type?: "in" | "out"; time?: Date; reason: string },
) {
  requireCap(actor, "corrections.request");
  const emp = await one(`select id, company_id, primary_branch_id from employees where id = $1`, [input.employeeId]);
  if (!emp) throw notFound("Empleado inexistente.");
  if (input.reason.trim().length < 10) throw new AppError("bad_reason", "Explicá el motivo con al menos 10 caracteres.");

  let branchId = input.branchId ?? emp.primary_branch_id;
  if (input.kind === "void_punch") {
    const p = await one(`select id, branch_id, employee_id from punches where id = $1`, [input.punchId]);
    if (!p || p.employee_id !== emp.id) throw notFound("Fichada inexistente.");
    const voided = await one(`select 1 from punch_voids where punch_id = $1`, [p.id]);
    if (voided) throw new AppError("already_void", "Esa fichada ya fue anulada.");
    branchId = p.branch_id;
  } else {
    if (!input.type || !input.time || isNaN(input.time.getTime())) throw new AppError("bad_input", "Indicá tipo y hora de la fichada.");
    if (input.time > new Date()) throw new AppError("future", "No se pueden cargar fichadas en el futuro.");
    const ok = await one(`select 1 from employee_branches where employee_id = $1 and branch_id = $2`, [emp.id, branchId]);
    if (!ok) throw new AppError("branch", "El empleado no está autorizado en esa sucursal.");
  }
  assertBranch(actor, emp.company_id, branchId);

  const cr = await one(
    `insert into correction_requests (employee_id, company_id, branch_id, kind, punch_id, proposed_type, proposed_time, reason, requested_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [emp.id, emp.company_id, branchId, input.kind, input.punchId ?? null, input.type ?? null, input.time ?? null, input.reason.trim(), actor.id],
  );
  await audit({ actorId: actor.id, action: "correction.requested", entity: "correction_request", entityId: cr.id, after: cr });
  return cr;
}

export async function reviewCorrection(actor: Actor, correctionId: string, decision: "approve" | "reject", note: string) {
  requireCap(actor, "corrections.review");
  const cr = await one(`select * from correction_requests where id = $1`, [correctionId]);
  if (!cr) throw notFound();
  assertBranch(actor, cr.company_id, cr.branch_id);
  // Un empleado nunca puede aprobar correcciones sobre sus propias fichadas.
  if (actor.employee_id && actor.employee_id === cr.employee_id) throw forbidden("No podés aprobar correcciones sobre tus propias fichadas.");
  if (decision === "reject") {
    const r = await one(
      `update correction_requests set status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3
       where id = $1 and status = 'pending' returning *`,
      [correctionId, actor.id, note || null],
    );
    if (!r) throw new AppError("resolved", "La solicitud ya fue resuelta.");
    await audit({ actorId: actor.id, action: "correction.rejected", entity: "correction_request", entityId: correctionId, before: cr, after: r });
    return null;
  }
  return tx(async (c) => {
    const id = await applyApprovedCorrection(c, correctionId, actor.id);
    if (note) await q(`update correction_requests set review_note = $2 where id = $1`, [correctionId, note], c);
    return id;
  });
}
