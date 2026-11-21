import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, ClipboardPlus, TrendingUp, TrendingDown, Minus, Repeat, Phone, Mail, MapPin, Building2, UserCheck } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { listAudits, listNonconformities } from '../lib/api';
import { fmtDate, fmtScore, scoreColor } from '../lib/format';
import type { Audit, BranchOverview, Nonconformity, ScoreResult } from '../lib/types';
import { BranchForm } from './Branches';
import { PdfButtons, auditPdfJob } from '../components/PdfActions';
import { Card, ClassBadge, Empty, Loading, NcStatusBadge, PageHeader, ScorePill, Stat, isOverdue } from '../components/ui';

interface Repeated { text: string; category: string; times: number }

export default function BranchDetail() {
  const { id } = useParams();
  const { isAdmin, isStaff, refreshBranches } = useSession();
  const [b, setB] = useState<BranchOverview | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [ncs, setNcs] = useState<Nonconformity[]>([]);
  const [repeated, setRepeated] = useState<Repeated[]>([]);
  const [auditor, setAuditor] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from('branch_overview').select('*').eq('id', id).maybeSingle();
    setB(data as BranchOverview);
    const as = await listAudits({ branchId: id });
    setAudits(as);
    setNcs(await listNonconformities({ branchId: id }));
    if (data?.assigned_auditor_id && isAdmin) {
      const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', data.assigned_auditor_id).maybeSingle();
      setAuditor(p?.full_name || p?.email || null);
    }
    // Incumplimientos reiterados: preguntas con ≤ 2 puntos en más de una auditoría finalizada
    const finIds = as.filter((a) => a.status === 'finalizada').map((a) => a.id);
    if (finIds.length > 1) {
      const { data: low } = await supabase.from('audit_answers').select('audit_id, questions(text, categories(name))').in('audit_id', finIds).lte('score', 2).eq('not_applicable', false);
      const m = new Map<string, Repeated>();
      ((low ?? []) as unknown as { audit_id: string; questions: { text: string; categories: { name: string } } }[]).forEach((r) => {
        const k = r.questions.text;
        const e = m.get(k) ?? { text: k, category: r.questions.categories.name, times: 0 };
        e.times++;
        m.set(k, e);
      });
      setRepeated([...m.values()].filter((r) => r.times > 1).sort((x, y) => y.times - x.times));
    }
    setLoading(false);
  };
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Loading />;
  if (!b) return <Empty title="Sucursal no encontrada o sin acceso" />;

  const finals = audits.filter((a) => a.status === 'finalizada' && a.final_score != null);
  const chrono = [...finals].reverse();
  const series = chrono.map((a, i) => ({ n: `#${i + 1}`, fecha: fmtDate(a.visit_date), puntaje: Number(a.final_score) }));
  let trend: { label: string; icon: JSX.Element; color: string; detail: string } | null = null;
  if (chrono.length >= 2) {
    const last = Number(chrono[chrono.length - 1].final_score), prev = Number(chrono[chrono.length - 2].final_score);
    const d = last - prev;
    trend = d > 1 ? { label: 'Mejora', icon: <TrendingUp className="h-5 w-5" />, color: '#2f6b4f', detail: `+${fmtScore(d)} puntos vs. la auditoría anterior` }
      : d < -1 ? { label: 'Retroceso', icon: <TrendingDown className="h-5 w-5" />, color: '#a33b2b', detail: `${fmtScore(d)} puntos vs. la auditoría anterior` }
      : { label: 'Estabilidad', icon: <Minus className="h-5 w-5" />, color: '#7a6a5a', detail: `${d >= 0 ? '+' : ''}${fmtScore(d)} puntos vs. la auditoría anterior` };
  }
  // Categorías con peor evolución (primera vs. última auditoría)
  let catEvolution: { name: string; first: number; last: number; delta: number }[] = [];
  if (chrono.length >= 2) {
    const f = chrono[0].category_results as ScoreResult | null, l = chrono[chrono.length - 1].category_results as ScoreResult | null;
    catEvolution = (l?.categories ?? []).map((c) => {
      const fc = f?.categories.find((x) => x.code === c.code);
      return fc?.pct != null && c.pct != null ? { name: c.name, first: Number(fc.pct), last: Number(c.pct), delta: Number(c.pct) - Number(fc.pct) } : null;
    }).filter(Boolean).sort((x, y) => x!.delta - y!.delta).slice(0, 5) as typeof catEvolution;
  }
  const open = ncs.filter((n) => n.status !== 'cerrado');

  return (
    <div className="fade-in space-y-5">
      <Link to="/sucursales" className="btn-ghost -ml-2 px-2 text-sm"><ArrowLeft className="h-4 w-4" /> Sucursales</Link>
      <PageHeader eyebrow={b.active ? 'Sucursal activa' : 'Sucursal inactiva'} title={b.name}
        actions={<>
          {isStaff && b.active && <Link to={`/auditorias/nueva?sucursal=${b.id}`} className="btn-primary"><ClipboardPlus className="h-4 w-4" /> Nueva auditoría</Link>}
          {isAdmin && <button className="btn-outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Editar ficha</button>}
        </>} />

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card title="Ficha">
          <dl className="space-y-2.5 text-sm">
            <div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-cafe-400" /><span>{b.address || <span className="text-cafe-400">Dirección no cargada</span>}</span></div>
            <div className="flex gap-2"><Building2 className="h-4 w-4 shrink-0 text-cafe-400" /><span>{b.legal_name || <span className="text-cafe-400">Razón social no cargada</span>}</span></div>
            <div className="flex gap-2"><UserCheck className="h-4 w-4 shrink-0 text-cafe-400" /><span>Responsable: {b.manager_name || '—'}</span></div>
            <div className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-cafe-400" />{b.phone ? <a href={`tel:${b.phone}`} className="text-brand-accent">{b.phone}</a> : '—'}</div>
            <div className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-cafe-400" />{b.email ? <a href={`mailto:${b.email}`} className="text-brand-accent">{b.email}</a> : '—'}</div>
            {isAdmin && <div className="text-cafe-500">Auditor asignado: <strong className="text-cafe-800">{auditor ?? 'Sin asignar'}</strong></div>}
            {b.notes && isStaff && <div className="rounded-lg bg-crema-100 p-2 text-xs">{b.notes}</div>}
          </dl>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Última auditoría" value={<span className="text-xl">{fmtDate(b.last_audit_date)}</span>} />
          <Stat label="Última calificación" value={fmtScore(b.last_score)} tone={scoreColor(b.last_score)} />
          <Stat label="Promedio histórico" value={fmtScore(b.avg_score)} tone={scoreColor(b.avg_score)} hint={`${b.audits_count} auditoría(s)`} />
          <Stat label="Incumplimientos pendientes" value={b.open_nc} tone={b.open_nc ? '#a33b2b' : undefined} hint={`${open.filter((n) => isOverdue(n.due_date, n.status)).length} vencido(s)`} />
          {trend && (
            <div className="card col-span-2 flex items-center gap-3 p-4 md:col-span-4" style={{ color: trend.color }}>
              {trend.icon}<div><div className="font-serif text-xl font-semibold">{trend.label}</div><div className="text-xs text-cafe-500">{trend.detail}</div></div>
            </div>
          )}
        </div>
      </div>

      {series.length > 0 && (
        <Card title="Evolución de resultados">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ left: -10, right: 16, top: 8 }}>
                <CartesianGrid stroke="#eee3d0" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#7a5c42' }} />
                <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: '#7a5c42' }} />
                <ReferenceLine y={90} stroke="#2f6b4f" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#a33b2b" strokeDasharray="4 4" />
                <Tooltip formatter={(v) => fmtScore(Number(v))} />
                <Line dataKey="puntaje" name="Puntaje" stroke="#b08d3e" strokeWidth={3} dot={{ r: 4, fill: '#2e2016' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {(repeated.length > 0 || catEvolution.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Repeat className="h-4 w-4 text-[#a33b2b]" /> Incumplimientos reiterados</span>}>
            {repeated.length === 0 ? <p className="text-sm text-cafe-500">No se detectan controles con 2 puntos o menos en más de una auditoría.</p> : (
              <ul className="space-y-1.5 text-sm">{repeated.slice(0, 10).map((r) => <li key={r.text} className="rounded-lg bg-[#a33b2b]/5 px-3 py-2"><strong>{r.times} veces</strong> · {r.text}<div className="text-xs text-cafe-500">{r.category}</div></li>)}</ul>
            )}
          </Card>
          <Card title="Categorías con peor evolución">
            {catEvolution.length === 0 ? <p className="text-sm text-cafe-500">Se necesitan al menos dos auditorías.</p> : (
              <ul className="space-y-1.5 text-sm">
                {catEvolution.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 rounded-lg bg-crema-100 px-3 py-2">
                    <span>{c.name}</span>
                    <span className="tabular-nums">{fmtScore(c.first)} → {fmtScore(c.last)} <strong style={{ color: c.delta < 0 ? '#a33b2b' : '#2f6b4f' }}>({c.delta >= 0 ? '+' : ''}{fmtScore(c.delta)})</strong></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Card title="Historial de inspecciones">
        {audits.length === 0 ? <p className="text-sm text-cafe-500">Esta sucursal todavía no tiene auditorías registradas.</p> : (
          <div className="space-y-3">
            {audits.map((a) => {
              const n = ncs.filter((x) => x.audit_id === a.id).length;
              return (
                <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-cafe-800/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link to={`/auditorias/${a.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{fmtDate(a.visit_date)}</span>
                      <ScorePill score={a.final_score} classification={a.classification} size="sm" />
                      {a.status === 'borrador' ? <span className="chip bg-[#b07a1e]/10 text-[#8a5e12]">Borrador</span> : <ClassBadge classification={a.classification} />}
                    </div>
                    <div className="mt-0.5 text-xs text-cafe-500">{a.auditor_name} · {a.report_number ?? 'sin número'} · {n} incumplimiento(s)</div>
                    {a.conclusion && <div className="mt-1 line-clamp-2 text-xs text-cafe-600">{a.conclusion}</div>}
                  </Link>
                  {a.status === 'finalizada' && <PdfButtons job={auditPdfJob(a.id)} size="sm" />}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {open.length > 0 && (
        <Card title="Incumplimientos pendientes" action={<Link to={`/incumplimientos?sucursal=${b.id}`} className="text-sm font-semibold text-brand-accent">Seguimiento</Link>}>
          <div className="divide-y divide-cafe-800/5">
            {open.map((n) => (
              <Link key={n.id} to={`/incumplimientos/${n.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{n.description}</div><div className="text-xs text-cafe-500">{n.categories?.name ?? 'General'} · límite {fmtDate(n.due_date)}</div></div>
                <NcStatusBadge s={n.status} overdue={isOverdue(n.due_date, n.status)} />
              </Link>
            ))}
          </div>
        </Card>
      )}
      <BranchForm open={edit} branch={b} onClose={() => setEdit(false)} onSaved={() => { load(); refreshBranches(); }} />
    </div>
  );
}
