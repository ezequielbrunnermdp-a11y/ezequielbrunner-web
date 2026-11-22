import { useState } from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, RotateCcw, XCircle, HelpCircle } from 'lucide-react';
import { SCENARIO_BY_ID } from '../../content/scenarios';
import { Feedback } from '../../components/ui';
import { recordPractice } from './recordPractice';
import { MODULE_BY_ID } from '../../content/modules';

const QUALITY = {
  best: { cls: 'is-correct', label: 'Decisión esperada', tone: 'ok' as const, Icon: CheckCircle2 },
  partial: { cls: 'is-partial', label: 'Resuelve a medias', tone: 'partial' as const, Icon: AlertTriangle },
  poor: { cls: 'is-wrong', label: 'Genera un problema', tone: 'err' as const, Icon: XCircle },
};

/** Casos con decisiones: cada paso muestra la consecuencia y permite reintentar hasta la decisión esperada. */
export function ScenarioPlayer({ scenarioId, practiceIds, href }: { scenarioId: string; practiceIds: string[]; href: string }) {
  const sc = SCENARIO_BY_ID[scenarioId];
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  if (!sc) return <p>Caso no encontrado.</p>;
  const st = sc.steps[step];
  const selected = st.choices.find((c) => c.id === choice);

  const pick = (id: string) => {
    if (choice) return;
    setChoice(id);
    const c = st.choices.find((x) => x.id === id)!;
    setTried((t) => ({ ...t, [st.id]: (t[st.id] ?? 0) + 1 }));
    if (firstTry[st.id] === undefined) setFirstTry((f) => ({ ...f, [st.id]: c.quality === 'best' }));
  };

  const next = () => {
    if (step < sc.steps.length - 1) { setStep(step + 1); setChoice(null); return; }
    const good = sc.steps.filter((s) => firstTry[s.id]).length;
    const result = `${good} de ${sc.steps.length} decisión(es) esperada(s) al primer intento`;
    practiceIds.forEach((pid) => recordPractice(pid, result, true, `Caso: ${sc.title}`, href));
    setFinished(true);
  };

  const restart = () => { setStep(0); setChoice(null); setFirstTry({}); setTried({}); setFinished(false); };

  if (finished) {
    const good = sc.steps.filter((s) => firstTry[s.id]).length;
    return (
      <div className="fade-in">
        <Feedback tone={good === sc.steps.length ? 'ok' : 'partial'} title={`Caso resuelto · ${good} de ${sc.steps.length} al primer intento`}>
          <p><strong>Qué se resolvió:</strong> {sc.resolved}</p>
        </Feedback>
        <div className="stack" style={{ marginTop: 16 }}>
          <div><h4>Decisión esperada</h4><p>{sc.expected}</p></div>
          <div><h4>Por qué</h4><p>{sc.explanation}</p></div>
          <div>
            <h4>Qué falta consultar en El Cóndor</h4>
            <ul>{sc.stillToCheck.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={restart}><RotateCcw aria-hidden="true" />Practicar de nuevo</button>
            <a className="btn btn-ghost" href={`#/aprender/${sc.moduleId}`}>Ir al módulo {MODULE_BY_ID[sc.moduleId].number}</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {sc.steps.length > 1 && (
        <div className="row-between" style={{ marginBottom: 12 }}>
          <span className="small muted">Paso {step + 1} de {sc.steps.length}</span>
          <span className="steps-dots" aria-hidden="true">
            {sc.steps.map((s, i) => <span key={s.id} className={i < step ? 'done' : i === step ? 'current' : ''} />)}
          </span>
        </div>
      )}
      <div className="scenario-step">
        {step === 0 && <p className="muted">{sc.context}</p>}
        <p><strong>{st.situation}</strong></p>
        <p>{st.prompt}</p>
      </div>
      <div className="options" role="group" aria-label="Opciones de decisión">
        {st.choices.map((c, i) => {
          const isSel = choice === c.id;
          const q = QUALITY[c.quality];
          return (
            <button key={c.id} type="button" className={`option${isSel ? ` ${q.cls}` : ''}`} onClick={() => pick(c.id)} disabled={!!choice} aria-pressed={isSel}>
              <span className="key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
              <span>{c.text}</span>
              {isSel && <span className="state"><q.Icon aria-hidden="true" />{q.label}</span>}
            </button>
          );
        })}
      </div>
      {selected && (
        <>
          <Feedback tone={QUALITY[selected.quality].tone} title={QUALITY[selected.quality].label}>
            <p>{selected.feedback}</p>
            {selected.quality !== 'best' && <p className="small">Intentos en este paso: {tried[st.id]}. Probá otra opción para encontrar la decisión esperada.</p>}
          </Feedback>
          <div className="row" style={{ marginTop: 12 }}>
            {selected.quality === 'best' ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                {step < sc.steps.length - 1 ? 'Continuar' : 'Ver cierre del caso'}<ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setChoice(null)}><HelpCircle aria-hidden="true" />Probar otra opción</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
