import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Download, Loader2, FileBarChart, ShieldAlert } from 'lucide-react';
import { useSession } from '../lib/session';
import { listAudits, listStaff, type AuditFilters } from '../lib/api';
import { fmtDate, todayISO } from '../lib/format';
import type { Audit } from '../lib/types';
import { usePdf, auditPdfJob, type PdfJob } from '../components/PdfActions';
import { Card, ClassBadge, Empty, ErrorBox, Field, Input, Loading, PageHeader, ScorePill, Select, Tabs } from '../components/ui';

type DateMode = 'todas' | 'dia' | 'rango' | 'mes' | 'anio';

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

export default function Reports() {
  const { branches, isAdmin, isStaff } = useSession();
  const [staff, setStaff] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [mode, setMode] = useState<DateMode>('todas');
  const [day, setDay] = useState(todayISO());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [year, setYear] = useState(todayISO().slice(0, 4));
  const [auditorId, setAuditorId] = useState('');
  const [classification, setClassification] = useState('');
  const [status, setStatus] = useState(isStaff ? '' : 'finalizada');
  const [critical, setCritical] = useState(false);
  const [rows, setRows] = useState<Audit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'buscar' | 'generar'>('buscar');
  const pdf = usePdf();
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => { if (isAdmin) listStaff().then(setStaff); }, [isAdmin]);

  const range = useMemo(() => {
    if (mode === 'dia') return { from: day, to: day };
    if (mode === 'rango') return { from, to };
    if (mode === 'mes') return monthRange(month);
    if (mode === 'anio') return { from: `${year}-01-01`, to: `${year}-12-31` };
    return { from: '', to: '' };
  }, [mode, day, from, to, month, year]);

  const search = async () => {
    setLoading(true);
    const f: AuditFilters = { branchId: branchId || undefined, auditorId: auditorId || undefined, from: range.from || undefined, to: range.to || undefined, status: status || undefined, classification: classification || undefined, critical };
    setRows(await listAudits(f));
    setLoading(false);
  };
  useEffect(() => { search(); /* búsqueda inicial */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRow = async (a: Audit, m: 'ver' | 'descargar') => {
    setRowBusy(a.id + m);
    await pdf.run(auditPdfJob(a.id), m);
    setRowBusy(null);
  };

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Informes" title="Reportes de auditoría" subtitle="Busque auditorías y genere informes PDF individuales, por período, consolidados o de seguimiento." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'buscar', label: 'Buscar auditorías' }, { value: 'generar', label: 'Generar reportes' }]} />

      {tab === 'buscar' && (
        <>
          <Card className="mb-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Sucursal">
                <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Todas</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.active ? '' : ' (inactiva)'}</option>)}
                </Select>
              </Field>
              <Field label="Fecha">
                <Select value={mode} onChange={(e) => setMode(e.target.value as DateMode)}>
                  <option value="todas">Todas las fechas</option><option value="dia">Día exacto</option><option value="rango">Desde / hasta</option><option value="mes">Mes</option><option value="anio">Año</option>
                </Select>
              </Field>
              {mode === 'dia' && <Field label="Día"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>}
              {mode === 'rango' && <><Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>}
              {mode === 'mes' && <Field label="Mes"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
              {mode === 'anio' && <Field label="Año"><Input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(e.target.value)} /></Field>}
              {isAdmin && (
                <Field label="Auditor">
                  <Select value={auditorId} onChange={(e) => setAuditorId(e.target.value)}><option value="">Todos</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</Select>
                </Field>
              )}
              <Field label="Clasificación">
                <Select value={classification} onChange={(e) => setClassification(e.target.value)}>
                  <option value="">Todas</option><option>EXCELENTE</option><option>SATISFACTORIA</option><option>EN OBSERVACIÓN</option><option>DEFICIENTE</option>
                </Select>
              </Field>
              {isStaff && (
                <Field label="Estado">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="finalizada">Finalizada</option><option value="borrador">Borrador</option></Select>
                </Field>
              )}
              <label className="flex items-end gap-2 pb-3 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand-accent))]" checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Solo con incumplimientos críticos
              </label>
            </div>
            <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={search} disabled={loading}><Search className="h-4 w-4" /> Buscar</button></div>
          </Card>

          {pdf.err && <div className="mb-4"><ErrorBox>{pdf.err}</ErrorBox></div>}
          {loading || !rows ? <Loading /> : rows.length === 0 ? (
            <Empty title="No existen auditorías registradas para estos filtros">Modifique la sucursal o el período. No se generan resultados para períodos sin datos.</Empty>
          ) : (
            <Card>
              <div className="mb-2 text-sm text-cafe-500">{rows.length} auditoría(s)</div>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="table-base min-w-[720px]">
                  <thead><tr><th>Sucursal</th><th>Fecha</th><th>Auditor</th><th className="text-right">Puntaje</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.branches?.name}{a.has_critical && <ShieldAlert className="ml-1.5 inline h-4 w-4 text-[#a33b2b]" />}</td>
                        <td>{fmtDate(a.visit_date)}<div className="text-xs text-cafe-400">{a.report_number ?? '—'}</div></td>
                        <td className="text-sm">{a.auditor_name}</td>
                        <td className="text-right"><ScorePill score={a.final_score} classification={a.classification} size="sm" /></td>
                        <td>{a.status === 'borrador' ? <span className="chip bg-[#b07a1e]/10 text-[#8a5e12]">Borrador</span> : <ClassBadge classification={a.classification} />}</td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <Link to={`/auditorias/${a.id}`} className="btn-outline px-3 py-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> Ver</Link>
                            <button className="btn-primary px-3 py-1.5 text-xs" disabled={!!rowBusy} onClick={() => runRow(a, 'descargar')}>
                              {rowBusy === a.id + 'descargar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {pdf.modal}
        </>
      )}

      {tab === 'generar' && <Generators />}
    </div>
  );
}

function Generators() {
  const { branches, profile } = useSession();
  const pdf = usePdf();
  const isFr = profile!.role === 'franquiciado';
  const [mBranch, setMBranch] = useState(isFr ? branches[0]?.id ?? '' : '');
  const [mMonth, setMMonth] = useState(todayISO().slice(0, 7));
  const [pBranch, setPBranch] = useState(isFr ? branches[0]?.id ?? '' : '');
  const [pFrom, setPFrom] = useState(`${todayISO().slice(0, 4)}-01-01`);
  const [pTo, setPTo] = useState(todayISO());
  const [cMonth, setCMonth] = useState(todayISO().slice(0, 7));
  const [cMode, setCMode] = useState<'mes' | 'rango'>('mes');
  const [cFrom, setCFrom] = useState(`${todayISO().slice(0, 4)}-01-01`);
  const [cTo, setCTo] = useState(todayISO());
  const [ncBranch, setNcBranch] = useState('');
  const [eBranch, setEBranch] = useState('');
  const [eFrom, setEFrom] = useState(`${Number(todayISO().slice(0, 4)) - 1}-${todayISO().slice(5, 7)}-01`);
  const [eTo, setETo] = useState(todayISO());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const gen = async (key: string, job: PdfJob, m: 'ver' | 'descargar') => { setBusyKey(key + m); await pdf.run(job, m); setBusyKey(null); };
  const consolidated = (o: { kind: 'mensual' | 'periodo' | 'consolidado' | 'evolucion'; from: string; to: string; branchId?: string }): PdfJob => async () => (await import('../pdf/generate')).renderConsolidatedPdf(o);
  const ncJob = (b: string): PdfJob => async () => (await import('../pdf/generate')).renderNcPdf(b || null);

  const Buttons = ({ k, job, disabled }: { k: string; job: PdfJob; disabled?: boolean }) => (
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="btn-outline" disabled={disabled || !!busyKey} onClick={() => gen(k, job, 'ver')}>{busyKey === k + 'ver' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Previsualizar</button>
      <button className="btn-primary" disabled={disabled || !!busyKey} onClick={() => gen(k, job, 'descargar')}>{busyKey === k + 'descargar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Descargar PDF</button>
    </div>
  );
  const BranchSelect = ({ value, onChange, allowAll = true }: { value: string; onChange: (v: string) => void; allowAll?: boolean }) => (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="">Todas las sucursales</option>}
      {!allowAll && <option value="">Seleccionar…</option>}
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {pdf.err && <div className="lg:col-span-2"><ErrorBox>{pdf.err}</ErrorBox></div>}
      <Card title={<span className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-brand-accent" /> 1. Reporte individual</span>}>
        <p className="text-sm text-cafe-500">Desde la pestaña «Buscar auditorías», cada resultado permite ver y descargar su informe individual completo con portada, resumen ejecutivo, resultados, detalle, plan de acciones y cierre.</p>
      </Card>
      <Card title="2. Reporte mensual por franquicia">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sucursal"><BranchSelect value={mBranch} onChange={setMBranch} allowAll={false} /></Field>
          <Field label="Mes"><Input type="month" value={mMonth} onChange={(e) => setMMonth(e.target.value)} /></Field>
        </div>
        <Buttons k="mensual" disabled={!mBranch || !mMonth} job={consolidated({ kind: 'mensual', ...monthRange(mMonth), branchId: mBranch })} />
      </Card>
      <Card title="3. Reporte de período personalizado">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sucursal"><BranchSelect value={pBranch} onChange={setPBranch} /></Field>
          <Field label="Desde"><Input type="date" value={pFrom} onChange={(e) => setPFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={pTo} onChange={(e) => setPTo(e.target.value)} /></Field>
        </div>
        <Buttons k="periodo" disabled={!pFrom || !pTo || pFrom > pTo} job={consolidated({ kind: 'periodo', from: pFrom, to: pTo, branchId: pBranch || undefined })} />
      </Card>
      {!isFr && (
        <Card title="4. Informe general consolidado (todas las sucursales)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Período"><Select value={cMode} onChange={(e) => setCMode(e.target.value as 'mes' | 'rango')}><option value="mes">Mes</option><option value="rango">Período</option></Select></Field>
            {cMode === 'mes' ? <Field label="Mes"><Input type="month" value={cMonth} onChange={(e) => setCMonth(e.target.value)} /></Field> : <>
              <Field label="Desde"><Input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></Field>
              <Field label="Hasta"><Input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} /></Field>
            </>}
          </div>
          <p className="mt-2 text-xs text-cafe-500">Compara las sucursales en un único documento indicando cuántas auditorías tiene cada una y el período utilizado.</p>
          <Buttons k="consolidado" job={consolidated({ kind: 'consolidado', ...(cMode === 'mes' ? monthRange(cMonth) : { from: cFrom, to: cTo }) })} />
        </Card>
      )}
      <Card title="5. Reporte de incumplimientos pendientes">
        <Field label="Sucursal"><BranchSelect value={ncBranch} onChange={setNcBranch} /></Field>
        <Buttons k="nc" job={ncJob(ncBranch)} />
      </Card>
      <Card title="6. Reporte comparativo de evolución">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sucursal"><BranchSelect value={eBranch} onChange={setEBranch} /></Field>
          <Field label="Desde"><Input type="date" value={eFrom} onChange={(e) => setEFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={eTo} onChange={(e) => setETo(e.target.value)} /></Field>
        </div>
        <Buttons k="evolucion" disabled={!eFrom || !eTo || eFrom > eTo} job={consolidated({ kind: 'evolucion', from: eFrom, to: eTo, branchId: eBranch || undefined })} />
      </Card>
      {pdf.modal}
    </div>
  );
}
