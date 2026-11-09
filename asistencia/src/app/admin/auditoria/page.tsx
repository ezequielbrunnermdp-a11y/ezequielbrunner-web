import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { Card, PageHeader, TableWrap, Input, Empty } from "@/components/ui";
import { sp, type SP } from "../data";

export const metadata = { title: "Auditoría" };

export default async function Auditoria({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor({ cap: "audit.view" });
  const s = await searchParams;
  const p: unknown[] = [];
  const conds: string[] = [];
  if (a.role !== "superadmin") {
    // Acciones realizadas por usuarios con alcance en las mismas empresas.
    p.push(a.scopes.map((x) => x.company_id));
    conds.push(`(l.actor_user_id in (select user_id from user_scopes where company_id = any($1)) or l.actor_user_id in (select user_id from employees where company_id = any($1)))`);
  }
  if (sp(s, "q")) conds.push(`(l.action ilike $${p.push(`%${sp(s, "q")}%`)} or l.entity ilike $${p.length} or u.full_name ilike $${p.length})`);
  const rows = await q(
    `select l.*, u.full_name from audit_log l left join users u on u.id = l.actor_user_id ${conds.length ? "where " + conds.join(" and ") : ""} order by l.id desc limit 300`, p);
  return (
    <>
      <PageHeader title="Auditoría" subtitle="Registro de solo inserción: no puede modificarse ni borrarse." />
      <form method="get" className="mb-4 flex max-w-md gap-2"><Input name="q" defaultValue={sp(s, "q")} placeholder="Filtrar por acción, entidad o usuario" /><button className="rounded-xl bg-brand-600 px-4 text-sm text-white">Buscar</button></form>
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty>Sin registros.</Empty></div> : (
          <TableWrap><table className="tbl"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap tabular-nums text-xs">{fmtDateTime(r.created_at)}</td>
                <td className="text-sm">{r.full_name ?? "Sistema / anónimo"}{r.ip && <div className="text-xs text-muted">{r.ip}</div>}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-xs">{r.entity}<div className="font-mono text-muted">{r.entity_id?.slice(0, 8)}</div></td>
                <td className="max-w-md"><details className="text-xs"><summary className="cursor-pointer text-muted">Ver cambios</summary>
                  <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg surface-2 p-2">{JSON.stringify({ antes: r.before, despues: r.after }, null, 1)}</pre></details></td>
              </tr>
            ))}
          </tbody></table></TableWrap>
        )}
      </Card>
    </>
  );
}
