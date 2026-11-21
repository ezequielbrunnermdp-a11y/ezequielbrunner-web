import { useEffect, useState } from 'react';
import { supabase, friendlyError } from '../lib/supabase';
import { ALERT_TYPE_LABEL, SEVERITY_LABEL } from '../lib/format';
import type { AlertType, Category, Nonconformity, Severity } from '../lib/types';
import type { NcDraft } from '../lib/offline';
import { ErrorBox, Field, Input, Modal, Notice, Select, Textarea } from './ui';
import { PhotoPickerButtons } from './Photos';

export interface NcModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  auditId: string | null;
  categories: Category[];
  initial?: Partial<Nonconformity> | null;
  /** Guardado (en línea o en cola local). Devuelve fotos adjuntas para encolar. */
  onSaved: (nc: NcDraft, photos: File[], isNew: boolean) => Promise<void> | void;
  offlineQueue?: (nc: NcDraft) => Promise<void>;
  /** Para incumplimientos fuera de una auditoría: permite elegir la sucursal. */
  branchOptions?: { id: string; name: string }[];
}

export function NcModal({ open, onClose, branchId, branchName, auditId, categories, initial, onSaved, offlineQueue, branchOptions }: NcModalProps) {
  const [branch, setBranch] = useState(branchId);
  const isNew = !initial?.id;
  const [categoryId, setCategoryId] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('moderada');
  const [alertType, setAlertType] = useState<AlertType | ''>('');
  const [attrib, setAttrib] = useState<'franquicia' | 'franquiciante'>('franquicia');
  const [action, setAction] = useState('');
  const [responsible, setResponsible] = useState('');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategoryId(initial?.category_id ?? '');
    setQuestionId(initial?.question_id ?? '');
    setDescription(initial?.description ?? '');
    setSeverity(initial?.severity ?? 'moderada');
    setAlertType(initial?.alert_type ?? '');
    setAttrib(initial?.attributable_to ?? 'franquicia');
    setAction(initial?.recommended_action ?? '');
    setResponsible(initial?.responsible ?? '');
    setDue(initial?.due_date ?? '');
    setNotes(initial?.notes ?? '');
    setPhotos([]);
    setErr(null);
    setBranch(initial?.branch_id ?? branchId);
  }, [open, initial, branchId]);

  const cat = categories.find((c) => c.id === categoryId);

  const save = async () => {
    if (!branch) return setErr('Seleccione la sucursal.');
    if (!description.trim()) return setErr('Describa el incumplimiento.');
    if (severity === 'critica' && !alertType) return setErr('Indique el tipo de riesgo de la alerta crítica.');
    setBusy(true);
    setErr(null);
    const nc: NcDraft = {
      id: initial?.id ?? crypto.randomUUID(),
      audit_id: auditId,
      branch_id: branch,
      category_id: categoryId || null,
      question_id: questionId || null,
      description: description.trim(),
      severity,
      alert_type: alertType || null,
      attributable_to: attrib,
      recommended_action: action || null,
      responsible: responsible || null,
      due_date: due || null,
      notes: notes || null,
    };
    try {
      if (isNew) {
        if (!navigator.onLine && offlineQueue) {
          await offlineQueue(nc);
        } else {
          const { error } = await supabase.from('nonconformities').insert(nc);
          if (error) throw error;
        }
      } else {
        const { id, ...patch } = nc;
        const { error } = await supabase.from('nonconformities').update(patch).eq('id', id);
        if (error) throw error;
      }
      await onSaved(nc, photos, isNew);
      onClose();
    } catch (e) {
      const msg = friendlyError(e);
      if (isNew && offlineQueue && /conexión/i.test(msg)) {
        await offlineQueue(nc);
        await onSaved(nc, photos, isNew);
        onClose();
      } else setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Registrar incumplimiento' : 'Editar incumplimiento'} wide
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar incumplimiento'}</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sucursal">
          {branchOptions && isNew ? (
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Seleccionar…</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          ) : <Input value={branchName} disabled />}
        </Field>
        <Field label="Gravedad *">
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Categoría">
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setQuestionId(''); }}>
            <option value="">— Sin categoría —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.position}. {c.name}</option>)}
          </Select>
        </Field>
        <Field label="Pregunta relacionada">
          <Select value={questionId} onChange={(e) => setQuestionId(e.target.value)} disabled={!cat}>
            <option value="">— Ninguna —</option>
            {cat?.questions.map((q) => <option key={q.id} value={q.id}>{q.position}. {q.text}</option>)}
          </Select>
        </Field>
        <Field label="Descripción *" className="sm:col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué se observó, dónde y en qué condiciones" />
        </Field>
        {severity === 'critica' && (
          <div className="sm:col-span-2 space-y-2">
            <Notice tone="warn">Un incumplimiento crítico genera una alerta inmediata visible en el panel, independiente del puntaje final.</Notice>
            <Field label="Tipo de riesgo *">
              <Select value={alertType} onChange={(e) => setAlertType(e.target.value as AlertType)}>
                <option value="">Seleccionar…</option>
                {(Object.keys(ALERT_TYPE_LABEL) as AlertType[]).filter((t) => t !== 'reiteracion' && t !== 'accion_vencida').map((t) => <option key={t} value={t}>{ALERT_TYPE_LABEL[t]}</option>)}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Atribuible a">
          <Select value={attrib} onChange={(e) => setAttrib(e.target.value as 'franquicia' | 'franquiciante')}>
            <option value="franquicia">Franquicia (sucursal)</option>
            <option value="franquiciante">Franquiciante (fábrica / central)</option>
          </Select>
        </Field>
        <Field label="Responsable asignado"><Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nombre o función" /></Field>
        <Field label="Acción correctiva recomendada" className="sm:col-span-2">
          <Textarea value={action} onChange={(e) => setAction(e.target.value)} rows={2} />
        </Field>
        <Field label="Fecha límite"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label="Observaciones adicionales"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {isNew && (
          <div className="sm:col-span-2">
            <span className="label">Fotografías</span>
            <PhotoPickerButtons onFiles={(f) => setPhotos((p) => [...p, ...f])} compact />
            {photos.length > 0 && <div className="mt-2 text-xs text-cafe-500">{photos.length} foto(s) seleccionada(s)</div>}
          </div>
        )}
      </div>
      <ErrorBox>{err}</ErrorBox>
    </Modal>
  );
}
