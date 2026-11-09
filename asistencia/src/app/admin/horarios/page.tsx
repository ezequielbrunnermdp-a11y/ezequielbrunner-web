import { requireActor } from "@/lib/session";
import { one, q } from "@/lib/db";
import { can, canAccessBranch, scopeSql } from "@/lib/permissions";
import { WEEKDAYS, fmtTime, fmtDate, localDate, addDays, DEFAULT_TZ } from "@/lib/time";
import { Card, PageHeader, Badge, Field, Input, Select, TableWrap, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { InlineAction } from "@/components/inline-action";
import { addTemplate, deleteTemplate, addLeave, deleteLeave, addShift, cancelShift } from "../actions";
import { filterOptions, sp, isUuid, type SP } from "../data";

export const metadata = { title: "Horarios y novedades" };
const LEAVES = [["franco", "Franco"], ["vacaciones", "Vacaciones"], ["licencia_medica", "Licencia médica"], ["licencia_especial", "Licencia especial"], ["feriado", "Feriado"], ["otro", "Otro"]];

export default async function Horarios({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "dashboard.view" });
  const s = await searchParams;
  const options = await filterOptions(a);
  const manage = can(a, "schedules.manage");
  const empId = isUuid(sp(s, "employee")) ? sp(s, "employee")! : undefined;
  const today = localDate(new Date(), DEFAULT_TZ);

  if (!empId) {
    // Vista semanal por sucursal
    const branchId = isUuid(sp(s, "branch")) ? sp(s, "branch")! : options.branches[0]?.id;
    const start = sp(s, "week")?.match(/^\d{4}-\d{2}-\d{2}$/) ? sp(s, "week")! : addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const p: unknown[] = [branchId, start, addDays(start, 6)];
    const shifts = branchId ? await q(
      `select s.*, to_char(s.work_date,'YYYY-MM-DD') d, e.first_name || ' ' || e.last_name as name, e.id as eid from shifts s join employees e on e.id = s.employee_id
       where s.branch_id = $1 and s.work_date between $2 and $3 and s.status = 'active' and ${scopeSql(a, "e.company_id", "s.branch_id", p)} order by e.last_name`, p) : [];
    const leaves = branchId ? await q(
      `select l.*, to_char(l.start_date,'YYYY-MM-DD') sd, to_char(l.end_date,'YYYY-MM-DD') ed from leaves l join employee_branches eb on eb.employee_id = l.employee_id and eb.branch_id = $1
       where l.start_date <= $3 and l.end_date >= $2`, [branchId, start, addDays(start, 6)]) : [];
    const people = [...new Map(shifts.map((x) => [x.eid, x.name])).entries()];
    return (
      <>
        <PageHeader title="Horarios y novedades" subtitle="Vista semanal por sucursal. Elegí un empleado para editar su horario." />
        <form method="get" className="surface mb-6 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-4">
          <Select name="branch" defaultValue={branchId}>{options.branches.map((b) => <option key={b.id} value={b.id}>{b.company_name} · {b.name}</option>)}</Select>
          <Input type="date" name="week" defaultValue={start} />
          <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Ver semana</button>
        </form>
        <form method="get" className="surface mb-6 flex flex-wrap gap-3 rounded-2xl p-4">
          <Select name="employee" className="!w-auto flex-1" required defaultValue=""><option value="" disabled>Elegir empleado para editar horarios…</option>{options.employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.file_number})</option>)}</Select>
          <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Abrir</button>
        </form>
        <Card padded={false}>
          {people.length === 0 ? <div className="p-5"><Empty>No hay turnos cargados esta semana en esta sucursal.</Empty></div> : (
            <TableWrap><table className="tbl"><thead><tr><th>Empleado</th>{days.map((d) => <th key={d} className="capitalize">{fmtDate(d + "T15:00:00Z", DEFAULT_TZ, { weekday: "short", day: "2-digit" })}</th>)}</tr></thead>
              <tbody>{people.map(([eid, name]) => (
                <tr key={eid}><td className="font-medium"><a className="hover:text-brand-600" href={`/admin/horarios?employee=${eid}`}>{name}</a></td>
                  {days.map((d) => {
                    const lv = leaves.find((l) => l.employee_id === eid && l.sd <= d && l.ed >= d);
                    const ss = shifts.filter((x) => x.eid === eid && x.d === d);
                    return <td key={d} className="text-xs tabular-nums">{lv ? <Badge tone="violet">{lv.type.replace("_", " ")}</Badge> : ss.map((x) => <div key={x.id}>{fmtTime(x.start_at)}–{fmtTime(x.end_at)}</div>)}</td>;
                  })}</tr>
              ))}</tbody></table></TableWrap>
          )}
        </Card>
      </>
    );
  }

  const e = await one(`select e.*, c.timezone from employees e join companies c on c.id = e.company_id where e.id = $1`, [empId]);
  const eBranches = await q(`select b.id, b.name from employee_branches eb join branches b on b.id = eb.branch_id where eb.employee_id = $1 order by b.name`, [empId]);
  if (!e || !eBranches.some((b) => canAccessBranch(a, e.company_id, b.id))) return <Empty>Empleado no encontrado.</Empty>;
  const [templates, leaves, shifts] = await Promise.all([
    q(`select t.*, b.name as branch_name, to_char(t.start_time,'HH24:MI') st, to_char(t.end_time,'HH24:MI') et from schedule_templates t join branches b on b.id = t.branch_id where t.employee_id = $1 order by t.weekday, t.start_time`, [empId]),
    q(`select *, to_char(start_date,'YYYY-MM-DD') sd, to_char(end_date,'YYYY-MM-DD') ed from leaves where employee_id = $1 and end_date >= $2 order by start_date`, [empId, addDays(today, -60)]),
    q(`select s.*, b.name as branch_name from shifts s join branches b on b.id = s.branch_id where s.employee_id = $1 and s.work_date between $2 and $3 order by s.start_at`, [empId, addDays(today, -7), addDays(today, 14)]),
  ]);
  const tz = e.timezone;
  return (
    <>
      <PageHeader title={`Horarios de ${e.first_name} ${e.last_name}`} subtitle={`Legajo ${e.file_number}`} actions={<a href="/admin/horarios" className="surface rounded-xl px-3 py-1.5 text-xs font-medium">← Vista semanal</a>} />
      {!manage && <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">Sólo lectura: los cambios de horario los realiza la administración y quedan auditados.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Horario semanal">
          {templates.length === 0 ? <Empty>Sin horario semanal.</Empty> : (
            <ul className="divide-y divide-[var(--border)] text-sm">{templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span><b>{WEEKDAYS[t.weekday]}</b> {t.st}–{t.et}{t.et <= t.st && <Badge tone="violet" className="ml-1">nocturno</Badge>} <span className="text-xs text-muted">· {t.branch_name}{t.break_minutes ? ` · desc. ${t.break_minutes}′` : ""} · desde {fmtDate(t.valid_from)}{t.valid_to ? ` hasta ${fmtDate(t.valid_to)}` : ""}</span></span>
                {manage && <InlineAction action={deleteTemplate} fields={{ id: t.id }} label="Quitar" variant="danger" confirm="¿Quitar este horario? Se eliminan los turnos futuros generados." />}
              </li>
            ))}</ul>
          )}
          {manage && (
            <ActionForm action={addTemplate} className="mt-4 space-y-3 border-t border-app pt-4">
              <input type="hidden" name="employee_id" value={empId} />
              <div className="flex flex-wrap gap-2">{WEEKDAYS.map((d, i) => <label key={i} className="surface-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm"><input type="checkbox" name="weekday" value={(i + 1) % 7} />{WEEKDAYS[(i + 1) % 7].slice(0, 3)}</label>)}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Sucursal"><Select name="branch_id">{eBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
                <Field label="Entrada"><Input type="time" name="start_time" required /></Field>
                <Field label="Salida" hint="Si es menor a la entrada, termina al día siguiente."><Input type="time" name="end_time" required /></Field>
                <Field label="Descanso (min)"><Input type="number" name="break_minutes" min={0} max={240} defaultValue={0} /></Field>
                <Field label="Vigente desde"><Input type="date" name="valid_from" defaultValue={today} /></Field>
                <Field label="Hasta (opcional)"><Input type="date" name="valid_to" /></Field>
              </div>
              <Submit>Agregar horario</Submit>
            </ActionForm>
          )}
        </Card>

        <Card title="Francos, vacaciones y licencias">
          {leaves.length === 0 ? <Empty>Sin novedades cargadas.</Empty> : (
            <ul className="divide-y divide-[var(--border)] text-sm">{leaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <span><Badge tone="violet">{LEAVES.find((x) => x[0] === l.type)?.[1]}</Badge> {fmtDate(l.sd + "T15:00:00Z", tz)}{l.ed !== l.sd ? ` al ${fmtDate(l.ed + "T15:00:00Z", tz)}` : ""} <span className="text-xs text-muted">{l.notes}</span></span>
                {manage && <InlineAction action={deleteLeave} fields={{ id: l.id }} label="Quitar" variant="danger" confirm="¿Eliminar esta novedad?" />}
              </li>
            ))}</ul>
          )}
          {manage && (
            <ActionForm action={addLeave} className="mt-4 grid grid-cols-2 gap-3 border-t border-app pt-4 sm:grid-cols-4" resetOnSuccess>
              <input type="hidden" name="employee_id" value={empId} />
              <Field label="Tipo"><Select name="type">{LEAVES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Desde"><Input type="date" name="start_date" required /></Field>
              <Field label="Hasta"><Input type="date" name="end_date" /></Field>
              <Field label="Nota"><Input name="notes" /></Field>
              <div className="col-span-full"><Submit>Registrar novedad</Submit></div>
            </ActionForm>
          )}
        </Card>

        <Card title="Turnos (última semana y próximas dos)" className="lg:col-span-2" padded={false}>
          {shifts.length === 0 ? <div className="p-5"><Empty>Sin turnos.</Empty></div> : (
            <TableWrap><table className="tbl"><thead><tr><th>Fecha</th><th>Horario</th><th>Sucursal</th><th>Origen</th><th>Estado</th><th /></tr></thead><tbody>
              {shifts.map((x) => (
                <tr key={x.id} className={x.status === "cancelled" ? "opacity-50" : ""}>
                  <td className="capitalize">{fmtDate(x.start_at, tz, { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td className="tabular-nums">{fmtTime(x.start_at, tz)}–{fmtTime(x.end_at, tz)}{x.break_minutes ? <span className="text-xs text-muted"> · desc. {x.break_minutes}′</span> : null}</td>
                  <td>{x.branch_name}</td>
                  <td className="text-xs">{x.template_id ? "Horario semanal" : "Turno puntual"}{x.notes ? <div className="text-muted">{x.notes}</div> : null}</td>
                  <td>{x.status === "cancelled" ? <Badge tone="red">Cancelado</Badge> : <Badge tone="green">Activo</Badge>}</td>
                  <td className="text-right">{manage && x.status === "active" && new Date(x.end_at) > new Date() && (
                    <InlineAction action={cancelShift} fields={{ id: x.id }} label="Cancelar" variant="danger"><input name="reason" placeholder="Motivo" required className="input !inline-block !w-32 !py-1 mr-1 text-xs" /></InlineAction>
                  )}</td>
                </tr>
              ))}
            </tbody></table></TableWrap>
          )}
          {manage && (
            <ActionForm action={addShift} className="grid grid-cols-2 gap-3 border-t border-app p-5 sm:grid-cols-6" resetOnSuccess>
              <input type="hidden" name="employee_id" value={empId} />
              <Field label="Fecha"><Input type="date" name="work_date" required /></Field>
              <Field label="Entrada"><Input type="time" name="start_time" required /></Field>
              <Field label="Salida"><Input type="time" name="end_time" required /></Field>
              <Field label="Descanso (min)"><Input type="number" name="break_minutes" defaultValue={0} min={0} max={240} /></Field>
              <Field label="Sucursal"><Select name="branch_id">{eBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
              <Field label="Nota"><Input name="notes" /></Field>
              <div className="col-span-full"><Submit>Agregar turno puntual</Submit></div>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
