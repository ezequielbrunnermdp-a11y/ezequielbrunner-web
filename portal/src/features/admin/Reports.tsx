import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileDown, BarChart3 } from 'lucide-react';
import { rpc } from '@/lib/supabase';
import { addDays, durationLabel, fmtDate, fmtTime, localDate, mondayOf } from '@/lib/format';
import { exportPdf, exportXlsx, type Column } from '@/lib/export';
import { PUNCH_FLAG } from '@/lib/types';
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingList, Notice, PageHeader, Segmented, Select, Stat } from '@/components/ui';
import { useBranchesWith } from './scope';

interface Row { user_id: string; employee: string; employee_code: string | null; branch_name: string; legal_entity: string; day: string; shift_starts: string | null; shift_ends: string | null; actual_in: string | null; actual_out: string | null; worked_minutes: number | null; status: string; flags: string[] | null }
type Period = 'day' | 'week' | 'fortnight' | 'month' | 'custom';

function range(p: Period, base: string): [string, string] {
  if (p === 'day') return [base, base];
  if (p === 'week') { const m = mondayOf(base); return [m, addDays(m, 6)]; }
  if (p === 'fortnight') { const d = Number(base.slice(8)); const ym = base.slice(0, 8); const last = addDays(addDays(`${base.slice(0, 7)}-28`, 7).slice(0, 7) + '-01', -1); return d <= 15 ? [`${ym}01`, `${ym}15`] : [`${ym}16`, last]; }
  const last = addDays(addDays(`${base.slice(0, 7)}-28`, 7).slice(0, 7) + '-01', -1);
  return [`${base.slice(0, 7)}-01`, last];
}

export default function Reports() {
  const branches = useBranchesWith('reports.view');
  const [period, setPeriod] = useState<Period>('week');
  const [base, setBase] = useState(localDate());
  const [cFrom, setCFrom] = useState(localDate());
  const [cTo, setCTo] = useState(localDate());
  const [branch, setBranch] = useState('');
  const [from, to] = period === 'custom' ? [cFrom, cTo] : range(period, base);
  const q = useQuery({ queryKey: ['report', from, to, branch], queryFn: () => rpc<Row[]>('attendance_report', { p_from: from, p_to: to, p_branch: branch || null }) });
  const rows = q.data ?? [];
  const summary = useMemo(() => {
    const m = new Map<string, { employee: string; code: string; branch: string; days: number; minutes: number; late: number; early: number; review: number }>();
    for (const r of rows) {
      const k = `${r.user_id}|${r.branch_name}`;
      const s = m.get(k) ?? { employee: r.employee, code: r.employee_code ?? '', branch: r.branch_name, days: 0, minutes: 0, late: 0, early: 0, review: 0 };
      s.days++; s.minutes += r.worked_minutes ?? 0;
      if (r.flags?.includes('late')) s.late++;
      if (r.flags?.includes('early_leave')) s.early++;
      if (r.status !== 'closed') s.review++;
      m.set(k, s);
    }
    return [...m.values()].sort((a, b) => a.employee.localeCompare(b.employee));
  }, [rows]);
  const detailCols: Column<Row>[] = [
    { header: 'Fecha', value: (r) => r.day, width: 12 }, { header: 'Empleado', value: (r) => r.employee, width: 26 }, { header: 'Legajo', value: (r) => r.employee_code, width: 10 },
    { header: 'Sucursal', value: (r) => r.branch_name, width: 20 }, { header: 'Razón social', value: (r) => r.legal_entity, width: 24 },
    { header: 'Turno', value: (r) => (r.shift_starts ? `${fmtTime(r.shift_starts)}-${fmtTime(r.shift_ends!)}` : 'Sin turno'), width: 13 },
    { header: 'Ingreso', value: (r) => (r.actual_in ? fmtTime(r.actual_in) : ''), width: 9 }, { header: 'Salida', value: (r) => (r.actual_out ? `${fmtTime(r.actual_out)}${localDate(r.actual_out) !== r.day ? ' (+1)' : ''}` : ''), width: 11 },
    { header: 'Horas', value: (r) => (r.worked_minutes != null ? +(r.worked_minutes / 60).toFixed(2) : null), width: 8 },
    { header: 'Estado', value: (r) => ({ closed: 'Cerrada', open: 'Abierta', needs_review: 'A revisar' } as Record<string, string>)[r.status] ?? r.status, width: 11 },
    { header: 'Observaciones automáticas', value: (r) => (r.flags ?? []).map((f) => PUNCH_FLAG[f] ?? f).join(', '), width: 34 },
  ];
  type S = (typeof summary)[number];
  const sumCols: Column<S>[] = [
    { header: 'Empleado', value: (s) => s.employee, width: 26 }, { header: 'Legajo', value: (s) => s.code, width: 10 }, { header: 'Sucursal', value: (s) => s.branch, width: 20 },
    { header: 'Jornadas', value: (s) => s.days, width: 10 }, { header: 'Horas', value: (s) => +(s.minutes / 60).toFixed(2), width: 10 },
    { header: 'Llegadas tarde', value: (s) => s.late, width: 14 }, { header: 'Salidas anticipadas', value: (s) => s.early, width: 16 }, { header: 'A revisar', value: (s) => s.review, width: 10 },
  ];
  const label = `Período ${fmtDate(from + 'T12:00:00')} al ${fmtDate(to + 'T12:00:00')}${branch ? ` · ${branches.data.find((b) => b.id === branch)?.name}` : ''}`;
  const note = 'Las observaciones son automáticas y requieren revisión humana; no constituyen sanciones. Horario del servidor, zona America/Argentina/Buenos_Aires.';
  const totalMin = rows.reduce((a, r) => a + (r.worked_minutes ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Reportes de asistencia" subtitle="Exportación en Excel y PDF con historial auditable"
        actions={<>
          <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} disabled={!rows.length} onClick={() => void exportXlsx(`asistencia_${from}_${to}`, [
            { name: 'Resumen', title: 'Resumen de asistencia', subtitle: `${label}. ${note}`, columns: sumCols as Column<unknown>[], rows: summary },
            { name: 'Detalle', title: 'Detalle de jornadas', subtitle: label, columns: detailCols as Column<unknown>[], rows },
          ])}>Excel</Button>
          <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} disabled={!rows.length} onClick={() => void exportPdf(`asistencia_${from}_${to}`, 'Reporte de asistencia', label, detailCols, rows, note)}>PDF</Button>
        </>} />
      <Segmented value={period} onChange={setPeriod} options={[{ value: 'day', label: 'Diario' }, { value: 'week', label: 'Semanal' }, { value: 'fortnight', label: 'Quincenal' }, { value: 'month', label: 'Mensual' }, { value: 'custom', label: 'Personalizado' }]} />
      <div className="grid gap-3 sm:grid-cols-3">
        {period === 'custom' ? <><Field label="Desde"><Input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></Field><Field label="Hasta"><Input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} /></Field></>
          : <Field label="Fecha de referencia"><Input type="date" value={base} onChange={(e) => setBase(e.target.value)} /></Field>}
        <Field label="Sucursal"><Select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">Todas las autorizadas</option>{branches.data.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
      </div>
      <p className="text-sm text-ink-2">{label}</p>
      {q.isLoading ? <LoadingList /> : q.isError ? <ErrorState error={q.error} /> : !rows.length ? <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Sin jornadas en el período" compact /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Jornadas" value={rows.length} /><Stat label="Horas registradas" value={durationLabel(totalMin)} />
            <Stat label="Llegadas tarde" value={rows.filter((r) => r.flags?.includes('late')).length} tone="warn" /><Stat label="A revisar" value={rows.filter((r) => r.status !== 'closed').length} />
          </div>
          <Card className="overflow-hidden"><div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-2/60 text-left text-xs text-ink-3"><tr>{sumCols.map((c) => <th key={c.header} className="px-3 py-2.5 font-medium">{c.header}</th>)}</tr></thead>
              <tbody className="divide-y divide-line/70">{summary.map((s) => <tr key={s.employee + s.branch}>{sumCols.map((c) => <td key={c.header} className="px-3 py-2.5 tabular">{c.value(s)}</td>)}</tr>)}</tbody>
            </table>
          </div></Card>
          <Notice tone="info">{note} Los registros digitales no sustituyen automáticamente los requisitos legales de control horario: validar con asesoría laboral.</Notice>
        </>
      )}
    </div>
  );
}
