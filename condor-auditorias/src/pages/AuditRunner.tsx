import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, CloudOff, Cloud, Loader2, AlertTriangle, LayoutList, Flag, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { computeScore, provisionalCategory } from '../lib/scoring';
import { useAuditSync, readQueuedPhotos, clearLocal, type QueuedPhoto, type NcDraft } from '../lib/offline';
import { deleteAttachment } from '../lib/files';
import { AUDIT_TYPE_LABEL, fmtDate, fmtScore, scoreColor, fmtDateTime } from '../lib/format';
import type { Answer, Attachment, Category, CategoryState, Nonconformity } from '../lib/types';
import type { AuditBundle } from '../lib/api';
import { QuestionCard } from '../components/QuestionCard';
import { NcModal } from '../components/NcModal';
import { CategoryExtras, EXTRAS_TITLE } from '../components/CategoryExtras';
import { Card, ClassBadge, ErrorBox, Field, Modal, Notice, Textarea, cx } from '../components/ui';

function emptyAnswer(auditId: string, questionId: string): Answer {
  return { audit_id: auditId, question_id: questionId, score: null, not_applicable: false, na_reason: null, observation: null, recommendation: null, is_critical: false, doc_status: null, doc_expiry: null };
}

function SyncIndicator({ status, pending, lastSaved, onRetry }: { status: string; pending: number; lastSaved: Date | null; onRetry: () => void }) {
  if (status === 'guardando') return <span className="flex items-center gap-1.5 text-xs text-cafe-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</span>;
  if (status === 'sin_conexion') return <span className="flex items-center gap-1.5 text-xs font-semibold text-[#8a5e12]"><CloudOff className="h-3.5 w-3.5" /> Sin conexión · {pending} cambio(s) en este dispositivo</span>;
  if (status === 'error') return <button onClick={onRetry} className="flex items-center gap-1.5 text-xs font-semibold text-[#a33b2b]"><RefreshCw className="h-3.5 w-3.5" /> Error al guardar · reintentar</button>;
  if (status === 'pendiente' || pending > 0) return <span className="flex items-center gap-1.5 text-xs text-[#8a5e12]"><Cloud className="h-3.5 w-3.5" /> {pending} cambio(s) por sincronizar</span>;
  return <span className="flex items-center gap-1.5 text-xs text-[#2f6b4f]"><CheckCircle2 className="h-3.5 w-3.5" /> Guardado en el servidor{lastSaved ? ` · ${lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>;
}

export default function AuditRunner({ bundle, onFinalized }: { bundle: AuditBundle; onFinalized: () => void }) {
  const { audit, categories } = bundle;
  const { brand } = useSession();
  const nav = useNavigate();
  const [answers, setAnswers] = useState<Record<string, Answer>>(bundle.answers);
  const [states, setStates] = useState<Record<string, CategoryState>>(bundle.states);
  const [ncs, setNcs] = useState<Nonconformity[]>(bundle.nonconformities);
  const [atts, setAtts] = useState<Attachment[]>(bundle.attachments);
  const [queued, setQueued] = useState<QueuedPhoto[]>([]);
  const [view, setView] = useState<'indice' | number | 'cierre'>('indice');
  const [highlight, setHighlight] = useState(false);
  const [ncModal, setNcModal] = useState<{ open: boolean; initial: Partial<Nonconformity> | null }>({ open: false, initial: null });
  const [conclusion, setConclusion] = useState(audit.conclusion ?? '');
  const [recommendations, setRecommendations] = useState(audit.recommendations ?? '');
  const [confirm, setConfirm] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sync = useAuditSync(audit.id, audit.branch_id, true);

  const refreshQueued = useCallback(() => readQueuedPhotos(audit.id).then(setQueued), [audit.id]);
  const refreshAtts = useCallback(async () => {
    const { data } = await supabase.from('attachments').select('*').eq('audit_id', audit.id).order('created_at');
    if (data) setAtts(data as Attachment[]);
  }, [audit.id]);
  const refreshNcs = useCallback(async () => {
    const { data } = await supabase.from('nonconformities').select('*').eq('audit_id', audit.id).order('created_at');
    if (data) setNcs((cur) => {
      const server = data as Nonconformity[];
      const ids = new Set(server.map((n) => n.id));
      return [...server, ...cur.filter((n) => !ids.has(n.id) && (n as Nonconformity & { _local?: boolean })._local)];
    });
  }, [audit.id]);

  useEffect(() => {
    refreshQueued();
    const onPhoto = (e: Event) => {
      if ((e as CustomEvent).detail?.auditId !== audit.id) return;
      refreshQueued();
      refreshAtts();
    };
    const onNc = (e: Event) => {
      if ((e as CustomEvent).detail?.auditId !== audit.id) return;
      refreshNcs();
    };
    window.addEventListener('cnd:photo-synced', onPhoto);
    window.addEventListener('cnd:nc-synced', onNc);
    return () => { window.removeEventListener('cnd:photo-synced', onPhoto); window.removeEventListener('cnd:nc-synced', onNc); };
  }, [audit.id, refreshQueued, refreshAtts, refreshNcs]);

  const score = useMemo(() => computeScore(categories, answers, states), [categories, answers, states]);
  const totalQ = useMemo(() => categories.reduce((s, c) => s + (states[c.id]?.not_applicable ? 0 : c.questions.filter((q) => q.active).length), 0), [categories, states]);
  const answeredQ = totalQ - score.pending;
  const progress = totalQ ? answeredQ / totalQ : 0;

  const answersRef = useRef(answers);
  const statesRef = useRef(states);
  const { queueAnswer, queueCategory } = sync;

  const setAnswer = useCallback((qid: string, patch: Partial<Answer>) => {
    const next = { ...(answersRef.current[qid] ?? emptyAnswer(audit.id, qid)), ...patch };
    answersRef.current = { ...answersRef.current, [qid]: next };
    setAnswers(answersRef.current);
    queueAnswer(next);
  }, [audit.id, queueAnswer]);

  const setCategoryState = (cid: string, patch: Partial<CategoryState>) => {
    const next: CategoryState = { ...(statesRef.current[cid] ?? { audit_id: audit.id, category_id: cid, not_applicable: false, na_reason: null, extras: {} }), ...patch };
    statesRef.current = { ...statesRef.current, [cid]: next };
    setStates(statesRef.current);
    queueCategory(next);
  };

  const addPhotos = async (qid: string | null, files: File[], ncId: string | null = null) => {
    for (const f of files) await sync.queuePhoto(f, qid, null, ncId);
    refreshQueued();
  };

  const removePhoto = async (a: Attachment) => {
    if (!confirmDelete()) return;
    try {
      await deleteAttachment(a);
      setAtts((cur) => cur.filter((x) => x.id !== a.id));
    } catch (e) { setErr(friendlyError(e)); }
  };
  const confirmDelete = () => window.confirm('¿Eliminar esta fotografía?');

  const onNcSaved = async (nc: NcDraft, photos: File[], isNew: boolean) => {
    const full = { ...nc, status: 'pendiente', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), _local: true } as unknown as Nonconformity;
    setNcs((cur) => (isNew ? [...cur, full] : cur.map((n) => (n.id === nc.id ? { ...n, ...nc } : n))));
    if (photos.length) await addPhotos(nc.question_id, photos, nc.id);
    if (navigator.onLine) refreshNcs();
  };

  const goCategory = (i: number) => {
    setView(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tryFinalize = async () => {
    setErr(null);
    if (score.errors.length) {
      setHighlight(true);
      setErr('Hay controles pendientes o incompletos. Revise las categorías marcadas antes de finalizar.');
      return;
    }
    setConfirm(true);
  };

  const finalize = async () => {
    setFinalizing(true);
    setErr(null);
    try {
      if (!navigator.onLine) throw new Error('Necesita conexión para finalizar. Los cambios están guardados en este dispositivo.');
      const ok = await sync.flush();
      if (!ok) {
        const again = await sync.flush();
        if (!again) throw new Error('Aún hay cambios sin sincronizar con el servidor. Espere a que se guarden e intente nuevamente.');
      }
      const { error } = await supabase.rpc('finalize_audit', { p_audit: audit.id, p_conclusion: conclusion || null, p_recommendations: recommendations || null });
      if (error) throw error;
      await clearLocal(audit.id);
      setConfirm(false);
      onFinalized();
    } catch (e) {
      setErr(friendlyError(e));
      setConfirm(false);
    } finally {
      setFinalizing(false);
    }
  };

  const cat: Category | null = typeof view === 'number' ? categories[view] : null;
  const branchName = audit.branches?.name ?? '';

  return (
    <div className="fade-in">
      {/* Encabezado fijo */}
      <div className="sticky top-[57px] z-10 -mx-4 mb-5 border-b border-cafe-800/10 bg-[rgb(var(--brand-bg)/0.95)] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-serif text-xl font-semibold text-cafe-900">{branchName}</div>
            <div className="text-xs text-cafe-500">{fmtDate(audit.visit_date)} · {AUDIT_TYPE_LABEL[audit.audit_type]} · {audit.auditor_name}{audit.revision > 1 ? ` · Corrección (rev. ${audit.revision})` : ''}</div>
          </div>
          <div className="text-right">
            <div className="font-serif text-2xl font-semibold tabular-nums" style={{ color: scoreColor(score.final_score) }}>{fmtScore(score.final_score)}</div>
            <div className="text-[10px] uppercase tracking-wide text-cafe-400">provisional</div>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cafe-800/10">
          <div className="h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-xs text-cafe-500">{answeredQ} de {totalQ} controles · {Math.round(progress * 100)} %</span>
          <SyncIndicator status={sync.status} pending={sync.pendingCount} lastSaved={sync.lastSaved} onRetry={() => sync.flush()} />
        </div>
      </div>

      {audit.correction_reason && <div className="mb-4"><Notice tone="warn">Corrección autorizada en curso. Motivo: {audit.correction_reason}</Notice></div>}
      {sync.error && sync.status === 'error' && <div className="mb-4"><ErrorBox>{sync.error}</ErrorBox></div>}

      {view === 'indice' && (
        <div className="space-y-3">
          {audit.initial_notes && <Card><div className="text-xs font-semibold uppercase tracking-wide text-cafe-500">Observaciones iniciales</div><p className="mt-1 text-sm">{audit.initial_notes}</p></Card>}
          {categories.map((c, i) => {
            const st = states[c.id];
            const pc = provisionalCategory(c, answers);
            const ncCount = ncs.filter((n) => n.category_id === c.id).length;
            const crit = c.questions.filter((q) => answers[q.id]?.is_critical).length;
            const done = st?.not_applicable || (pc.answered === pc.total && pc.incomplete === 0);
            return (
              <button key={c.id} onClick={() => goCategory(i)}
                className={cx('card flex w-full items-center gap-4 p-4 text-left transition hover:ring-brand-accent/40',
                  highlight && !done && 'ring-2 ring-[#b07a1e]/60')}>
                <div className="relative h-12 w-12 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(46 32 22 / .08)" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={done ? '#2f6b4f' : 'rgb(var(--brand-accent))'} strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray={`${(st?.not_applicable ? 1 : pc.progress) * 97.4} 97.4`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-cafe-700">{c.position}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-cafe-900">{c.name}</span>
                    {crit > 0 && <ShieldAlert className="h-4 w-4 shrink-0 text-[#a33b2b]" />}
                  </div>
                  <div className="mt-0.5 text-xs text-cafe-500">
                    {st?.not_applicable ? 'No aplica' : `${pc.answered}/${pc.total} respondidas`}
                    {pc.incomplete > 0 && <span className="font-semibold text-[#8a5e12]"> · {pc.incomplete} incompleta(s)</span>}
                    {ncCount > 0 && <span className="text-[#a33b2b]"> · {ncCount} incumplimiento(s)</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums" style={{ color: scoreColor(pc.pct) }}>{pc.pct == null ? '—' : `${fmtScore(pc.pct, 0)} %`}</div>
                  <div className="text-[10px] text-cafe-400">peso {fmtScore(c.weight, 0)}</div>
                </div>
              </button>
            );
          })}
          <button className="btn-primary mt-4 w-full py-4" onClick={() => { setView('cierre'); window.scrollTo({ top: 0 }); }}>
            <Flag className="h-5 w-5" /> Revisar y finalizar
          </button>
        </div>
      )}

      {cat && typeof view === 'number' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button className="btn-ghost -ml-2 px-2 text-sm" onClick={() => setView('indice')}><LayoutList className="h-4 w-4" /> Categorías</button>
            <span className="text-xs text-cafe-500">Categoría {view + 1} de {categories.length}</span>
          </div>
          <div>
            <div className="eyebrow">Categoría {cat.position} · Ponderación {fmtScore(cat.weight, 0)} puntos</div>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-cafe-900">{cat.name}</h2>
            {cat.description && <p className="mt-1 text-sm text-cafe-500">{cat.description}</p>}
          </div>

          <Card>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand-accent))]" checked={!!states[cat.id]?.not_applicable}
                onChange={(e) => setCategoryState(cat.id, { not_applicable: e.target.checked })} />
              La categoría completa no aplica en esta sucursal
            </label>
            {states[cat.id]?.not_applicable && (
              <div className="mt-3">
                <Textarea rows={2} placeholder="Justificación obligatoria. Su ponderación se redistribuirá proporcionalmente y quedará constancia en el informe."
                  value={states[cat.id]?.na_reason ?? ''} onChange={(e) => setCategoryState(cat.id, { na_reason: e.target.value })}
                  className={cx(!(states[cat.id]?.na_reason ?? '').trim() && 'border-[#b07a1e]')} />
              </div>
            )}
          </Card>

          {cat.extras && (
            <Card title={EXTRAS_TITLE[cat.extras]}>
              <CategoryExtras kind={cat.extras} extras={states[cat.id]?.extras ?? {}} onChange={(extras) => setCategoryState(cat.id, { extras })} />
            </Card>
          )}

          {!states[cat.id]?.not_applicable && cat.questions.filter((q) => q.active).map((q, i) => (
            <QuestionCard key={q.id} index={i + 1} question={q} answer={answers[q.id]} documentMode={cat.kind === 'documento'}
              attachments={atts.filter((a) => a.question_id === q.id && !a.nonconformity_id)}
              localPhotos={queued.filter((p) => p.questionId === q.id && !p.nonconformityId)}
              nonconformities={ncs.filter((n) => n.question_id === q.id)}
              highlight={highlight}
              onChange={(patch) => setAnswer(q.id, patch)}
              onAddPhotos={(f) => addPhotos(q.id, f)}
              onDeletePhoto={removePhoto}
              onRegisterNc={() => setNcModal({ open: true, initial: {
                category_id: cat.id, question_id: q.id,
                severity: answers[q.id]?.is_critical ? 'critica' : (answers[q.id]?.score ?? 5) <= 1 ? 'grave' : 'moderada',
                description: answers[q.id]?.observation ?? '',
                recommended_action: answers[q.id]?.recommendation ?? '',
              } })}
              onOpenNc={(n) => setNcModal({ open: true, initial: n })} />
          ))}

          <div className="sticky-actions sticky bottom-20 z-10 grid grid-cols-2 gap-2 lg:bottom-4">
            <button className="btn-outline py-3.5 shadow-sm" onClick={() => (view > 0 ? goCategory(view - 1) : setView('indice'))}>
              <ArrowLeft className="h-4 w-4" /> {view > 0 ? 'Anterior' : 'Índice'}
            </button>
            {view < categories.length - 1 ? (
              <button className="btn-primary py-3.5 shadow-lg" onClick={() => goCategory(view + 1)}>Siguiente <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <button className="btn-primary py-3.5 shadow-lg" onClick={() => { setView('cierre'); window.scrollTo({ top: 0 }); }}>Finalizar <Flag className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      )}

      {view === 'cierre' && (
        <div className="space-y-4">
          <button className="btn-ghost -ml-2 px-2 text-sm" onClick={() => setView('indice')}><LayoutList className="h-4 w-4" /> Volver a las categorías</button>
          <Card title="Resultado provisional">
            <div className="flex flex-wrap items-end gap-4">
              <div className="font-serif text-5xl font-semibold tabular-nums" style={{ color: scoreColor(score.final_score) }}>{fmtScore(score.final_score)}<span className="text-lg text-cafe-400">/100</span></div>
              <ClassBadge classification={score.classification} />
            </div>
            {score.redistributed && <p className="mt-2 text-xs text-cafe-500">Hay categorías no aplicables: sus ponderaciones se redistribuyen proporcionalmente entre las aplicables.</p>}
            {(ncs.some((n) => n.severity === 'critica') || Object.values(answers).some((a) => a.is_critical)) && (
              <div className="mt-3"><Notice tone="warn"><strong>Irregularidad crítica registrada.</strong> Se generará una alerta independiente del puntaje final.</Notice></div>
            )}
            <p className="mt-3 text-xs text-cafe-400">El puntaje definitivo lo calcula el servidor al finalizar, con la versión del cuestionario y las ponderaciones de esta auditoría.</p>
          </Card>

          {score.errors.length > 0 ? (
            <Card title="Pendientes para finalizar">
              <ul className="space-y-1.5 text-sm">
                {score.errors.map((e, i) => {
                  const idx = categories.findIndex((c) => c.name === e.category);
                  return (
                    <li key={i}>
                      <button className="flex w-full items-center gap-2 rounded-lg bg-[#b07a1e]/5 px-3 py-2 text-left" onClick={() => { setHighlight(true); goCategory(idx); }}>
                        <AlertTriangle className="h-4 w-4 shrink-0 text-[#b07a1e]" />
                        <span><strong>{e.category}:</strong> {e.error}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : <Notice tone="ok">Todos los controles están completos.</Notice>}

          <Card title="Cierre del auditor">
            <div className="space-y-3">
              <Field label="Conclusión del auditor"><Textarea rows={4} value={conclusion} onChange={(e) => { setConclusion(e.target.value); sync.queueAudit({ conclusion: e.target.value }); }} /></Field>
              <Field label="Recomendaciones generales"><Textarea rows={4} value={recommendations} onChange={(e) => { setRecommendations(e.target.value); sync.queueAudit({ recommendations: e.target.value }); }} /></Field>
            </div>
          </Card>

          <Card title={`Incumplimientos registrados (${ncs.length})`} action={<button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setNcModal({ open: true, initial: null })}>+ Registrar</button>}>
            {ncs.length === 0 ? <p className="text-sm text-cafe-500">Sin incumplimientos registrados.</p> : (
              <ul className="divide-y divide-cafe-800/5 text-sm">
                {ncs.map((n) => (
                  <li key={n.id}><button className="flex w-full justify-between gap-2 py-2 text-left" onClick={() => setNcModal({ open: true, initial: n })}>
                    <span>{n.description}</span><span className="shrink-0 text-xs font-semibold text-[#a33b2b]">{n.severity}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </Card>

          <ErrorBox>{err}</ErrorBox>
          <button className="btn-primary w-full py-4 text-base" onClick={tryFinalize} disabled={finalizing}>
            <CheckCircle2 className="h-5 w-5" /> FINALIZAR AUDITORÍA
          </button>
          <button className="btn-ghost w-full text-sm" onClick={() => nav('/')}>Guardar borrador y salir</button>
        </div>
      )}

      {view !== 'cierre' && err && <div className="mt-4"><ErrorBox>{err}</ErrorBox></div>}

      <NcModal open={ncModal.open} onClose={() => setNcModal({ open: false, initial: null })} branchId={audit.branch_id} branchName={branchName}
        auditId={audit.id} categories={categories} initial={ncModal.initial} onSaved={onNcSaved} offlineQueue={sync.queueNc} />

      <Modal open={confirm} onClose={() => !finalizing && setConfirm(false)} title="Confirmar finalización"
        footer={<>
          <button className="btn-ghost" onClick={() => setConfirm(false)} disabled={finalizing}>Cancelar</button>
          <button className="btn-primary" onClick={finalize} disabled={finalizing}>{finalizing ? <><Loader2 className="h-4 w-4 animate-spin" /> Finalizando…</> : 'Finalizar definitivamente'}</button>
        </>}>
        <div className="space-y-3 text-sm text-cafe-700">
          <p>Va a finalizar la auditoría de <strong>{branchName}</strong> del {fmtDate(audit.visit_date)} con un resultado provisional de <strong>{fmtScore(score.final_score)}</strong> puntos.</p>
          <p>Una vez finalizada, la auditoría no podrá modificarse salvo mediante una corrección autorizada por la administración, que conserva la versión anterior.</p>
          {brand.receipt_enabled && <p className="text-xs text-cafe-500">El franquiciado podrá dejar constancia de recepción del informe.</p>}
          <p className="text-xs text-cafe-400">Registro creado: {fmtDateTime(audit.created_at)}</p>
        </div>
      </Modal>
    </div>
  );
}
