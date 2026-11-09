import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { can, scopeSql } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/time";
import { Card, PageHeader, Badge, Field, Input, Select, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { requestCorrectionAction, reviewCorrectionAction } from "../actions";
import { filterOptions, sp, isUuid, type SP } from "../data";

export const metadata = { title: "Correcciones" };

export default async function Correcciones({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "corrections.request" });
  const s = await searchParams;
  const empId = isUuid(sp(s, "employee")) ? sp(s, "employee") : undefined;
  const p: unknown[] = [];
  const rows = await q(
    `select cr.*, e.first_name || ' ' || e.last_name as name, b.name as branch_name, b.timezone, ru.full_name as requester, rv.full_name as reviewer,
            op.type as orig_type, op.occurred_at as orig_time, op.source as orig_source
     from correction_requests cr join employees e on e.id = cr.employee_id join branches b on b.id = cr.branch_id
     join users ru on ru.id = cr.requested_by left join users rv on rv.id = cr.reviewed_by left join punches op on op.id = cr.punch_id
     where ${scopeSql(a, "cr.company_id", "cr.branch_id", p)} order by (cr.status = 'pending') desc, cr.requested_at desc limit 200`, p);
  const options = await filterOptions(a);
  const recent = empId ? await q(
    `select p.id, p.type, p.occurred_at, p.source from effective_punches p where p.employee_id = $1 order by p.occurred_at desc limit 20`, [empId]) : [];
  const canReview = can(a, "corrections.review");
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");
  const Desc = ({ r }: { r: any }) => (
    <div className="text-sm">
      <div className="font-medium">{r.name} <span className="text-xs font-normal text-muted">· {r.branch_name}</span></div>
      {r.kind === "add_punch"
        ? <div>Agregar <b>{r.proposed_type === "in" ? "entrada" : "salida"}</b> a las <b>{fmtDateTime(r.proposed_time, r.timezone)}</b></div>
        : <div>Anular {r.orig_type === "in" ? "entrada" : "salida"} del {fmtDateTime(r.orig_time, r.timezone)} ({r.orig_source})</div>}
      <div className="mt-1 text-muted">“{r.reason}”</div>
      <div className="mt-1 text-xs text-muted">Solicitó {r.requester} · {fmtDateTime(r.requested_at)}{r.reviewer ? ` · Revisó ${r.reviewer} ${fmtDateTime(r.reviewed_at)}` : ""}{r.review_note ? ` · “${r.review_note}”` : ""}</div>
    </div>
  );
  return (
    <>
      <PageHeader title="Correcciones" subtitle="Toda corrección conserva la fichada original, requiere motivo y queda en la auditoría. Nunca se crea una fichada con ubicación ficticia." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title={<span className="flex items-center gap-2">Pendientes de revisión <Badge tone="amber">{pending.length}</Badge></span>}>
            {pending.length === 0 ? <Empty>No hay solicitudes pendientes.</Empty> : (
              <ul className="divide-y divide-[var(--border)]">{pending.map((r) => (
                <li key={r.id} className="py-3">
                  <Desc r={r} />
                  {canReview ? (
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      <ActionForm action={reviewCorrectionAction} className="flex flex-1 flex-wrap gap-2">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" />
                        <input name="note" placeholder="Nota (opcional)" className="input !w-auto flex-1 !py-1.5 text-sm" />
                        <Submit className="!bg-emerald-600 !px-3 !py-1.5 text-xs">Aprobar</Submit>
                      </ActionForm>
                      <ActionForm action={reviewCorrectionAction} confirm="¿Rechazar esta solicitud?">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" />
                        <Submit variant="danger" className="!px-3 !py-1.5 text-xs">Rechazar</Submit>
                      </ActionForm>
                    </div>
                  ) : <Badge tone="amber" className="mt-2">Esperando aprobación de gerencia</Badge>}
                </li>
              ))}</ul>
            )}
          </Card>
          <Card title="Historial">
            {done.length === 0 ? <Empty>Sin correcciones resueltas.</Empty> : (
              <ul className="divide-y divide-[var(--border)]">{done.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3"><Desc r={r} /><Badge tone={r.status === "approved" ? "green" : "red"}>{r.status === "approved" ? "Aprobada" : "Rechazada"}</Badge></li>
              ))}</ul>
            )}
          </Card>
        </div>
        <Card title="Nueva solicitud" className="lg:col-span-2">
          <form method="get" className="mb-4 flex gap-2">
            <Select name="employee" defaultValue={empId ?? ""} className="flex-1"><option value="" disabled>Elegir empleado…</option>{options.employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.file_number})</option>)}</Select>
            <button className="rounded-xl surface px-3 text-sm">Elegir</button>
          </form>
          {empId && (
            <div className="space-y-6">
              <ActionForm action={requestCorrectionAction} className="space-y-3" resetOnSuccess>
                <div className="text-sm font-medium">Agregar fichada faltante</div>
                <input type="hidden" name="employee_id" value={empId} /><input type="hidden" name="kind" value="add_punch" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo"><Select name="type"><option value="in">Entrada</option><option value="out">Salida</option></Select></Field>
                  <Field label="Fecha y hora"><Input type="datetime-local" name="datetime" required /></Field>
                </div>
                <Field label="Sucursal"><Select name="branch_id">{options.branches.filter((b) => b.company_id === options.employees.find((e) => e.id === empId)?.company_id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
                <Field label="Motivo (obligatorio)"><Input name="reason" minLength={10} required placeholder="Ej.: sin batería, verificado con el encargado" /></Field>
                <Submit>Enviar solicitud</Submit>
              </ActionForm>
              <ActionForm action={requestCorrectionAction} className="space-y-3 border-t border-app pt-4" resetOnSuccess>
                <div className="text-sm font-medium">Anular una fichada errónea</div>
                <input type="hidden" name="employee_id" value={empId} /><input type="hidden" name="kind" value="void_punch" />
                <Field label="Fichada"><Select name="punch_id">{recent.map((p) => <option key={p.id} value={p.id}>{p.type === "in" ? "Entrada" : "Salida"} · {fmtDateTime(p.occurred_at)} · {p.source}</option>)}</Select></Field>
                <Field label="Motivo (obligatorio)"><Input name="reason" minLength={10} required /></Field>
                <Submit variant="secondary">Solicitar anulación</Submit>
              </ActionForm>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
