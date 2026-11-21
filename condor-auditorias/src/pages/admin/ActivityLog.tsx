import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/format';
import { Card, Empty, Loading, PageHeader } from '../../components/ui';

interface Row { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, unknown> | null; created_at: string }

export default function ActivityLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<{ id: string; kind: string; file_name: string; created_at: string; generated_by: string }[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data }, { data: p }, { data: r }] = await Promise.all([
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('generated_reports').select('id, kind, file_name, created_at, generated_by').order('created_at', { ascending: false }).limit(100),
      ]);
      setRows((data as Row[]) ?? []);
      setNames(Object.fromEntries((p ?? []).map((x: { id: string; full_name: string; email: string }) => [x.id, x.full_name || x.email])));
      setReports((r as never) ?? []);
    })();
  }, []);
  if (!rows) return <Loading />;
  return (
    <div className="fade-in space-y-5">
      <PageHeader eyebrow="Administración" title="Registro de operaciones" subtitle="Trazabilidad de acciones relevantes: finalizaciones, correcciones, constancias, usuarios, sucursales y cuestionarios." />
      <Card title="Operaciones">
        {rows.length === 0 ? <Empty title="Sin operaciones registradas" /> : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="table-base min-w-[700px]">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</td><td className="text-sm">{r.actor_id ? names[r.actor_id] ?? '—' : 'Sistema'}</td><td className="text-sm font-medium">{r.action}</td><td className="text-sm">{r.entity}</td>
                  <td className="max-w-[340px] truncate text-xs text-cafe-500">{r.details ? JSON.stringify(r.details) : ''}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Informes generados">
        {reports.length === 0 ? <p className="text-sm text-cafe-500">Todavía no se generaron informes.</p> : (
          <ul className="divide-y divide-cafe-800/5 text-sm">{reports.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{r.file_name}</span><span className="text-xs text-cafe-500">{names[r.generated_by] ?? '—'} · {fmtDateTime(r.created_at)}</span></li>)}</ul>
        )}
      </Card>
    </div>
  );
}
