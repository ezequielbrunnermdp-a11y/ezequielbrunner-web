import { z } from "zod";
import type { Queryable } from "../db";
import { assertCan, ForbiddenError, type Ctx } from "../auth/permissions";
import { audit } from "../audit";
import { checkTransition, PRIORITIES, TASK_STATUSES, type TaskStatus } from "./transitions";

export class ValidationError extends Error {}

/** Las horas de WhatsApp son locales sin zona: se devuelven como texto para no desplazarlas. */
export const SENT_AT = `to_char(m.sent_at, 'YYYY-MM-DD"T"HH24:MI:SS')`;

export const taskInputSchema = z.object({
  title: z.string().trim().min(3, "El título es muy corto.").max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(PRIORITIES).default("medium"),
  assignee_label: z.string().trim().max(120).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  conversation_id: z.string().uuid().optional().nullable(),
});
export type TaskInput = z.input<typeof taskInputSchema>;

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: (typeof PRIORITIES)[number];
  assignee_label: string | null;
  due_date: string | null;
  branch_id: string | null;
  branch_name: string | null;
  conversation_id: string | null;
  source: "manual" | "finding";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

async function assertBranch(q: Queryable, companyId: string, branchId?: string | null) {
  if (!branchId) return;
  const r = await q.query(`select 1 from branches where id = $1 and company_id = $2`, [branchId, companyId]);
  if (!r.rows.length) throw new ForbiddenError("Sucursal inválida.");
}

/** Usada por la creación manual y por la aprobación de hallazgos (dentro de su transacción). */
export async function insertTask(
  q: Queryable,
  ctx: Ctx,
  raw: TaskInput,
  source: "manual" | "finding",
  evidenceMessageId: string | null = null,
): Promise<string> {
  const input = taskInputSchema.parse(raw);
  await assertBranch(q, ctx.companyId, input.branch_id);
  const r = await q.query<{ id: string }>(
    `insert into tasks (company_id, branch_id, conversation_id, title, description, priority, assignee_label, due_date, source, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [ctx.companyId, input.branch_id ?? null, input.conversation_id ?? null, input.title, input.description || null,
      input.priority, input.assignee_label || null, input.due_date || null, source, ctx.userId],
  );
  const id = r.rows[0].id;
  await q.query(
    `insert into task_events (company_id, task_id, actor_id, type, to_status, evidence_message_id, note)
     values ($1, $2, $3, $4, 'pending', $5, $6)`,
    [ctx.companyId, id, ctx.userId, source === "finding" ? "created_from_finding" : "created", evidenceMessageId,
      source === "finding" ? "Validada por una persona a partir de un hallazgo con evidencia." : null],
  );
  await audit(q, { companyId: ctx.companyId, actorId: ctx.userId, action: "task.create", targetType: "task", targetId: id, metadata: { source } });
  return id;
}

export async function createTask(ctx: Ctx, raw: TaskInput): Promise<string> {
  assertCan(ctx, "tasks.write");
  return ctx.db.tx((q) => insertTask(q, ctx, raw, "manual"));
}

export async function updateTask(ctx: Ctx, taskId: string, raw: TaskInput): Promise<void> {
  assertCan(ctx, "tasks.write");
  const input = taskInputSchema.parse(raw);
  await ctx.db.tx(async (q) => {
    const cur = await q.query<TaskRow>(`select * from tasks where id = $1 and company_id = $2 for update`, [taskId, ctx.companyId]);
    const t = cur.rows[0];
    if (!t) throw new ForbiddenError("Tarea inexistente.");
    await assertBranch(q, ctx.companyId, input.branch_id);
    const next = {
      title: input.title, description: input.description || null, priority: input.priority,
      assignee_label: input.assignee_label || null, due_date: input.due_date || null, branch_id: input.branch_id ?? null,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => normalize(t[k]) !== normalize(next[k]));
    if (!changed.length) return;
    await q.query(
      `update tasks set title=$3, description=$4, priority=$5, assignee_label=$6, due_date=$7, branch_id=$8, updated_at=now()
       where id = $1 and company_id = $2`,
      [taskId, ctx.companyId, next.title, next.description, next.priority, next.assignee_label, next.due_date, next.branch_id],
    );
    await q.query(
      `insert into task_events (company_id, task_id, actor_id, type, note) values ($1, $2, $3, 'edited', $4)`,
      [ctx.companyId, taskId, ctx.userId, `Campos modificados: ${changed.join(", ")}`],
    );
    await audit(q, { companyId: ctx.companyId, actorId: ctx.userId, action: "task.update", targetType: "task", targetId: taskId, metadata: { changed } });
  });
}

function normalize(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v == null || v === "" ? null : String(v);
}

export async function changeTaskStatus(
  ctx: Ctx,
  taskId: string,
  to: TaskStatus,
  opts: { note?: string | null; evidenceMessageId?: string | null } = {},
  q: Queryable | null = null,
): Promise<void> {
  assertCan(ctx, "tasks.write");
  if (!TASK_STATUSES.includes(to)) throw new ValidationError("Estado inválido.");
  const run = async (tq: Queryable) => {
    const cur = await tq.query<{ status: TaskStatus }>(`select status from tasks where id = $1 and company_id = $2`, [taskId, ctx.companyId]);
    const from = cur.rows[0]?.status;
    if (!from) throw new ForbiddenError("Tarea inexistente.");
    if (opts.evidenceMessageId) {
      const m = await tq.query(`select 1 from messages where id = $1 and company_id = $2`, [opts.evidenceMessageId, ctx.companyId]);
      if (!m.rows.length) throw new ForbiddenError("El mensaje de evidencia no pertenece a esta empresa.");
    }
    const check = checkTransition({ from, to, note: opts.note, evidenceMessageId: opts.evidenceMessageId });
    if (!check.ok) throw new ValidationError(check.reason);
    await tq.query(
      `update tasks set status = $3, updated_at = now(), completed_at = case when $3 = 'done' then now() else null end
       where id = $1 and company_id = $2`,
      [taskId, ctx.companyId, to],
    );
    await tq.query(
      `insert into task_events (company_id, task_id, actor_id, type, from_status, to_status, note, evidence_message_id)
       values ($1, $2, $3, 'status', $4, $5, $6, $7)`,
      [ctx.companyId, taskId, ctx.userId, from, to, opts.note?.trim() || null, opts.evidenceMessageId ?? null],
    );
    await audit(tq, { companyId: ctx.companyId, actorId: ctx.userId, action: "task.status", targetType: "task", targetId: taskId, metadata: { from, to } });
  };
  if (q) return run(q);
  return ctx.db.tx(run);
}

export interface TaskFilters {
  status?: TaskStatus | "open" | "all";
  branchId?: string;
  priority?: string;
  q?: string;
  overdue?: boolean;
}

export async function listTasks(ctx: Ctx, f: TaskFilters = {}): Promise<TaskRow[]> {
  assertCan(ctx, "data.read");
  const where = ["t.company_id = $1"];
  const params: unknown[] = [ctx.companyId];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (!f.status || f.status === "open") where.push(`t.status in ('pending','in_progress','insufficient_info')`);
  else if (f.status !== "all") add("t.status = ?", f.status);
  if (f.branchId) add("t.branch_id = ?", f.branchId);
  if (f.priority) add("t.priority = ?", f.priority);
  if (f.q) add("(t.title ilike ? or coalesce(t.assignee_label,'') ilike ?)", `%${f.q}%`);
  if (f.overdue) where.push(`t.due_date < current_date and t.status in ('pending','in_progress')`);
  const r = await ctx.db.query<TaskRow>(
    `select t.*, to_char(t.due_date, 'YYYY-MM-DD') as due_date, b.name as branch_name
     from tasks t left join branches b on b.id = t.branch_id
     where ${where.join(" and ")}
     order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
              t.due_date nulls last, t.created_at desc
     limit 500`,
    params,
  );
  return r.rows;
}

export interface TaskEvent {
  id: string;
  type: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  note: string | null;
  evidence_message_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export async function getTask(ctx: Ctx, taskId: string) {
  assertCan(ctx, "data.read");
  const t = await ctx.db.query<TaskRow>(
    `select t.*, to_char(t.due_date, 'YYYY-MM-DD') as due_date, b.name as branch_name
     from tasks t left join branches b on b.id = t.branch_id where t.id = $1 and t.company_id = $2`,
    [taskId, ctx.companyId],
  );
  if (!t.rows[0]) return null;
  const events = await ctx.db.query<TaskEvent>(
    `select e.id, e.type, e.from_status, e.to_status, e.note, e.evidence_message_id, u.name as actor_name, e.created_at
     from task_events e left join users u on u.id = e.actor_id
     where e.task_id = $1 and e.company_id = $2 order by e.created_at asc`,
    [taskId, ctx.companyId],
  );
  const evidence = await ctx.db.query<EvidenceRow>(
    `with ev as (
       select fe.message_id, fe.quote from findings f join finding_evidence fe on fe.finding_id = f.id
       where f.task_id = $1 and f.company_id = $2
       union all
       select e.evidence_message_id, null from task_events e
       where e.task_id = $1 and e.company_id = $2 and e.evidence_message_id is not null
     )
     select m.id as message_id, m.conversation_id, ${SENT_AT} as sent_at, m.author_label, m.body,
       (select max(ev.quote) from ev where ev.message_id = m.id) as quote, m.source_line, i.file_name
     from messages m join imports i on i.id = m.import_id
     where m.company_id = $2 and m.id in (select message_id from ev)
     order by m.sent_at asc, m.source_line asc`,
    [taskId, ctx.companyId],
  );
  return { task: t.rows[0], events: events.rows, evidence: evidence.rows };
}

export interface EvidenceRow {
  message_id: string;
  conversation_id: string;
  sent_at: string;
  author_label: string | null;
  body: string;
  quote: string | null;
  source_line: number;
  file_name: string;
}
