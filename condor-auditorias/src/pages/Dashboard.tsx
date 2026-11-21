import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardPlus, Store, Trophy, TrendingDown, ShieldAlert, ListChecks, Clock, CheckCircle2, PlayCircle, CalendarClock } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { listAudits, listNonconformities, listStaff } from '../lib/api';
import { auditsWithLocalChanges } from '../lib/offline';
import { fmtDate, fmtScore, scoreColor, todayISO, TONE_HEX, monthLabel } from '../lib/format';
import type { AlertRow, Audit, Nonconformity, ScoreResult } from '../lib/types';
import { Card, ClassBadge, Empty, Field, Input, Loading, NcStatusBadge, PageHeader, ScorePill, Select, Stat, isOverdue } from '../components/ui';

const SERIES = ['#2e2016', '#b08d3e', '#5a7a3a', '#3d6a8a', '#a33b2b', '#7a5c42', '#6b4f8a', '#2f6b4f', '#c0582b'];

function monthStart(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }

export default function Dashboard() {
  const { profile, branches, isAdmin } = useSession();
  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [ncs, setNcs] = useState<Nonconformity[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [staff, setStaff] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [local, setLocal] = useState<string[]>([]);
  const [f, setF] = useState({ branchId: '', auditorId: '', from: '', to: '', status: 'finalizada', month: '', year: '' });

  useEffect(() => {
    (async () => {
      await supabase.rpc('refresh_overdue_alerts');
      const [a, n, al] = await Promise.all([
        listAudits({}, 2000),
        listNonconformities({}),
        supabase.from('alerts').select('*, branches(name)').is('resolved_at', null).order('created_at', { ascending: false }).limit(50),
      ]);
      setAudits(a);
      setNcs(n);
      setAlerts((al.data as AlertRow[]) ?? []);
      setLocal(await auditsWithLocalChanges());
    })();
    if (isAdmin) listStaff().then(setStaff);
  }, [isAdmin]);

  // Período efectivo según filtros (mes / año / desde-hasta)
  const period = useMemo(() => {
    if (f.month) { const [y, m] = f.month.split('-').map(Number); return { from: `${f.month}-01`, to: new Date(y, m, 0).toISOString().slice(0, 10) }; }
    if (f.year) return { from: `${f.year}-01-01`, to: `${f.year}-12-31` };
    return { from: f.from, to: f.to };
  }, [f]);

  const filtered = useMemo(() => (audits ?? []).filter((a) =>
    (!f.branchId || a.branch_id === f.branchId) && (!f.auditorId || a.auditor_id === f.auditorId) &&
    (!period.from || a.visit_date >= period.from) && (!period.to || a.visit_date <= period.to) &&
    (!f.status || a.status === f.status)), [audits, f, period]);

  if (!audits) return <Loading />;
  if (profile!.role === 'franquiciado') return <FranchiseeHome audits={audits} ncs={ncs} alerts={alerts} />;

  const finals = filtered.filter((a) => a.status === 'finalizada' && a.final_score != null);
  const activeBranches = branches.filter((b) => b.active && (!f.branchId || b.id === f.branchId));
  const thisMonth = monthStart();
  const monthAudits = (audits ?? []).filter((a) => a.status === 'finalizada' && a.visit_date >= thisMonth && (!f.branchId || a.branch_id === f.branchId));
  const drafts = (audits ?? []).filter((a) => a.status === 'borrador' && (!f.branchId || a.branch_id === f.branchId));
  const notAuditedMonth = activeBranches.filter((b) => !monthAudits.some((a) => a.branch_id === b.id));
  const chainAvg = finals.length ? finals.reduce((s, a) => s + Number(a.final_score), 0) / finals.length : null;

  const byBranch = activeBranches.map((b) => {
    const xs = finals.filter((a) => a.branch_id === b.id);
    return { id: b.id, name: b.name, n: xs.length, avg: xs.length ? xs.reduce((s, a) => s + Number(a.final_score), 0) / xs.length : null, last: xs[0] ?? null };
  });
  const ranked = byBranch.filter((b) => b.avg != null).sort((a, b) => b.avg! - a.avg!);
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const scopeNcs = ncs.filter((n) => !f.branchId || n.branch_id === f.branchId);
  const open = scopeNcs.filter((n) => n.status !== 'cerrado');
  const critOpen = open.filter((n) => n.severity === 'critica');
  const overdue = open.filter((n) => isOverdue(n.due_date, n.status));
  const resolvedPct = scopeNcs.length ? (scopeNcs.filter((n) => n.status === 'cerrado').length / scopeNcs.length) * 100 : null;
  const scopeAlerts = alerts.filter((a) => !f.branchId || a.branch_id === f.branchId);

  // Evolución mensual (promedio cadena + por sucursal)
  const months = [...new Set(finals.map((a) => a.visit_date.slice(0, 7)))].sort().slice(-12);
  const evolution = months.map((m) => {
    const row: Record<string, number | string | null> = { mes: monthLabel(m).replace(' de ', ' ') };
    const xs = finals.filter((a) => a.visit_date.startsWith(m));
    row['Cadena'] = xs.length ? +(xs.reduce((s, a) => s + Number(a.final_score), 0) / xs.length).toFixed(2) : null;
    activeBranches.forEach((b) => {
      const ys = xs.filter((a) => a.branch_id === b.id);
      row[b.name] = ys.length ? +(ys.reduce((s, a) => s + Number(a.final_score), 0) / ys.length).toFixed(2) : null;
    });
    return row;
  });

  const dist = [
    { name: 'Excelente', key: 'EXCELENTE', color: TONE_HEX.excelente },
    { name: 'Satisfactoria', key: 'SATISFACTORIA', color: TONE_HEX.satisfactoria },
    { name: 'En observación', key: 'EN OBSERVACIÓN', color: TONE_HEX.observacion },
    { name: 'Deficiente', key: 'DEFICIENTE', color: TONE_HEX.deficiente },
  ].map((d) => ({ ...d, value: finals.filter((a) => a.classification === d.key).length }));

  const catAgg = new Map<string, { name: string; vals: number[]; pos: number }>();
  finals.forEach((a) => (a.category_results as ScoreResult | null)?.categories.forEach((c, i) => {
    const e = catAgg.get(c.code) ?? { name: c.name, vals: [], pos: i };
    if (c.pct != null) e.vals.push(Number(c.pct));
    catAgg.set(c.code, e);
  }));
  const cats = [...catAgg.values()].sort((a, b) => a.pos - b.pos).map((c) => ({ name: c.name, short: c.name.length > 16 ? c.name.slice(0, 15) + '…' : c.name, pct: c.vals.length ? +(c.vals.reduce((s, v) => s + v, 0) / c.vals.length).toFixed(1) : null }));

  const years = [...new Set((audits ?? []).map((a) => a.visit_date.slice(0, 4)))].sort().reverse();

  return (
    <div className="fade-in">
      <PageHeader eyebrow={isAdmin ? 'Panel ejecutivo' : 'Panel del auditor'} title={`Hola, ${profile!.full_name?.split(' ')[0] || 'bienvenido'}`}
        subtitle="Indicadores calculados con los datos registrados en la plataforma."
        actions={<Link to="/auditorias/nueva" className="btn-primary py-3"><ClipboardPlus className="h-4 w-4" /> NUEVA AUDITORÍA</Link>} />

      {(drafts.filter((d) => d.auditor_id === profile!.id).length > 0 || local.length > 0) && (
        <Card className="mb-5" title="Borradores en curso">
          <div className="divide-y divide-cafe-800/5">
            {drafts.filter((d) => d.auditor_id === profile!.id || local.includes(d.id)).map((d) => (
              <Link key={d.id} to={`/auditorias/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span><strong>{d.branches?.name}</strong> · visita {fmtDate(d.visit_date)}{local.includes(d.id) && <span className="ml-2 chip bg-[#b07a1e]/10 text-[#8a5e12]">Cambios sin sincronizar</span>}</span>
                <span className="flex items-center gap-1 font-semibold text-brand-accent"><PlayCircle className="h-4 w-4" /> Continuar</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Field label="Sucursal"><Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">Todas</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          {isAdmin && <Field label="Auditor"><Select value={f.auditorId} onChange={(e) => setF({ ...f, auditorId: e.target.value })}><option value="">Todos</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</Select></Field>}
          <Field label="Mes"><Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value, year: '', from: '', to: '' })} /></Field>
          <Field label="Año"><Select value={f.year} onChange={(e) => setF({ ...f, year: e.target.value, month: '', from: '', to: '' })}><option value="">Todos</option>{years.map((y) => <option key={y}>{y}</option>)}</Select></Field>
          <Field label="Desde"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, month: '', year: '' })} /></Field>
          <Field label="Hasta"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value, month: '', year: '' })} /></Field>
          <Field label="Estado"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="finalizada">Finalizadas</option><option value="borrador">Borradores</option><option value="">Todas</option></Select></Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Franquicias activas" value={activeBranches.length} icon={<Store className="h-5 w-5" />} />
        <Stat label="Auditorías del mes" value={monthAudits.length} hint={new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })} icon={<CalendarClock className="h-5 w-5" />} />
        <Stat label="Auditorías pendientes" value={notAuditedMonth.length} hint={`${notAuditedMonth.length ? 'Sin auditar este mes' : 'Todas auditadas este mes'} · ${drafts.length} borrador(es)`} icon={<Clock className="h-5 w-5" />} />
        <Stat label="Promedio de la cadena" value={fmtScore(chainAvg)} tone={scoreColor(chainAvg)} hint={`${finals.length} auditoría(s) en el filtro`} />
        <Stat label="Mejor calificada" value={best ? best.name : '—'} hint={best ? `${fmtScore(best.avg)} pts · ${best.n} auditoría(s)` : 'Sin datos'} icon={<Trophy className="h-5 w-5" />} />
        <Stat label="Menor puntuación" value={worst ? worst.name : '—'} hint={worst ? `${fmtScore(worst.avg)} pts · ${worst.n} auditoría(s)` : 'Sin datos suficientes'} icon={<TrendingDown className="h-5 w-5" />} />
        <Stat label="Críticos abiertos" value={critOpen.length} tone={critOpen.length ? TONE_HEX.deficiente : undefined} icon={<ShieldAlert className="h-5 w-5" />} hint={`${scopeAlerts.length} alerta(s) activa(s)`} />
        <Stat label="Acciones pendientes" value={open.length} icon={<ListChecks className="h-5 w-5" />} hint={<><span className={overdue.length ? 'font-semibold text-[#a33b2b]' : ''}>{overdue.length} vencida(s)</span> · {resolvedPct == null ? '—' : `${fmtScore(resolvedPct, 0)} % resueltas`}</>} />
      </div>

      {scopeAlerts.filter((a) => a.severity === 'critica').length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#a33b2b]/25 bg-[#a33b2b]/5 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-[#7a2318]"><ShieldAlert className="h-5 w-5" /> Alertas críticas activas</div>
          <ul className="space-y-1.5 text-sm">
            {scopeAlerts.filter((a) => a.severity === 'critica').slice(0, 6).map((a) => (
              <li key={a.id}><Link to="/alertas" className="hover:underline"><strong>{a.branches?.name}</strong> · {a.title} <span className="text-xs text-cafe-500">({fmtDate(a.created_at)})</span></Link></li>
            ))}
          </ul>
        </div>
      )}

      {finals.length === 0 ? (
        <div className="mt-6"><Empty title="Todavía no hay auditorías finalizadas para estos filtros">Los gráficos se completan automáticamente con las auditorías registradas. No se muestran cifras estimadas.</Empty></div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card title="Evolución histórica de calidad">
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={evolution} margin={{ left: -10, right: 10, top: 5 }}>
                  <CartesianGrid stroke="#eee3d0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <Tooltip formatter={(v) => fmtScore(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Cadena" stroke="#b08d3e" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                  {f.branchId && activeBranches.map((b, i) => <Line key={b.id} type="monotone" dataKey={b.name} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Comparación entre sucursales" action={<span className="text-xs text-cafe-400">Promedio (n.º de auditorías)</span>}>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={byBranch.map((b) => ({ ...b, label: `${b.name} (${b.n})`, avg: b.avg == null ? null : +b.avg.toFixed(2) }))} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid stroke="#eee3d0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7a5c42' }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <Tooltip formatter={(v) => (v == null ? 'Sin auditorías' : fmtScore(Number(v)))} labelFormatter={(_l, p) => p?.[0]?.payload?.label ?? ''} />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]}>{byBranch.map((b, i) => <Cell key={i} fill={scoreColor(b.avg)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Indicadores por categoría">
            <div className="h-[420px]">
              <ResponsiveContainer>
                <BarChart data={cats} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid stroke="#eee3d0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <YAxis type="category" dataKey="short" width={118} tick={{ fontSize: 11, fill: '#46311f' }} />
                  <Tooltip formatter={(v) => `${fmtScore(Number(v))} %`} labelFormatter={(_l, p) => p?.[0]?.payload?.name ?? ''} />
                  <Bar dataKey="pct" barSize={14} radius={[0, 4, 4, 0]}>{cats.map((c, i) => <Cell key={i} fill={scoreColor(c.pct)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid gap-5">
            <Card title="Distribución de calificaciones">
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={dist} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid stroke="#eee3d0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7a5c42' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7a5c42' }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Auditorías" radius={[6, 6, 0, 0]}>{dist.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Ranking de sucursales">
              <ol className="space-y-1.5">
                {ranked.map((b, i) => (
                  <li key={b.id}>
                    <Link to={`/sucursales/${b.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-crema-100">
                      <span className="w-6 text-center font-serif text-lg font-semibold text-brand-accent">{i + 1}</span>
                      <span className="flex-1 text-sm font-medium">{b.name} <span className="text-xs text-cafe-400">({b.n})</span></span>
                      <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-cafe-800/5 sm:block"><div className="h-full rounded-full" style={{ width: `${b.avg}%`, background: scoreColor(b.avg) }} /></div>
                      <ScorePill score={b.avg} classification={b.avg! >= 90 ? 'EXCELENTE' : b.avg! >= 80 ? 'SATISFACTORIA' : b.avg! >= 70 ? 'EN OBSERVACIÓN' : 'DEFICIENTE'} size="sm" />
                    </Link>
                  </li>
                ))}
                {byBranch.filter((b) => b.avg == null).length > 0 && <li className="px-2 pt-1 text-xs text-cafe-400">Sin auditorías en el filtro: {byBranch.filter((b) => b.avg == null).map((b) => b.name).join(', ')}</li>}
              </ol>
            </Card>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Últimas auditorías" action={<Link to="/reportes" className="text-sm font-semibold text-brand-accent">Ver todas</Link>}>
          {filtered.length === 0 ? <p className="text-sm text-cafe-500">Sin auditorías para los filtros seleccionados.</p> : (
            <div className="divide-y divide-cafe-800/5">
              {filtered.slice(0, 8).map((a) => (
                <Link key={a.id} to={`/auditorias/${a.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div><div className="text-sm font-semibold">{a.branches?.name}</div><div className="text-xs text-cafe-500">{fmtDate(a.visit_date)} · {a.auditor_name}</div></div>
                  <div className="flex items-center gap-2">{a.has_critical && <ShieldAlert className="h-4 w-4 text-[#a33b2b]" />}<ScorePill score={a.final_score} classification={a.classification} size="sm" /><ClassBadge classification={a.status === 'borrador' ? null : a.classification} /></div>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Acciones correctivas vencidas" action={<Link to="/incumplimientos" className="text-sm font-semibold text-brand-accent">Seguimiento</Link>}>
          {overdue.length === 0 ? <p className="flex items-center gap-2 text-sm text-[#2f6b4f]"><CheckCircle2 className="h-4 w-4" /> No hay acciones vencidas.</p> : (
            <div className="divide-y divide-cafe-800/5">
              {overdue.slice(0, 8).map((n) => (
                <Link key={n.id} to={`/incumplimientos/${n.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><div className="truncate text-sm font-medium">{n.description}</div><div className="text-xs text-cafe-500">{n.branches?.name} · venció {fmtDate(n.due_date)}</div></div>
                  <NcStatusBadge s={n.status} overdue />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-cafe-400">Datos al {fmtDate(todayISO())}.</p>
    </div>
  );
}

function FranchiseeHome({ audits, ncs, alerts }: { audits: Audit[]; ncs: Nonconformity[]; alerts: AlertRow[] }) {
  const { branches, profile } = useSession();
  const finals = audits.filter((a) => a.status === 'finalizada');
  const open = ncs.filter((n) => n.status !== 'cerrado');
  const evolution = [...finals].reverse().map((a) => ({ fecha: fmtDate(a.visit_date), puntaje: Number(a.final_score), name: a.branches?.name }));
  const last = finals[0];
  const avg = finals.length ? finals.reduce((s, a) => s + Number(a.final_score), 0) / finals.length : null;
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Mi franquicia" title={branches.map((b) => b.name).join(' · ') || 'Sin sucursal asignada'} subtitle={`Bienvenido, ${profile!.full_name || profile!.email}`} />
      {branches.length === 0 && <Empty title="Su usuario no tiene una sucursal asignada">Solicite la asignación a la administración.</Empty>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Última calificación" value={fmtScore(last?.final_score)} tone={scoreColor(last?.final_score)} hint={last ? fmtDate(last.visit_date) : 'Sin auditorías'} />
        <Stat label="Promedio histórico" value={fmtScore(avg)} tone={scoreColor(avg)} hint={`${finals.length} auditoría(s)`} />
        <Stat label="Tareas pendientes" value={open.filter((n) => n.status !== 'corregido').length} hint={`${open.filter((n) => isOverdue(n.due_date, n.status)).length} vencida(s)`} />
        <Stat label="Alertas activas" value={alerts.length} tone={alerts.length ? TONE_HEX.deficiente : undefined} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Tareas pendientes" action={<Link to="/incumplimientos" className="text-sm font-semibold text-brand-accent">Ver todas</Link>}>
          {open.length === 0 ? <p className="text-sm text-[#2f6b4f]">No tiene incumplimientos pendientes.</p> : (
            <div className="divide-y divide-cafe-800/5">
              {open.slice(0, 10).map((n) => (
                <Link key={n.id} to={`/incumplimientos/${n.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><div className="truncate text-sm font-medium">{n.description}</div><div className="text-xs text-cafe-500">Límite {fmtDate(n.due_date)}{n.recommended_action ? ` · ${n.recommended_action}` : ''}</div></div>
                  <NcStatusBadge s={n.status} overdue={isOverdue(n.due_date, n.status)} />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Evolución de resultados">
          {evolution.length < 1 ? <p className="text-sm text-cafe-500">Sin auditorías finalizadas.</p> : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={evolution} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid stroke="#eee3d0" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <Tooltip formatter={(v) => fmtScore(Number(v))} />
                  <Line dataKey="puntaje" stroke="#b08d3e" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
      <Card className="mt-5" title="Mis auditorías" action={<Link to="/reportes" className="text-sm font-semibold text-brand-accent">Reportes</Link>}>
        {finals.length === 0 ? <p className="text-sm text-cafe-500">Sin auditorías finalizadas.</p> : (
          <div className="divide-y divide-cafe-800/5">
            {finals.slice(0, 10).map((a) => (
              <Link key={a.id} to={`/auditorias/${a.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <div><div className="text-sm font-semibold">{fmtDate(a.visit_date)} · {a.branches?.name}</div><div className="text-xs text-cafe-500">{a.report_number} · {a.auditor_name}</div></div>
                <div className="flex items-center gap-2"><ScorePill score={a.final_score} classification={a.classification} size="sm" /><ClassBadge classification={a.classification} /></div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
