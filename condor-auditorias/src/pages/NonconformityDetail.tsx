import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Pencil, RotateCcw } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { loadQuestionnaire } from '../lib/api';
import { uploadEvidence, deleteAttachment } from '../lib/files';
import { ALERT_TYPE_LABEL, NC_STATUS_LABEL, fmtDate, fmtDateTime, todayISO } from '../lib/format';
import type { Attachment, Category, NcEvent, NcStatus, Nonconformity } from '../lib/types';
import { NcModal } from '../components/NcModal';
import { PhotoGrid, PhotoPickerButtons } from '../components/Photos';
import { Card, ErrorBox, Field, Input, Loading, NcStatusBadge, Notice, PageHeader, Select, SeverityBadge, Textarea, isOverdue } from '../components/ui';

export default function NonconformityDetail() {
  const { id } = useParams();
  const { profile, isStaff, isAdmin } = useSession();
  const [nc, setNc] = useState<Nonconformity | null>(null);
  const [events, setEvents] = useState<NcEvent[]>([]);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [edit, setEdit] = useState(false);
  const [comment, setComment] = useState('');
  const [newStatus, setNewStatus] = useState<NcStatus | ''>('');
  const [correctedAt, setCorrectedAt] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('nonconformities').select('*, branches(name), categories(name, version_id), questions(text), audits(visit_date, report_number, status, version_id)').eq('id', id).maybeSingle();
    if (!data) { setMissing(true); return; }
    setNc(data as Nonconformity);
    const [{ data: ev }, { data: at }] = await Promise.all([
      supabase.from('nonconformity_events').select('*').eq('nonconformity_id', id).order('created_at'),
      supabase.from('attachments').select('*').eq('nonconformity_id', id).order('created_at'),
    ]);
    setEvents((ev as NcEvent[]) ?? []);
    setAtts((at as Attachment[]) ?? []);
    const versionId = (data as { audits?: { version_id: string } | null; categories?: { version_id: string } | null }).audits?.version_id
      ?? (data as { categories?: { version_id: string } | null }).categories?.version_id;
    if (versionId) loadQuestionnaire(versionId).then(setCats);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (missing) return <div className="py-10"><ErrorBox>Incumplimiento inexistente o sin acceso.</ErrorBox></div>;
  if (!nc) return <Loading />;

  const isFr = profile!.role === 'franquiciado';
  const closed = nc.status === 'cerrado';

  const act = async (fn: () => Promise<{ error: unknown }>) => {
    setBusy(true); setErr(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setErr(friendlyError(error)); return false; }
    setComment(''); setNewStatus('');
    await load();
    return true;
  };

  const franchiseeReport = (status: 'en_proceso' | 'corregido') => act(async () => await supabase.rpc('franchisee_update_nc', { p_nc: nc.id, p_status: status, p_comment: comment || null, p_corrected_at: status === 'corregido' ? correctedAt : null }));
  const staffStatus = () => act(async () => await supabase.from('nonconformities').update({ status: newStatus, correction_comment: comment || null, ...(newStatus === 'corregido' ? { corrected_at: correctedAt } : {}) }).eq('id', nc.id));
  const verifyClose = () => act(async () => await supabase.from('nonconformities').update({ status: 'cerrado', correction_comment: comment || 'Verificado por el auditor' }).eq('id', nc.id));
  const addComment = () => act(async () => await supabase.from('nonconformity_events').insert({ nonconformity_id: nc.id, author_id: profile!.id, author_name: profile!.full_name || profile!.email, comment }));
  const reopen = () => act(async () => await supabase.from('nonconformities').update({ status: 'pendiente', correction_comment: comment || 'Reabierto por la administración' }).eq('id', nc.id));

  const upload = async (files: File[]) => {
    setBusy(true); setErr(null);
    try {
      for (const f of files) {
        await uploadEvidence(f, { branchId: nc.branch_id, nonconformityId: nc.id, kind: isFr ? 'evidencia_correccion' : 'foto', fileName: f.name });
      }
      if (isFr) await supabase.from('nonconformity_events').insert({ nonconformity_id: nc.id, author_id: profile!.id, author_name: profile!.full_name || profile!.email, comment: `Adjuntó ${files.length} evidencia(s) de corrección` });
      await load();
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };

  const before = atts.filter((a) => a.kind !== 'evidencia_correccion');
  const after = atts.filter((a) => a.kind === 'evidencia_correccion');

  return (
    <div className="fade-in mx-auto max-w-4xl space-y-5">
      <Link to="/incumplimientos" className="btn-ghost -ml-2 px-2 text-sm"><ArrowLeft className="h-4 w-4" /> Seguimiento</Link>
      <PageHeader eyebrow={`${nc.branches?.name} · ${nc.categories?.name ?? 'General'}`} title={nc.description}
        actions={isStaff && !closed && <button className="btn-outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Editar</button>} />
      <div className="flex flex-wrap gap-2"><SeverityBadge s={nc.severity} /><NcStatusBadge s={nc.status} overdue={isOverdue(nc.due_date, nc.status)} />{nc.alert_type && <span className="chip bg-[#a33b2b]/10 text-[#a33b2b]">{ALERT_TYPE_LABEL[nc.alert_type]}</span>}</div>

      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-cafe-500">Pregunta relacionada</dt><dd>{nc.questions?.text ?? '—'}</dd></div>
          <div><dt className="text-xs text-cafe-500">Auditoría</dt><dd>{nc.audit_id ? <Link className="text-brand-accent" to={`/auditorias/${nc.audit_id}`}>{nc.audits?.report_number ?? 'Borrador'} · {fmtDate(nc.audits?.visit_date)}</Link> : 'Registrado fuera de auditoría'}</dd></div>
          <div><dt className="text-xs text-cafe-500">Acción correctiva recomendada</dt><dd>{nc.recommended_action || '—'}</dd></div>
          <div><dt className="text-xs text-cafe-500">Responsable asignado</dt><dd>{nc.responsible || '—'}</dd></div>
          <div><dt className="text-xs text-cafe-500">Fecha límite</dt><dd className={isOverdue(nc.due_date, nc.status) ? 'font-semibold text-[#a33b2b]' : ''}>{fmtDate(nc.due_date)}</dd></div>
          <div><dt className="text-xs text-cafe-500">Atribuible a</dt><dd>{nc.attributable_to === 'franquiciante' ? 'Franquiciante (fábrica / central)' : 'Franquicia'}</dd></div>
          {nc.corrected_at && <div><dt className="text-xs text-cafe-500">Fecha de corrección informada</dt><dd>{fmtDate(nc.corrected_at)}</dd></div>}
          {nc.closed_at && <div><dt className="text-xs text-cafe-500">Fecha de cierre</dt><dd>{fmtDateTime(nc.closed_at)}</dd></div>}
          {nc.notes && <div className="sm:col-span-2"><dt className="text-xs text-cafe-500">Observaciones adicionales</dt><dd>{nc.notes}</dd></div>}
        </dl>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Evidencia del hallazgo">
          {before.length ? <PhotoGrid attachments={before} onDelete={isStaff && !closed && !nc.audits?.status?.includes('finalizada') ? async (a) => { if (window.confirm('¿Eliminar archivo?')) { await deleteAttachment(a); load(); } } : undefined} /> : <p className="text-sm text-cafe-500">Sin fotografías.</p>}
          {isStaff && !closed && <div className="mt-3"><PhotoPickerButtons compact onFiles={upload} disabled={busy} /></div>}
        </Card>
        <Card title="Evidencias de corrección">
          {after.length ? <PhotoGrid attachments={after} /> : <p className="text-sm text-cafe-500">El franquiciado todavía no adjuntó pruebas de corrección.</p>}
          {isFr && !closed && <div className="mt-3"><PhotoPickerButtons compact onFiles={upload} disabled={busy} accept="image/*,application/pdf" /></div>}
        </Card>
      </div>

      {!closed && (
        <Card title={isFr ? 'Informar acción correctiva' : 'Gestionar estado'}>
          <div className="space-y-3">
            <Field label="Comentario"><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={isFr ? 'Describa la corrección realizada' : 'Comentario de seguimiento o verificación'} /></Field>
            {isFr ? (
              <>
                <Field label="Fecha de corrección"><Input type="date" value={correctedAt} max={todayISO()} onChange={(e) => setCorrectedAt(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-outline" disabled={busy || nc.status === 'en_proceso'} onClick={() => franchiseeReport('en_proceso')}>Marcar en proceso</button>
                  <button className="btn-primary" disabled={busy || !comment.trim()} onClick={() => franchiseeReport('corregido')}><CheckCircle2 className="h-4 w-4" /> Informar corregido</button>
                </div>
                <p className="text-xs text-cafe-500">El cierre definitivo lo realiza el auditor o la administración luego de verificar la corrección.</p>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cambiar estado a">
                    <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as NcStatus)}>
                      <option value="">—</option>
                      {(['pendiente', 'en_proceso', 'corregido'] as NcStatus[]).filter((s) => s !== nc.status).map((s) => <option key={s} value={s}>{NC_STATUS_LABEL[s]}</option>)}
                    </Select>
                  </Field>
                  {newStatus === 'corregido' && <Field label="Fecha de corrección"><Input type="date" value={correctedAt} onChange={(e) => setCorrectedAt(e.target.value)} /></Field>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-outline" disabled={busy || !newStatus} onClick={staffStatus}>Actualizar estado</button>
                  <button className="btn-outline" disabled={busy || !comment.trim()} onClick={addComment}>Agregar comentario</button>
                  <button className="btn-primary" disabled={busy} onClick={verifyClose}><CheckCircle2 className="h-4 w-4" /> Verificar y cerrar</button>
                </div>
                {nc.status !== 'corregido' && <Notice tone="warn">Antes de cerrar, verifique la corrección en la sucursal o con las evidencias aportadas.</Notice>}
              </>
            )}
          </div>
        </Card>
      )}
      {closed && isAdmin && (
        <Card><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-cafe-600">Incumplimiento verificado y cerrado.</span><button className="btn-outline" onClick={reopen} disabled={busy}><RotateCcw className="h-4 w-4" /> Reabrir</button></div></Card>
      )}
      <ErrorBox>{err}</ErrorBox>

      <Card title="Historial de cambios">
        <ol className="relative space-y-4 border-l border-cafe-800/10 pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-brand-accent" />
              <div className="text-xs text-cafe-400">{fmtDateTime(e.created_at)} · {e.author_name ?? 'Sistema'}</div>
              {e.to_status && e.from_status !== e.to_status && <div className="text-sm font-semibold">{e.from_status ? `${NC_STATUS_LABEL[e.from_status]} → ` : ''}{NC_STATUS_LABEL[e.to_status]}</div>}
              {e.comment && <div className="text-sm text-cafe-700">{e.comment}</div>}
            </li>
          ))}
        </ol>
      </Card>

      <NcModal open={edit} onClose={() => setEdit(false)} branchId={nc.branch_id} branchName={nc.branches?.name ?? ''} auditId={nc.audit_id} categories={cats} initial={nc} onSaved={() => load()} />
    </div>
  );
}
