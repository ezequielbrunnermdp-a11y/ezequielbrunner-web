import { one, q } from "./db";
import { pairPunches } from "./attendance";
import { localDate, addDays, zonedToUtc } from "./time";

export async function employeeHome(userId: string) {
  const e = await one(
    `select e.id, e.first_name, e.last_name, e.file_number, e.sector, e.position, e.pin_hash is not null as has_pin,
            b.name as branch_name, b.timezone, c.name as company_name, c.max_shift_hours
     from employees e join branches b on b.id = e.primary_branch_id join companies c on c.id = e.company_id
     where e.user_id = $1`,
    [userId],
  );
  if (!e) return null;
  const tz = e.timezone;
  const today = localDate(new Date(), tz);
  const [branches, shifts, punches, leaves] = await Promise.all([
    q(`select b.name from employee_branches eb join branches b on b.id = eb.branch_id where eb.employee_id = $1 and b.active order by b.name`, [e.id]),
    q(`select s.start_at, s.end_at, s.break_minutes, to_char(s.work_date,'YYYY-MM-DD') as work_date, b.name as branch_name
       from shifts s join branches b on b.id = s.branch_id
       where s.employee_id = $1 and s.status = 'active' and s.work_date between $2 and $3 order by s.start_at`,
      [e.id, addDays(today, -1), addDays(today, 13)]),
    q(`select p.id, p.type, p.occurred_at, p.source, b.name as branch_name,
              exists(select 1 from punch_voids v where v.punch_id = p.id) as voided
       from punches p join branches b on b.id = p.branch_id
       where p.employee_id = $1 and p.occurred_at > now() - interval '45 days' order by p.occurred_at desc`, [e.id]),
    q(`select type::text, to_char(start_date,'YYYY-MM-DD') s, to_char(end_date,'YYYY-MM-DD') e from leaves
       where employee_id = $1 and end_date >= $2 and start_date <= $3 order by start_date`, [e.id, today, addDays(today, 30)]),
  ]);
  const effective = punches.filter((p) => !p.voided).map((p) => ({ ...p, employee_id: e.id }));
  const last = effective[0] ?? null;
  const sessions = pairPunches(effective, new Date(), e.max_shift_hours);
  const sum = (from: Date) => Math.round(sessions.filter((s) => s.in && s.in.occurred_at >= from).reduce((a, s) => a + s.minutes, 0));
  const weekStart = (() => {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    return zonedToUtc(addDays(today, -((dow + 6) % 7)), "00:00", tz);
  })();
  const monthStart = zonedToUtc(today.slice(0, 8) + "01", "00:00", tz);
  return {
    employee: e, tz, today, branches: branches.map((b) => b.name), shifts, punches, leaves,
    open: last?.type === "in" && (Date.now() - new Date(last.occurred_at).getTime()) / 3600e3 < e.max_shift_hours,
    last,
    minutesWeek: sum(weekStart), minutesMonth: sum(monthStart),
  };
}
