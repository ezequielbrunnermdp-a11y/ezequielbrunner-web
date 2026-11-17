import { assertCan, type Ctx } from "../auth/permissions";
import { STATUS_LABELS, PRIORITY_LABELS, type TaskStatus } from "../tasks/transitions";
import { FINDING_LABELS, type FindingType } from "../analysis/types";

export type Period = "day" | "week" | "month";

export function periodRange(period: Period, anchor: string): { from: string; to: string; label: string } {
  const d = new Date(`${anchor}T00:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (period === "day") return { from: iso(d), to: iso(d), label: `Día ${iso(d)}` };
  if (period === "week") {
    const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - dow);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { from: iso(start), to: iso(end), label: `Semana ${iso(start)} → ${iso(end)}` };
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { from: iso(start), to: iso(end), label: `Mes ${iso(start).slice(0, 7)}` };
}

export interface Report {
  company: string;
  period: Period;
  from: string;
  to: string;
  label: string;
  generatedAt: string;
  totals: {
    messages: number;
    conversationsActive: number;
    tasksCreated: number;
    tasksCompleted: number;
    tasksDiscarded: number;
    openAtEnd: number;
    overdueAtEnd: number;
    findingsProposed: number;
    findingsApproved: number;
    findingsRejected: number;
  };
  byBranch: { branch: string; open: number; overdue: number; completed: number }[];
  incidents: { date: string; title: string; branch: string | null; status: string }[];
  decisions: { date: string; title: string; branch: string | null }[];
  completed: { date: string; title: string; branch: string | null }[];
  openTasks: { title: string; status: string; priority: string; due: string | null; branch: string | null; assignee: string | null }[];
}

/** Reporte agregado del período. No incluye rankings ni métricas por empleado. */
export async function buildReport(ctx: Ctx, period: Period, anchor: string): Promise<Report> {
  assertCan(ctx, "reports.read");
  const { from, to, label } = periodRange(period, anchor);
  const P = [ctx.companyId, from, to];
  const one = async (sql: string) => Number((await ctx.db.query<{ n: number }>(sql, P)).rows[0]?.n ?? 0);
  const inRange = (col: string) => `${col} >= $2::date and ${col} < ($3::date + 1)`;

  const company = (await ctx.db.query<{ name: string }>(`select name from companies where id = $1`, [ctx.companyId])).rows[0];
  const totals = {
    messages: await one(`select count(*)::int n from messages where company_id = $1 and ${inRange("sent_at")}`),
    conversationsActive: await one(`select count(distinct conversation_id)::int n from messages where company_id = $1 and ${inRange("sent_at")}`),
    tasksCreated: await one(`select count(*)::int n from tasks where company_id = $1 and ${inRange("created_at")}`),
    tasksCompleted: await one(`select count(*)::int n from tasks where company_id = $1 and status = 'done' and ${inRange("completed_at")}`),
    tasksDiscarded: await one(`select count(distinct task_id)::int n from task_events where company_id = $1 and to_status = 'discarded' and ${inRange("created_at")}`),
    openAtEnd: await one(`select count(*)::int n from tasks where company_id = $1 and status in ('pending','in_progress','insufficient_info') and created_at < ($3::date + 1) and $2::date is not null`),
    overdueAtEnd: await one(`select count(*)::int n from tasks where company_id = $1 and status in ('pending','in_progress') and due_date < ($3::date + 1) and $2::date is not null`),
    findingsProposed: await one(`select count(*)::int n from findings where company_id = $1 and ${inRange("created_at")}`),
    findingsApproved: await one(`select count(*)::int n from findings where company_id = $1 and status = 'approved' and ${inRange("reviewed_at")}`),
    findingsRejected: await one(`select count(*)::int n from findings where company_id = $1 and status = 'rejected' and ${inRange("reviewed_at")}`),
  };

  const byBranch = (
    await ctx.db.query<{ branch: string; open: number; overdue: number; completed: number }>(
      `select coalesce(b.name, 'Sin sucursal') as branch,
         count(*) filter (where t.status in ('pending','in_progress','insufficient_info'))::int as open,
         count(*) filter (where t.status in ('pending','in_progress') and t.due_date < ($3::date + 1))::int as overdue,
         count(*) filter (where t.status = 'done' and t.completed_at >= $2::date and t.completed_at < ($3::date + 1))::int as completed
       from tasks t left join branches b on b.id = t.branch_id where t.company_id = $1
       group by 1 order by 1`,
      P,
    )
  ).rows;

  const approvedOfType = (type: FindingType) =>
    ctx.db.query<{ date: string; title: string; branch: string | null; task_status: TaskStatus | null }>(
      `select to_char(f.reviewed_at, 'YYYY-MM-DD') as date, f.title, b.name as branch, t.status as task_status
       from findings f left join branches b on b.id = f.branch_id left join tasks t on t.id = f.task_id
       where f.company_id = $1 and f.type = '${type}' and f.status = 'approved' and ${inRange("f.reviewed_at")}
       order by f.reviewed_at`,
      P,
    );

  const incidents = (await approvedOfType("incident")).rows.map((r) => ({
    date: r.date, title: r.title, branch: r.branch, status: r.task_status ? STATUS_LABELS[r.task_status] : "Registrada",
  }));
  const decisions = (await approvedOfType("decision")).rows.map(({ date, title, branch }) => ({ date, title, branch }));
  const completed = (
    await ctx.db.query<{ date: string; title: string; branch: string | null }>(
      `select to_char(t.completed_at, 'YYYY-MM-DD') as date, t.title, b.name as branch from tasks t left join branches b on b.id = t.branch_id
       where t.company_id = $1 and t.status = 'done' and ${inRange("t.completed_at")} order by t.completed_at`,
      P,
    )
  ).rows;
  const openTasks = (
    await ctx.db.query<{ title: string; status: TaskStatus; priority: keyof typeof PRIORITY_LABELS; due: string | null; branch: string | null; assignee: string | null }>(
      `select t.title, t.status, t.priority, to_char(t.due_date, 'YYYY-MM-DD') as due, b.name as branch, t.assignee_label as assignee
       from tasks t left join branches b on b.id = t.branch_id
       where t.company_id = $1 and t.status in ('pending','in_progress','insufficient_info') and t.created_at < ($3::date + 1) and $2::date is not null
       order by t.due_date nulls last limit 200`,
      P,
    )
  ).rows.map((t) => ({ ...t, status: STATUS_LABELS[t.status], priority: PRIORITY_LABELS[t.priority] }));

  return {
    company: company?.name ?? "", period, from, to, label, generatedAt: new Date().toISOString(),
    totals, byBranch, incidents, decisions, completed, openTasks,
  };
}

export { FINDING_LABELS };
