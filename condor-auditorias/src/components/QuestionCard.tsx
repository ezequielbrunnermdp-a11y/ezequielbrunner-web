import { memo, useState } from 'react';
import { AlertOctagon, Camera, ChevronDown, FileWarning, ShieldAlert } from 'lucide-react';
import { SCALE, answerState } from '../lib/scoring';
import { DOC_STATUS_LABEL, SEVERITY_LABEL } from '../lib/format';
import type { Answer, Attachment, DocStatus, Nonconformity, Question } from '../lib/types';
import { cx, Input, Select, Textarea } from './ui';
import { PhotoGrid, PhotoPickerButtons, type LocalPhoto } from './Photos';

const SCORE_TONE: Record<number, string> = {
  5: 'bg-[#2f6b4f] text-white ring-[#2f6b4f]',
  4: 'bg-[#5a7a3a] text-white ring-[#5a7a3a]',
  3: 'bg-[#b07a1e] text-white ring-[#b07a1e]',
  2: 'bg-[#c0582b] text-white ring-[#c0582b]',
  1: 'bg-[#a33b2b] text-white ring-[#a33b2b]',
  0: 'bg-[#7a2318] text-white ring-[#7a2318]',
};

export interface QuestionCardProps {
  index: number;
  question: Question;
  answer: Answer | undefined;
  documentMode: boolean;
  attachments: Attachment[];
  localPhotos: LocalPhoto[];
  nonconformities: Nonconformity[];
  readOnly?: boolean;
  onChange: (patch: Partial<Answer>) => void;
  onAddPhotos: (files: File[]) => void;
  onDeletePhoto?: (a: Attachment) => void;
  onRegisterNc: () => void;
  onOpenNc: (nc: Nonconformity) => void;
  highlight?: boolean;
}

function QuestionCardBase(p: QuestionCardProps) {
  const a = p.answer;
  const state = answerState(a);
  const [showRec, setShowRec] = useState(Boolean(a?.recommendation));
  const needsObs = a?.score != null && a.score <= 2;
  const obsMissing = needsObs && !(a?.observation ?? '').trim();
  const naMissing = a?.not_applicable && !(a?.na_reason ?? '').trim();
  const dis = p.readOnly;

  return (
    <article id={`q-${p.question.id}`} className={cx('card scroll-mt-40 p-4 transition sm:p-5',
      p.highlight && state !== 'respondida' && 'ring-2 ring-[#b07a1e]/60',
      a?.is_critical && 'ring-2 ring-[#a33b2b]/50')}>
      <div className="flex items-start gap-3">
        <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          state === 'respondida' ? 'bg-[#2f6b4f]/10 text-[#2f6b4f]' : state === 'incompleta' ? 'bg-[#b07a1e]/15 text-[#8a5e12]' : 'bg-cafe-800/5 text-cafe-500')}>
          {p.index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-cafe-900">{p.question.text}</h3>
          {p.question.guidance && <p className="mt-1 text-xs text-cafe-500">{p.question.guidance}</p>}
          {p.question.critical_control && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#a33b2b]"><ShieldAlert className="h-3.5 w-3.5" /> Control crítico</span>
          )}
        </div>
      </div>

      {/* Escala 0–5 + N/A: un toque */}
      <div className="mt-4 grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Puntaje">
        {SCALE.map((s) => {
          const sel = !a?.not_applicable && a?.score === s.value;
          return (
            <button key={s.value} type="button" role="radio" aria-checked={sel} disabled={dis} title={`${s.value} · ${s.label}`}
              onClick={() => p.onChange({ score: sel ? null : s.value, not_applicable: false, na_reason: null })}
              className={cx('flex h-12 flex-col items-center justify-center rounded-xl text-lg font-bold tabular-nums ring-1 transition active:scale-95 disabled:cursor-default',
                sel ? SCORE_TONE[s.value] : 'bg-white text-cafe-700 ring-cafe-800/15 hover:ring-cafe-800/30')}>
              {s.value}
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={!!a?.not_applicable} disabled={dis}
          onClick={() => p.onChange({ not_applicable: !a?.not_applicable, score: null })}
          className={cx('h-12 rounded-xl text-xs font-bold ring-1 transition active:scale-95',
            a?.not_applicable ? 'bg-cafe-700 text-white ring-cafe-700' : 'bg-white text-cafe-600 ring-cafe-800/15')}>
          N/A
        </button>
      </div>
      <div className="mt-1.5 h-4 text-xs text-cafe-500">
        {a?.not_applicable ? 'No aplica' : a?.score != null ? SCALE.find((s) => s.value === a.score)?.label : 'Pendiente de calificar'}
      </div>

      {p.documentMode && !a?.not_applicable && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Select disabled={dis} value={a?.doc_status ?? ''} onChange={(e) => p.onChange({ doc_status: (e.target.value || null) as DocStatus | null })}>
            <option value="">Estado de la documentación…</option>
            {(Object.keys(DOC_STATUS_LABEL) as DocStatus[]).map((d) => <option key={d} value={d}>{DOC_STATUS_LABEL[d]}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm text-cafe-600">
            <span className="whitespace-nowrap">Vencimiento</span>
            <Input type="date" disabled={dis} value={a?.doc_expiry ?? ''} onChange={(e) => p.onChange({ doc_expiry: e.target.value || null })} />
          </label>
          {a?.doc_status === 'pendiente' && <p className="text-xs text-cafe-500 sm:col-span-2">Pendiente de verificar: la documentación no fue aportada durante la visita; no implica necesariamente su inexistencia.</p>}
        </div>
      )}

      {a?.not_applicable && (
        <div className="mt-3">
          <Textarea rows={2} disabled={dis} value={a.na_reason ?? ''} placeholder="Justifique por qué no aplica (obligatorio)"
            onChange={(e) => p.onChange({ na_reason: e.target.value })}
            className={cx(naMissing && 'border-[#b07a1e] ring-2 ring-[#b07a1e]/20')} />
        </div>
      )}

      <div className="mt-3">
        <Textarea rows={2} disabled={dis} value={a?.observation ?? ''}
          placeholder={needsObs ? 'Observación obligatoria para puntajes de 0 a 2' : 'Observaciones'}
          onChange={(e) => p.onChange({ observation: e.target.value })}
          className={cx(obsMissing && 'border-[#b07a1e] ring-2 ring-[#b07a1e]/20')} />
        {obsMissing && <p className="mt-1 text-xs font-medium text-[#8a5e12]">Escriba una observación: es obligatoria con 0, 1 o 2 puntos.</p>}
      </div>

      {(showRec || a?.recommendation) && (
        <div className="mt-2">
          <Textarea rows={2} disabled={dis} value={a?.recommendation ?? ''} placeholder="Recomendaciones" onChange={(e) => p.onChange({ recommendation: e.target.value })} />
        </div>
      )}

      <PhotoGridWrap {...p} />

      {p.nonconformities.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {p.nonconformities.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => p.onOpenNc(n)} className="flex w-full items-center gap-2 rounded-lg bg-[#a33b2b]/5 px-3 py-2 text-left text-xs text-[#7a2318]">
                <FileWarning className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{n.description}</span>
                <span className="font-semibold">{SEVERITY_LABEL[n.severity]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!dis && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cafe-800/5 pt-3">
          <PhotoPickerButtons compact onFiles={p.onAddPhotos} />
          <button type="button" className="btn-outline px-3 py-2 text-xs" onClick={p.onRegisterNc}>
            <AlertOctagon className="h-4 w-4" /> Incumplimiento / acción correctiva
          </button>
          <button type="button" className={cx('btn px-3 py-2 text-xs ring-1', a?.is_critical ? 'bg-[#a33b2b] text-white ring-[#a33b2b]' : 'bg-white text-[#a33b2b] ring-[#a33b2b]/30')}
            onClick={() => p.onChange({ is_critical: !a?.is_critical })} aria-pressed={!!a?.is_critical}>
            <ShieldAlert className="h-4 w-4" /> {a?.is_critical ? 'Crítico marcado' : 'Marcar crítico'}
          </button>
          {!showRec && !a?.recommendation && (
            <button type="button" className="btn-ghost px-2 py-2 text-xs" onClick={() => setShowRec(true)}>
              <ChevronDown className="h-4 w-4" /> Recomendación
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function PhotoGridWrap(p: QuestionCardProps) {
  if (!p.attachments.length && !p.localPhotos.length) return null;
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-cafe-500"><Camera className="h-3.5 w-3.5" /> Evidencia fotográfica</div>
      <PhotoGrid attachments={p.attachments} local={p.localPhotos} onDelete={p.readOnly ? undefined : p.onDeletePhoto} size="sm" />
    </div>
  );
}

export const QuestionCard = memo(QuestionCardBase);
