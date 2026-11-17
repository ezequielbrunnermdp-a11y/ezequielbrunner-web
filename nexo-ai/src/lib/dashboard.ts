import { assertCan, type Ctx } from "./auth/permissions";
import type { TaskStatus } from "./tasks/transitions";

export async function getDashboard(ctx: Ctx) {
  assertCan(ctx, "data.read");
  const c = [ctx.companyId];
  const q = <T,>(sql: string) => ctx.db.query<T>(sql, c).then((r) => r.rows);

  const [kpi] = await q<{ open: number; overdue: number; today: number; urgent: number; done7: number; inbox: number; conversations: number; messages: number }>(
    `select
       (select count(*)::int from tasks where company_id = $1 and status in ('pending','in_progress','insufficient_info')) as open,
       (select count(*)::int from tasks where company_id = $1 and status in ('pending','in_progress') and due_date < current_date) as overdue,
       (select count(*)::int from tasks where company_id = $1 and status in ('pending','in_progress') and due_date = current_date) as today,
       (select count(*)::int from tasks where company_id = $1 and status in ('pending','in_progress') and priority = 'urgent') as urgent,
       (select count(*)::int from tasks where company_id = $1 and status = 'done' and completed_at >= now() - interval '7 days') as done7,
       (select count(*)::int from findings where company_id = $1 and status = 'proposed') as inbox,
       (select count(*)::int from conversations where company_id = $1) as conversations,
       (select count(*)::int from messages where company_id = $1) as messages`,
  );

  const activity = await q<{ day: string; messages: number }>(
    `select to_char(d, 'YYYY-MM-DD') as day,
       (select count(*)::int from messages m where m.company_id = $1 and m.sent_at >= d and m.sent_at < d + interval '1 day') as messages
     from generate_series(current_date - 29, current_date, interval '1 day') d order by d`,
  );

  const byBranch = await q<{ branch: string; pending: number; in_progress: number; insufficient_info: number; overdue: number }>(
    `select coalesce(b.name, 'Sin sucursal') as branch,
       count(*) filter (where t.status = 'pending')::int as pending,
       count(*) filter (where t.status = 'in_progress')::int as in_progress,
       count(*) filter (where t.status = 'insufficient_info')::int as insufficient_info,
       count(*) filter (where t.status in ('pending','in_progress') and t.due_date < current_date)::int as overdue
     from tasks t left join branches b on b.id = t.branch_id
     where t.company_id = $1 and t.status in ('pending','in_progress','insufficient_info')
     group by 1 order by count(*) desc, 1`,
  );

  const attention = await q<{ id: string; title: string; status: TaskStatus; priority: string; due_date: string | null; branch: string | null; assignee_label: string | null }>(
    `select t.id, t.title, t.status, t.priority, to_char(t.due_date, 'YYYY-MM-DD') as due_date, b.name as branch, t.assignee_label
     from tasks t left join branches b on b.id = t.branch_id
     where t.company_id = $1 and t.status in ('pending','in_progress')
       and (t.priority in ('urgent','high') or t.due_date <= current_date + 2)
     order by (t.due_date < current_date) desc, case t.priority when 'urgent' then 0 when 'high' then 1 else 2 end, t.due_date nulls last
     limit 6`,
  );

  const feed = await q<{ kind: string; title: string; detail: string | null; at: string; href: string }>(
    `(select 'event' as kind, t.title, case e.type when 'status' then e.to_status when 'created_from_finding' then 'validated' else e.type end as detail,
        e.created_at as at, '/tasks/' || t.id as href
      from task_events e join tasks t on t.id = e.task_id where e.company_id = $1 and e.type <> 'edited')
     union all
     (select 'import', c.title, i.inserted::text, i.created_at, '/conversations/' || c.id
      from imports i join conversations c on c.id = i.conversation_id where i.company_id = $1)
     union all
     (select 'decision', f.title, null, f.reviewed_at, '/inbox?status=approved'
      from findings f where f.company_id = $1 and f.type = 'decision' and f.status = 'approved')
     order by at desc limit 10`,
  );

  return { kpi, activity, byBranch, attention, feed };
}
