import { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Notice, PageHeader, Stat } from '../../components/ui';
import { CodeConfirm } from '../../components/CodeConfirm';

const TABLES: { table: string; label: string }[] = [
  { table: 'audits', label: 'Auditorías' },
  { table: 'nonconformities', label: 'Incumplimientos' },
  { table: 'alerts', label: 'Alertas' },
  { table: 'attachments', label: 'Fotos y archivos' },
  { table: 'commercial_indicators', label: 'Indicadores comerciales' },
  { table: 'generated_reports', label: 'Informes generados' },
];

export default function DataReset() {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    const out: Record<string, number | null> = {};
    await Promise.all(TABLES.map(async (t) => {
      const { count } = await supabase.from(t.table).select('*', { count: 'exact', head: true });
      out[t.table] = count ?? 0;
    }));
    setCounts(out);
  };
  useEffect(() => { load(); }, []);

  const reset = async (code: string) => {
    const { data, error } = await supabase.rpc('admin_reset_data', { p_code: code });
    if (error) throw error;
    const r = data as { audits: number; nonconformities: number; deleted_files: string[] };
    setOpen(false);
    setDone(`Datos reiniciados: se borraron ${r.audits} auditoría(s), ${r.nonconformities} incumplimiento(s) y ${r.deleted_files.length} archivo(s). La numeración de informes vuelve a empezar.`);
    load();
  };

  return (
    <div className="fade-in space-y-5">
      <PageHeader eyebrow="Administración" title="Reiniciar datos"
        subtitle="Para empezar de cero después de las pruebas. Pide la clave de administración." />
      {done && <Notice tone="ok"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {done}</span></Notice>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TABLES.map((t) => <Stat key={t.table} label={t.label} value={counts[t.table] ?? '…'} />)}
      </div>
      <Card title="Qué hace">
        <div className="grid gap-5 text-sm md:grid-cols-2">
          <div>
            <div className="mb-2 font-semibold text-[#a33b2b]">Se borra</div>
            <ul className="list-disc space-y-1 pl-5 text-cafe-700">
              <li>Todas las auditorías (borradores y finalizadas), con sus respuestas y versiones anteriores.</li>
              <li>Incumplimientos y su historial, alertas y notificaciones.</li>
              <li>Fotos y evidencias.</li>
              <li>Indicadores comerciales, informes generados y el registro de operaciones.</li>
              <li>La numeración de informes vuelve a EC-…-00001.</li>
            </ul>
          </div>
          <div>
            <div className="mb-2 font-semibold text-[#2f6b4f]">Se conserva</div>
            <ul className="list-disc space-y-1 pl-5 text-cafe-700">
              <li>Usuarios y contraseñas.</li>
              <li>Sucursales y sus fichas.</li>
              <li>Cuestionario y ponderaciones.</li>
              <li>Logotipo, colores y manual.</li>
            </ul>
          </div>
        </div>
        <button className="btn-danger mt-5" onClick={() => { setDone(null); setOpen(true); }}><RotateCcw className="h-4 w-4" /> Reiniciar todo</button>
        <p className="mt-3 text-xs text-cafe-500">Para borrar un solo registro, abrí la auditoría o el incumplimiento y usá «Eliminar».</p>
      </Card>
      <CodeConfirm open={open} onClose={() => setOpen(false)} title="Reiniciar todos los datos" confirmLabel="Reiniciar todo" onConfirm={reset}>
        <p>Se borrarán <strong>{counts.audits ?? 0} auditoría(s)</strong>, <strong>{counts.nonconformities ?? 0} incumplimiento(s)</strong> y <strong>{counts.attachments ?? 0} archivo(s)</strong>. Usuarios, sucursales y cuestionario se conservan.</p>
      </CodeConfirm>
    </div>
  );
}
