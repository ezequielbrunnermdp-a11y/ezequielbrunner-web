import { assertCan, ForbiddenError, type Ctx } from "../auth/permissions";
import { audit } from "../audit";
import { changeTaskStatus, insertTask, SENT_AT, ValidationError, type TaskInput } from "../tasks/service";
import type { FindingType } from "./types";

export interface FindingRow {
  id: string;
  conversation_id: string;
  conversation_title: string;
  type: FindingType;
  title: string;
  description: string | null;
  assignee_label: string | null;
  due_hint: string | null;
  due_date: string | null;
  branch_id: string | null;
  branch_name: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  confidence: string;
  rationale: string | null;
  engine: "claude" | "heuristic";
  status: "proposed" | "approved" | "rejected" | "insufficient_info";
  review_note: string | null;
  task_id: string | null;
  created_at: string;
  evidence: {
    message_id: string;
    quote: string;
    body: string;
    author_label: string | null;
    sent_at: string;
    source_line: number;
    file_name: string;
    suspicious: boolean;
  }[];
}

export async function listFindings(ctx: Ctx, status: FindingRow["status"] = "proposed", limit = 100): Promise<FindingRow[]> {
  assertCan(ctx, "data.read");
  const r = await ctx.db.query<Omit<FindingRow, "evidence">>(
    `select f.id, f.conversation_id, c.title as conversation_title, f.type, f.title, f.description, f.assignee_label, f.due_hint,
       to_char(f.due_date, 'YYYY-MM-DD') as due_date, f.branch_id, b.name as branch_name, f.priority, f.confidence::text as confidence,
       f.rationale, f.engine, f.status, f.review_note, f.task_id, f.created_at
     from findings f join conversations c on c.id = f.conversation_id left join branches b on b.id = f.branch_id
     where f.company_id = $1 and f.status = $2
     order by f.created_at desc, f.confidence desc limit $3`,
    [ctx.companyId, status, limit],
  );
  if (!r.rows.length) return [];
  const ev = await ctx.db.query<FindingRow["evidence"][number] & { finding_id: string }>(
    `select fe.finding_id, fe.message_id, fe.quote, m.body, m.author_label, ${SENT_AT} as sent_at, m.source_line, i.file_name, m.suspicious
     from finding_evidence fe join messages m on m.id = fe.message_id join imports i on i.id = m.import_id
     where m.company_id = $1 and fe.finding_id = any($2::uuid[]) order by m.sent_at`,
    [ctx.companyId, r.rows.map((x) => x.id)],
  );
  return r.rows.map((f) => ({ ...f, evidence: ev.rows.filter((e) => e.finding_id === f.id) }));
}

async function loadProposed(ctx: Ctx, q: import("../db").Queryable, findingId: string) {
  const r = await q.query<{ id: string; type: FindingType; status: string; conversation_id: string }>(
    `select id, type, status, conversation_id from findings where id = $1 and company_id = $2 for update`,
    [findingId, ctx.companyId],
  );
  const f = r.rows[0];
  if (!f) throw new ForbiddenError("Hallazgo inexistente.");
  if (f.status !== "proposed") throw new ValidationError("Este hallazgo ya fue revisado.");
  const ev = await q.query<{ message_id: string }>(
    `select fe.message_id from finding_evidence fe join messages m on m.id = fe.message_id
     where fe.finding_id = $1 order by m.sent_at asc`,
    [findingId],
  );
  if (!ev.rows.length) throw new ValidationError("El hallazgo no tiene evidencia trazable y no puede aprobarse.");
  return { ...f, evidenceIds: ev.rows.map((e) => e.message_id) };
}

/**
 * Validación humana. Tareas, solicitudes, compromisos e incidencias aprobadas
 * se convierten en tareas; las decisiones quedan registradas como decisión confirmada.
 */
export async function approveFinding(ctx: Ctx, findingId: string, edits: TaskInput & { note?: string | null }): Promise<{ taskId: string | null }> {
  assertCan(ctx, "findings.review");
  return ctx.db.tx(async (q) => {
    const f = await loadProposed(ctx, q, findingId);
    if (f.type === "completion_signal") throw new ValidationError("Para un posible cumplimiento, elegí la tarea que confirma.");
    let taskId: string | null = null;
    if (f.type !== "decision") {
      taskId = await insertTask(q, ctx, { ...edits, conversation_id: f.conversation_id }, "finding", f.evidenceIds[0]);
    }
    await q.query(
      `update findings set status = 'approved', reviewed_by = $3, reviewed_at = now(), review_note = $4, task_id = $5,
         title = $6, assignee_label = $7, due_date = $8, branch_id = $9, priority = $10
       where id = $1 and company_id = $2`,
      [findingId, ctx.companyId, ctx.userId, edits.note?.trim() || null, taskId, edits.title, edits.assignee_label || null,
        edits.due_date || null, edits.branch_id || null, edits.priority ?? "medium"],
    );
    await audit(q, { companyId: ctx.companyId, actorId: ctx.userId, action: "finding.approve", targetType: "finding", targetId: findingId, metadata: { task_id: taskId } });
    return { taskId };
  });
}

export async function rejectFinding(ctx: Ctx, findingId: string, note: string | null, as: "rejected" | "insufficient_info" = "rejected") {
  assertCan(ctx, "findings.review");
  await ctx.db.tx(async (q) => {
    await loadProposed(ctx, q, findingId);
    await q.query(
      `update findings set status = $3, reviewed_by = $4, reviewed_at = now(), review_note = $5 where id = $1 and company_id = $2`,
      [findingId, ctx.companyId, as, ctx.userId, note?.trim() || null],
    );
    await audit(q, {
      companyId: ctx.companyId, actorId: ctx.userId, action: as === "rejected" ? "finding.reject" : "finding.insufficient",
      targetType: "finding", targetId: findingId,
    });
  });
}

/** Una persona confirma que el mensaje evidencia el cumplimiento de una tarea concreta. */
export async function confirmCompletion(ctx: Ctx, findingId: string, taskId: string, note: string | null) {
  assertCan(ctx, "findings.review");
  await ctx.db.tx(async (q) => {
    const f = await loadProposed(ctx, q, findingId);
    if (f.type !== "completion_signal") throw new ValidationError("Este hallazgo no es una señal de cumplimiento.");
    const evidence = f.evidenceIds[f.evidenceIds.length - 1];
    await changeTaskStatus(ctx, taskId, "done", { note: note?.trim() || "Cumplimiento confirmado desde la bandeja de validación.", evidenceMessageId: evidence }, q);
    await q.query(
      `update findings set status = 'approved', reviewed_by = $3, reviewed_at = now(), review_note = $4, task_id = $5
       where id = $1 and company_id = $2`,
      [findingId, ctx.companyId, ctx.userId, note?.trim() || null, taskId],
    );
    await audit(q, { companyId: ctx.companyId, actorId: ctx.userId, action: "finding.confirm_completion", targetType: "finding", targetId: findingId, metadata: { task_id: taskId } });
  });
}
