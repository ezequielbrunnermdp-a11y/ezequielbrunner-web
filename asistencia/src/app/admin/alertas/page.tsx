import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { scopeSql } from "@/lib/permissions";
import { ALERT_LABEL } from "@/lib/alerts";
import { fmtDateTime } from "@/lib/time";
import { Card, PageHeader, Badge, Empty } from "@/components/ui";
import { InlineAction } from "@/components/inline-action";
import { ackAlert } from "../actions";
import { sp, type SP } from "../data";

export const metadata = { title: "Alertas" };

export default async function Alertas({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "alerts.ack" });
  const s = await searchParams;
  const showAll = sp(s, "ver") === "todas";
  const p: unknown[] = [];
  const rows = await q(
    `select al.*, b.name as branch_name, u.full_name as ack_name from alerts al left join branches b on b.id = al.branch_id left join users u on u.id = al.acknowledged_by
     where ${scopeSql(a, "al.company_id", "al.branch_id", p)} ${showAll ? "" : "and al.acknowledged_at is null"}
     order by al.created_at desc limit 300`, p);
  return (
    <>
      <PageHeader title="Alertas" subtitle="Generadas automáticamente por el servidor cada minuto, sin depender de que el panel esté abierto."
        actions={<a href={showAll ? "/admin/alertas" : "/admin/alertas?ver=todas"} className="surface rounded-xl px-3 py-1.5 text-xs font-medium">{showAll ? "Sólo pendientes" : "Ver revisadas también"}</a>} />
      <Card>
        {rows.length === 0 ? <Empty>No hay alertas {showAll ? "" : "pendientes"}.</Empty> : (
          <ul className="divide-y divide-[var(--border)]">{rows.map((al) => (
            <li key={al.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={al.severity === "critical" ? "red" : al.severity === "warning" ? "amber" : "blue"}>{ALERT_LABEL[al.type] ?? al.type}</Badge>
                  <span className="text-xs text-muted">{fmtDateTime(al.created_at)}{al.branch_name ? ` · ${al.branch_name}` : ""}</span>
                </div>
                <p className="mt-1">{al.message}</p>
                {al.ack_name && <p className="text-xs text-muted">Revisada por {al.ack_name} · {fmtDateTime(al.acknowledged_at)}</p>}
              </div>
              <div className="flex gap-2">
                {al.employee_id && <a href={`/admin/empleados/${al.employee_id}`} className="surface rounded-lg px-2.5 py-1.5 text-xs">Ver empleado</a>}
                {!al.acknowledged_at && <InlineAction action={ackAlert} fields={{ id: al.id }} label="Marcar revisada" />}
              </div>
            </li>
          ))}</ul>
        )}
      </Card>
    </>
  );
}
