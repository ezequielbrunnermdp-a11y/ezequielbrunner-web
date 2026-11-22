import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useContent } from '../../storage/store';
import { Feedback } from '../../components/ui';
import { recordPractice } from '../practice/recordPractice';
import type { CodeRecord } from '../../content/types';

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

/** Elige un código y tres alternativas del mismo rubro, para practicar distinguir productos parecidos. */
function pickRound(codes: CodeRecord[]) {
  const target = codes[Math.floor(Math.random() * codes.length)];
  const sameCat = codes.filter((c) => c.code !== target.code && c.category === target.category);
  const pool = sameCat.length >= 3 ? sameCat : codes.filter((c) => c.code !== target.code);
  const options = shuffle([target, ...shuffle(pool).slice(0, 3)]);
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
      <p className="small muted">Las alternativas son del mismo rubro, para practicar cómo distinguir productos parecidos.</p>
      <p>¿Qué producto corresponde al código <strong className="kbd" style={{ fontSize: '1rem' }}>{round.target.code}</strong>?{round.target.category && <span className="small muted"> · Rubro: {round.target.category}</span>}</p>
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
