import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Clock, AlertTriangle, PlayCircle } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { listStaff } from '../lib/api';
import { AUDIT_TYPE_LABEL, fmtDate, nowTime, todayISO, SEVERITY_LABEL } from '../lib/format';
import type { Audit, AuditType, Nonconformity } from '../lib/types';
import { Card, ClassBadge, ErrorBox, Field, Input, NcStatusBadge, PageHeader, ScorePill, Select, Spinner, Textarea, isOverdue } from '../components/ui';

interface Followup { text: string; score: number | null; observation: string | null; category: string }

export default function NewAudit() {
  const { profile, branches, isAdmin } = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const active = branches.filter((b) => b.active);
  const [branchId, setBranchId] = useState(params.get('sucursal') ?? '');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [auditorId, setAuditorId] = useState(profile!.id);
  const [manager, setManager] = useState('');
  const [type, setType] = useState<AuditType>('programada');
  const [notes, setNotes] = useState('');
  const [staff, setStaff] = useState<{ id: string; full_name: string; email: string; role: string; active: boolean }[]>([]);
  const [last, setLast] = useState<Audit | null>(null);
  const [pending, setPending] = useState<Nonconformity[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [drafts, setDrafts] = useState<Audit[]>([]);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (isAdmin) listStaff().then((s) => setStaff(s.filter((x) => x.active)));
    supabase.from('audits').select('*, branches(name)').eq('status', 'borrador').eq('auditor_id', profile!.id).order('updated_at', { ascending: false })
      .then(({ data }) => setDrafts((data as Audit[]) ?? []));
  }, [isAdmin, profile]);

  useEffect(() => {
    if (!branchId) { setLast(null); setPending([]); setFollowups([]); return; }
    let alive = true;
    setLoadingCtx(true);
    (async () => {
      const { data: la } = await supabase.from('audits').select('*').eq('branch_id', branchId).eq('status', 'finalizada')
        .order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: nc } = await supabase.from('nonconformities').select('*').eq('branch_id', branchId).neq('status', 'cerrado').order('due_date');
      let fu: Followup[] = [];
      if (la) {
        const { data: ans } = await supabase.from('audit_answers').select('score, observation, questions(text, categories(name))')
          .eq('audit_id', la.id).lte('score', 2).order('score');
        fu = ((ans ?? []) as unknown as { score: number; observation: string | null; questions: { text: string; categories: { name: string } } }[])
          .map((a) => ({ text: a.questions.text, score: a.score, observation: a.observation, category: a.questions.categories.name }));
      }
      if (!alive) return;
      setLast((la as Audit) ?? null);
      setPending((nc as Nonconformity[]) ?? []);
      setFollowups(fu);
      setLoadingCtx(false);
    })();
    return () => { alive = false; };
  }, [branchId]);

  const branchDrafts = useMemo(() => drafts.filter((d) => d.branch_id === branchId), [drafts, branchId]);

  const start = async () => {
    setTried(true);
    if (!branchId || !date) return;
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.from('audits').insert({
        branch_id: branchId,
        auditor_id: auditorId,
        visit_date: date,
        start_time: time || null,
        manager_present: manager || null,
        audit_type: type,
        initial_notes: notes || null,
      }).select('id').single();
      if (error) throw error;
      nav(`/auditorias/${data.id}`, { replace: true });
    } catch (e) {
      setErr(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <PageHeader eyebrow="Auditoría" title="Nueva auditoría" subtitle="Complete los datos de la visita y comience el cuestionario." />

      {drafts.length > 0 && (
        <Card className="mb-5" title="Borradores en curso">
          <div className="divide-y divide-cafe-800/5">
            {drafts.map((d) => (
              <Link key={d.id} to={`/auditorias/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-accent">
                <span><strong>{d.branches?.name}</strong> · visita {fmtDate(d.visit_date)}</span>
                <span className="flex items-center gap-1 font-semibold text-brand-accent"><PlayCircle className="h-4 w-4" /> Continuar</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sucursal *" className="sm:col-span-2" error={tried && !branchId ? 'Seleccione la sucursal a auditar.' : null}>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="py-3 text-base">
              <option value="">Seleccionar sucursal…</option>
              {active.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Fecha de la visita *" error={tried && !date ? 'Indique la fecha.' : null}>
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora de inicio">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Auditor responsable">
            {isAdmin ? (
              <Select value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
                {[profile!, ...staff.filter((s) => s.id !== profile!.id)].map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
              </Select>
            ) : <Input value={profile!.full_name || profile!.email} disabled />}
          </Field>
          <Field label="Tipo de auditoría">
            <Select value={type} onChange={(e) => setType(e.target.value as AuditType)}>
              {(Object.keys(AUDIT_TYPE_LABEL) as AuditType[]).map((t) => <option key={t} value={t}>{AUDIT_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Encargado presente" className="sm:col-span-2">
            <Input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Nombre y función" />
          </Field>
          <Field label="Observaciones iniciales" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones de la visita, motivo, contexto…" />
          </Field>
        </div>
        <p className="mt-3 text-xs text-cafe-400">La fecha de la visita y el momento real de creación del registro se almacenan por separado.</p>
      </Card>

      {branchId && (
        <Card className="mt-5" title="Antecedentes de la sucursal">
          {loadingCtx ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-crema-100 p-3">
                  <div className="text-xs text-cafe-500">Última auditoría</div>
                  <div className="mt-1 font-semibold">{last ? fmtDate(last.visit_date) : 'Sin registros'}</div>
                </div>
                <div className="rounded-xl bg-crema-100 p-3">
                  <div className="text-xs text-cafe-500">Puntaje anterior</div>
                  <div className="mt-1 flex items-center gap-2"><ScorePill score={last?.final_score} classification={last?.classification} />{last && <ClassBadge classification={last.classification} />}</div>
                </div>
                <div className="rounded-xl bg-crema-100 p-3">
                  <div className="text-xs text-cafe-500">Incumplimientos pendientes</div>
                  <div className="mt-1 font-semibold">{pending.length}</div>
                </div>
              </div>
              {branchDrafts.length > 0 && (
                <div className="rounded-xl border border-[#b07a1e]/30 bg-[#b07a1e]/5 p-3 text-sm">
                  Ya tiene un borrador para esta sucursal. <Link className="font-semibold underline" to={`/auditorias/${branchDrafts[0].id}`}>Continuarlo</Link>
                </div>
              )}
              {pending.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cafe-800"><AlertTriangle className="h-4 w-4 text-[#a33b2b]" /> Incumplimientos a verificar</div>
                  <ul className="space-y-2">
                    {pending.slice(0, 12).map((n) => (
                      <li key={n.id} className="rounded-xl border border-cafe-800/10 bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{n.description}</span>
                          <NcStatusBadge s={n.status} overdue={isOverdue(n.due_date, n.status)} />
                        </div>
                        <div className="mt-1 text-xs text-cafe-500">{SEVERITY_LABEL[n.severity]} · límite {fmtDate(n.due_date)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {followups.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cafe-800"><Clock className="h-4 w-4 text-brand-accent" /> Observaciones de la visita anterior para verificar nuevamente</div>
                  <ul className="space-y-1.5 text-sm">
                    {followups.slice(0, 15).map((f, i) => (
                      <li key={i} className="rounded-lg bg-crema-100 px-3 py-2">
                        <span className="font-semibold">{f.score} pts</span> · {f.text}
                        <div className="text-xs text-cafe-500">{f.category}{f.observation ? ` — ${f.observation}` : ''}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!last && pending.length === 0 && <p className="text-sm text-cafe-500">Esta sucursal no tiene auditorías finalizadas ni incumplimientos abiertos.</p>}
            </div>
          )}
        </Card>
      )}

      <div className="mt-5"><ErrorBox>{err}</ErrorBox></div>
      <div className="sticky bottom-20 z-10 mt-5 lg:bottom-4">
        <button className="btn-primary w-full py-4 text-base tracking-wide shadow-lg" onClick={start} disabled={busy}>
          {busy ? <Spinner className="h-5 w-5 text-crema-50" /> : <ClipboardCheck className="h-5 w-5" />}
          COMENZAR AUDITORÍA
        </button>
      </div>
    </div>
  );
}
