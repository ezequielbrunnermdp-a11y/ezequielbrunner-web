import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useContent } from '../../storage/store';
import { Feedback } from '../../components/ui';
import { recordPractice } from '../practice/recordPractice';
import type { CodeRecord } from '../../content/types';

function pickRound(codes: CodeRecord[]) {
  const shuffled = [...codes].sort(() => Math.random() - 0.5);
  const target = shuffled[0];
  const options = shuffled.slice(0, Math.min(4, shuffled.length)).sort(() => Math.random() - 0.5);
  return { target, options };
}

/** Asociación código ↔ producto. Solo se activa con al menos cuatro códigos válidos cargados. */
export function CodePractice() {
  const { codes } = useContent();
  const [seed, setSeed] = useState(0);
  const round = useMemo(() => (codes.length >= 4 ? pickRound(codes) : null), [codes, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState<string | null>(null);
  if (!round) return null;
  const label = (c: CodeRecord) => `${c.name}${c.variant ? ` · ${c.variant}` : ''}`;
  return (
    <div>
      <h4>Práctica de códigos del catálogo cargado</h4>
      <p>¿Qué producto corresponde al código <strong className="kbd" style={{ fontSize: '1rem' }}>{round.target.code}</strong>?</p>
      <div className="options">
        {round.options.map((o, i) => {
          const isRight = o.code === round.target.code;
          return (
            <button key={o.code} type="button" disabled={!!pick} className={`option${pick ? (isRight ? ' is-correct' : pick === o.code ? ' is-wrong' : '') : ''}`}
              onClick={() => { setPick(o.code); recordPractice('codes-practice', isRight ? 'Código asociado correctamente' : 'Código asociado con error', isRight); }}>
              <span className="key" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{label(o)}</span>
              {pick && isRight && <span className="state"><CheckCircle2 aria-hidden="true" />Correcto</span>}
              {pick === o.code && !isRight && <span className="state"><XCircle aria-hidden="true" />Tu elección</span>}
            </button>
          );
        })}
      </div>
      {pick && (
        <>
          <Feedback tone={pick === round.target.code ? 'ok' : 'err'} title={pick === round.target.code ? 'Asociación correcta' : 'No coincide'}>
            <p>{round.target.code} corresponde a {label(round.target)}. Antes de usarlo, confirmá que siga vigente en el catálogo del local.</p>
          </Feedback>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setPick(null); setSeed((s) => s + 1); }}><RefreshCw aria-hidden="true" />Otro código</button>
          </div>
        </>
      )}
    </div>
  );
}
