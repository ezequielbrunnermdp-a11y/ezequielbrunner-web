import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, FileSignature, History, Pencil, ChevronDown, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { loadAuditBundle, type AuditBundle } from '../lib/api';
import { readPending, saveSnapshot, readSnapshot } from '../lib/offline';
import { computeScore } from '../lib/scoring';
import { AUDIT_TYPE_LABEL, DOC_STATUS_LABEL, fmtDate, fmtDateTime, fmtScore, scoreColor, SEVERITY_LABEL } from '../lib/format';
import type { ScoreResult } from '../lib/types';
import AuditRunner from './AuditRunner';
import { PdfButtons, auditPdfJob } from '../components/PdfActions';
import { PhotoGrid } from '../components/Photos';
import { CategoryExtras } from '../components/CategoryExtras';
import { CodeConfirm } from '../components/CodeConfirm';
import { Card, ClassBadge, ErrorBox, Field, Input, Loading, Modal, NcStatusBadge, Notice, ScorePill, SeverityBadge, Textarea, cx, isOverdue } from '../components/ui';

export default function AuditPage() {
  const { id } = useParams();
  const { profile, isAdmin, brand } = useSession();
  const nav = useNavigate();
  const [bundle, setBundle] = useState<AuditBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [offlineCopy, setOfflineCopy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const b = await loadAuditBundle(id);
      // Recuperar cambios locales no sincronizados (borradores)
      if (b.audit.status === 'borrador') {
        const pending = await readPending(id);
        for (const [qid, a] of Object.entries(pending.answers)) { const { _rev: _r, ...rest } = a; b.answers[qid] = rest; }
        for (const [cid, s] of Object.entries(pending.categories)) { const { _rev: _r, ...rest } = s; b.states[cid] = rest; }
        if (pending.audit) { const { _rev: _r, ...rest } = pending.audit; Object.assign(b.audit, rest); }
        for (const nc of Object.values(pending.ncs ?? {})) {
          if (!b.nonconformities.some((n) => n.id === nc.id)) b.nonconformities.push({ ...nc, status: 'pendiente', created_at: '', updated_at: '' } as never);
        }
        await saveSnapshot(id, b);
      }
      setBundle(b);
      setOfflineCopy(false);
    } catch (e) {
      const snap = await readSnapshot<AuditBundle>(id);
      if (snap) {
        const pending = await readPending(id);
        for (const [qid, a] of Object.entries(pending.answers)) { const { _rev: _r, ...rest } = a; snap.answers[qid] = rest; }
        for (const [cid, s] of Object.entries(pending.categories)) { const { _rev: _r, ...rest } = s; snap.states[cid] = rest; }
        setBundle(snap);
        setOfflineCopy(true);
      } else setErr(friendlyError(e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (err) return <div className="mx-auto max-w-xl py-10"><ErrorBox>{err}</ErrorBox><Link to="/" className="btn-ghost mt-4">Volver al panel</Link></div>;
  if (!bundle) return <Loading label="Cargando auditoría…" />;

  const a = bundle.audit;
  const canEdit = a.status === 'borrador' && (isAdmin || (a.auditor_id === profile!.id && profile!.role === 'auditor'));

  if (canEdit) {
    return (
      <>
        {offlineCopy && <div className="mb-3"><Notice tone="warn">Sin conexión: está trabajando sobre la copia guardada en este dispositivo. Los cambios se sincronizarán al recuperar la conexión.</Notice></div>}
        <AuditRunner bundle={bundle} onFinalized={() => { setBundle(null); load(); }} />
      </>
    );
  }
  return <AuditView bundle={bundle} reload={load} isAdmin={isAdmin} receiptEnabled={brand.receipt_enabled} isFranchisee={profile!.role === 'franquiciado'} onBack={() => nav(-1)} />;
}

function AuditView({ bundle, reload, isAdmin, receiptEnabled, isFranchisee, onBack }: { bundle: AuditBundle; reload: () => void; isAdmin: boolean; receiptEnabled: boolean; isFranchisee: boolean; onBack: () => void }) {
  const a = bundle.audit;
  const result: ScoreResult = a.category_results ?? computeScore(bundle.categories, bundle.answers, bundle.states);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [corrOpen, setCorrOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [recOpen, setRecOpen] = useState(false);
  const [recName, setRecName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const nav = useNavigate();
  const [revisions, setRevisions] = useState<{ id: string; revision: number; reason: string; created_at: string; snapshot: { audit: { final_score: number } } }[]>([]);
  const [prev, setPrev] = useState<{ id: string; visit_date: string; final_score: number } | null>(null);

  useEffect(() => {
    if (!isFranchisee) supabase.from('audit_revisions').select('id, revision, reason, created_at, snapshot').eq('audit_id', a.id).order('revision').then(({ data }) => setRevisions((data as never) ?? []));
    supabase.from('audits').select('id, visit_date, final_score').eq('branch_id', a.branch_id).eq('status', 'finalizada').neq('id', a.id)
      .lte('visit_date', a.visit_date).order('visit_date', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setPrev(data as never));
  }, [a.id, a.branch_id, a.visit_date, isFranchisee]);

  const correction = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('begin_audit_correction', { p_audit: a.id, p_reason: reason });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    setCorrOpen(false);
    reload();
  };
  const receipt = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('acknowledge_audit', { p_audit: a.id, p_name: recName });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    setRecOpen(false);
    reload();
  };

  const chartData = result.categories.map((c) => ({ name: c.name, short: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name, pct: c.pct }));

  return (
    <div className="fade-in space-y-5">
      <button className="btn-ghost -ml-2 px-2 text-sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Volver</button>
      <div className="card overflow-hidden">
        <div className="bg-brand px-5 py-6 text-crema-50 sm:px-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-oro-300">{a.status === 'finalizada' ? `Informe ${a.report_number}` : 'Borrador en curso'}{a.revision > 1 ? ` · Revisión ${a.revision}` : ''}</div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold">{a.branches?.name}</h1>
              <div className="mt-1 text-sm text-crema-200/80">{fmtDate(a.visit_date)} · {AUDIT_TYPE_LABEL[a.audit_type]} · Auditor: {a.auditor_name}</div>
            </div>
            <div className="text-right">
              <div className="font-serif text-5xl font-semibold tabular-nums">{fmtScore(a.final_score ?? result.final_score)}<span className="text-lg text-crema-200/60">/100</span></div>
              <div className="mt-1"><span className="chip bg-crema-50/15 text-crema-50">{a.classification ?? result.classification ?? 'Provisional'}</span></div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7">
          <div className="text-xs text-cafe-500">
            Registro creado {fmtDateTime(a.created_at)}{a.finalized_at && ` · Finalizada ${fmtDateTime(a.finalized_at)}`}
            {prev && <> · Anterior: <Link className="font-semibold text-brand-accent" to={`/auditorias/${prev.id}`}>{fmtScore(prev.final_score)} ({fmtDate(prev.visit_date)})</Link></>}
          </div>
          <PdfButtons job={auditPdfJob(a.id)} />
        </div>
      </div>

      {a.status === 'borrador' && <Notice tone="warn">Esta auditoría está en borrador y solo puede editarla el auditor responsable.</Notice>}
      {a.has_critical && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#a33b2b]/25 bg-[#a33b2b]/5 p-4 text-sm text-[#7a2318]">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div><strong>Irregularidad crítica registrada.</strong> La alerta es independiente del puntaje final. <Link to="/alertas" className="underline">Ver alertas</Link></div>
        </div>
      )}
      {result.redistributed && <Notice>Categorías no aplicables: {result.categories.filter((c) => !c.applicable).map((c) => `${c.name}${c.na_reason ? ` (${c.na_reason})` : ''}`).join('; ')}. Sus ponderaciones se redistribuyeron proporcionalmente.</Notice>}

      <div className="flex flex-wrap gap-2">
        {a.status === 'finalizada' && receiptEnabled && !a.receipt_at && isFranchisee && (
          <button className="btn-accent" onClick={() => setRecOpen(true)}><FileSignature className="h-4 w-4" /> Registrar constancia de recepción</button>
        )}
        {a.receipt_at && <span className="chip bg-[#2f6b4f]/10 py-1.5 text-[#2f6b4f]">Recibido por {a.receipt_name} · {fmtDateTime(a.receipt_at)}</span>}
        {a.status === 'finalizada' && isAdmin && (
          <button className="btn-outline" onClick={() => setCorrOpen(true)}><Pencil className="h-4 w-4" /> Corrección autorizada</button>
        )}
        {isAdmin && (
          <button className="btn-ghost text-[#a33b2b]" onClick={() => setDelOpen(true)}><Trash2 className="h-4 w-4" /> Eliminar auditoría</button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Cumplimiento por categoría">
          <div className="h-[420px]">
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#eee3d0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#7a5c42' }} unit="%" />
                <YAxis type="category" dataKey="short" width={110} tick={{ fontSize: 11, fill: '#46311f' }} />
                <Tooltip formatter={(v) => (v == null ? 'No aplica' : `${fmtScore(Number(v))} %`)} labelFormatter={(_l, p) => p?.[0]?.payload?.name ?? ''} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((d, i) => <Cell key={i} fill={scoreColor(d.pct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Resultados">
          <table className="table-base">
            <thead><tr><th>Categoría</th><th className="text-right">Peso</th><th className="text-right">Puntaje</th><th className="text-right">%</th></tr></thead>
            <tbody>
              {result.categories.map((c) => (
                <tr key={c.category_id}>
                  <td className="text-[13px]">{c.name}</td>
                  <td className="text-right text-xs text-cafe-500">{fmtScore(c.weight, 0)}</td>
                  <td className="text-right tabular-nums">{c.score == null ? '—' : fmtScore(c.score, 2)}</td>
                  <td className="text-right font-semibold tabular-nums" style={{ color: scoreColor(c.pct) }}>{c.pct == null ? 'N/A' : fmtScore(c.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {bundle.nonconformities.length > 0 && (
        <Card title={`Incumplimientos y acciones correctivas (${bundle.nonconformities.length})`}>
          <div className="divide-y divide-cafe-800/5">
            {bundle.nonconformities.map((n) => (
              <Link key={n.id} to={`/incumplimientos/${n.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-brand-accent">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{n.description}</div>
                  <div className="text-xs text-cafe-500">{n.responsible || 'Sin responsable'} · límite {fmtDate(n.due_date)}</div>
                </div>
                <div className="flex gap-1.5"><SeverityBadge s={n.severity} /><NcStatusBadge s={n.status} overdue={isOverdue(n.due_date, n.status)} /></div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card title="Detalle de controles">
        {a.initial_notes && <p className="mb-3 text-sm text-cafe-600"><strong>Observaciones iniciales:</strong> {a.initial_notes}</p>}
        <div className="space-y-2">
          {bundle.categories.map((cat) => {
            const st = bundle.states[cat.id];
            const cr = result.categories.find((x) => x.category_id === cat.id);
            const isOpen = open[cat.id];
            return (
              <div key={cat.id} className="rounded-xl border border-cafe-800/10">
                <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen((o) => ({ ...o, [cat.id]: !o[cat.id] }))}>
                  <span className="font-semibold">{cat.position}. {cat.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: scoreColor(cr?.pct) }}>{cr?.pct == null ? 'N/A' : `${fmtScore(cr.pct)} %`}</span>
                    <ChevronDown className={cx('h-4 w-4 transition', isOpen && 'rotate-180')} />
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-cafe-800/10 px-4 py-3">
                    {st?.not_applicable ? <p className="text-sm text-cafe-500">No aplica: {st.na_reason}</p> : (
                      <ul className="divide-y divide-cafe-800/5">
                        {cat.questions.filter((q) => q.active).map((q, i) => {
                          const ans = bundle.answers[q.id];
                          const photos = bundle.attachments.filter((x) => x.question_id === q.id && !x.nonconformity_id);
                          return (
                            <li key={q.id} className={cx('py-3', ans?.is_critical && 'bg-[#a33b2b]/5')}>
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-sm"><span className="text-cafe-400">{i + 1}.</span> {q.text} {ans?.is_critical && <span className="ml-1 text-xs font-bold text-[#a33b2b]">CRÍTICO</span>}</span>
                                <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: ans?.not_applicable ? '#7a6a5a' : scoreColor(ans?.score == null ? null : ans.score * 20) }}>
                                  {ans?.not_applicable ? 'N/A' : ans?.score ?? '—'}
                                </span>
                              </div>
                              {ans?.not_applicable && ans.na_reason && <p className="mt-1 text-xs text-cafe-500">Motivo: {ans.na_reason}</p>}
                              {ans?.doc_status && <p className="mt-1 text-xs">Documentación: {DOC_STATUS_LABEL[ans.doc_status]}{ans.doc_expiry && ` · vence ${fmtDate(ans.doc_expiry)}`}</p>}
                              {ans?.observation && <p className="mt-1 text-xs text-cafe-700">Observación: {ans.observation}</p>}
                              {ans?.recommendation && <p className="mt-1 text-xs text-cafe-500">Recomendación: {ans.recommendation}</p>}
                              {bundle.nonconformities.filter((n) => n.question_id === q.id).map((n) => (
                                <p key={n.id} className="mt-1 text-xs text-[#a33b2b]">Incumplimiento ({SEVERITY_LABEL[n.severity]}): {n.description}</p>
                              ))}
                              {photos.length > 0 && <div className="mt-2"><PhotoGrid attachments={photos} size="sm" /></div>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {cat.extras && st?.extras && Object.keys(st.extras).length > 0 && (
                      <div className="mt-3 rounded-xl bg-crema-100 p-3"><CategoryExtras kind={cat.extras} extras={st.extras} onChange={() => undefined} disabled /></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {(a.conclusion || a.recommendations) && (
        <Card title="Cierre del auditor">
          {a.conclusion && <><div className="text-xs font-semibold uppercase text-cafe-500">Conclusión</div><p className="mb-3 mt-1 whitespace-pre-line text-sm">{a.conclusion}</p></>}
          {a.recommendations && <><div className="text-xs font-semibold uppercase text-cafe-500">Recomendaciones</div><p className="mt-1 whitespace-pre-line text-sm">{a.recommendations}</p></>}
        </Card>
      )}

      {revisions.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4" /> Versiones anteriores</span>}>
          <ul className="space-y-2 text-sm">
            {revisions.map((r) => (
              <li key={r.id} className="rounded-xl bg-crema-100 px-3 py-2">
                Revisión {r.revision} · puntaje {fmtScore(r.snapshot?.audit?.final_score)} · corregida el {fmtDateTime(r.created_at)}
                <div className="text-xs text-cafe-500">Motivo: {r.reason}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ErrorBox>{err}</ErrorBox>

      <CodeConfirm open={delOpen} onClose={() => setDelOpen(false)} title="Eliminar auditoría" confirmLabel="Eliminar"
        onConfirm={async (code) => {
          const { error } = await supabase.rpc('admin_delete_audit', { p_audit: a.id, p_code: code });
          if (error) throw error;
          nav('/reportes', { replace: true });
        }}>
        <p>Se eliminará la auditoría de <strong>{a.branches?.name}</strong> del {fmtDate(a.visit_date)}{a.report_number ? ` (informe ${a.report_number})` : ''}, con sus respuestas, fotos, incumplimientos y alertas.</p>
      </CodeConfirm>
      <Modal open={corrOpen} onClose={() => setCorrOpen(false)} title="Corrección autorizada"
        footer={<><button className="btn-ghost" onClick={() => setCorrOpen(false)}>Cancelar</button><button className="btn-primary" disabled={busy || reason.trim().length < 10} onClick={correction}>Autorizar corrección</button></>}>
        <div className="space-y-3 text-sm">
          <p>La auditoría volverá a estado borrador para que el auditor corrija los datos. Se conserva la versión actual completa, se registra el motivo y el número de informe se mantiene.</p>
          <Field label="Motivo de la corrección *" hint="Mínimo 10 caracteres. Queda registrado en el historial y en el informe."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <ScorePill score={a.final_score} classification={a.classification} /> <ClassBadge classification={a.classification} />
        </div>
      </Modal>
      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Constancia de recepción"
        footer={<><button className="btn-ghost" onClick={() => setRecOpen(false)}>Cancelar</button><button className="btn-primary" disabled={busy || recName.trim().length < 3} onClick={receipt}>Registrar constancia</button></>}>
        <div className="space-y-3 text-sm">
          <p>Deja constancia de que recibió el informe de auditoría. Se registran su usuario, el nombre indicado y la fecha y hora.</p>
          <p className="text-xs text-cafe-500">Es una firma electrónica simple; no constituye una firma digital certificada ni implica conformidad con los resultados.</p>
          <Field label="Nombre y apellido"><Input value={recName} onChange={(e) => setRecName(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
