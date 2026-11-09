import { q, type Db, pool } from "./db";

/**
 * Genera turnos concretos a partir de las plantillas semanales (idempotente).
 * La hora local de la sucursal se convierte a UTC en Postgres; si end_time <= start_time
 * el turno termina al día siguiente (turno nocturno).
 */
export async function materializeShifts(fromDate: string, toDate: string, opts: { employeeId?: string } = {}, db: Db = pool()) {
  const params: unknown[] = [fromDate, toDate];
  let filter = "";
  if (opts.employeeId) { params.push(opts.employeeId); filter = `and t.employee_id = $3`; }
  const rows = await q(
    `insert into shifts (employee_id, branch_id, work_date, start_at, end_at, break_minutes, template_id)
     select t.employee_id, t.branch_id, d::date,
            (d::date + t.start_time) at time zone b.timezone,
            case when t.end_time <= t.start_time
                 then ((d::date + 1) + t.end_time) at time zone b.timezone
                 else (d::date + t.end_time) at time zone b.timezone end,
            t.break_minutes, t.id
     from schedule_templates t
     join employees e on e.id = t.employee_id and e.active
     join branches b on b.id = t.branch_id
     cross join generate_series($1::date, $2::date, interval '1 day') d
     where extract(dow from d)::int = t.weekday
       and d::date >= t.valid_from and (t.valid_to is null or d::date <= t.valid_to)
       ${filter}
     on conflict (employee_id, work_date, template_id) where template_id is not null do nothing
     returning id`,
    params,
    db,
  );
  return rows.length;
}

/** Al cambiar una plantilla: elimina sus turnos futuros aún no iniciados para regenerarlos. */
export async function dropFutureShiftsOfTemplate(templateId: string, db: Db = pool()) {
  await q(`delete from shifts where template_id = $1 and start_at > now()`, [templateId], db);
}
