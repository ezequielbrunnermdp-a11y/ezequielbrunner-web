import { useEffect, useRef, useState } from 'react';
import { ArrowRight, GraduationCap, CheckCircle2, ListChecks, RotateCcw, XCircle, Trophy, BookOpen, Play } from 'lucide-react';
import { Badge, Callout, Feedback, PageHeader } from '../../components/ui';
import { QUESTION_BY_ID } from '../../content/questions';
import { MODULES, MODULE_BY_ID } from '../../content/modules';
import { answerInProgress, createFinalAttempt, createModuleAttempt, finishAttempt, moduleStats, pct, passed } from '../../lib/learning';
import { store, useContent, useProgress } from '../../storage/store';
import type { Attempt } from '../../storage/schema';
import { formatTimestamp } from '../../lib/format';
import { navigate } from '../../app/router';

export function EvaluationHub() {
  const progress = useProgress();
  const { settings } = useContent();
  const finals = progress.attempts.filter((a) => a.kind === 'final');
  const lastFinal = finals[finals.length - 1];
  return (
    <>
      <PageHeader eyebrow="Practicar" title="Evaluaciones" lead="Respondé, leé la explicación de cada respuesta y volvé a intentar cuando quieras. Tu intento se conserva aunque cierres la aplicación." />
      <Callout tone="info" title="Resultados pedagógicos">
        El umbral de {settings.threshold} % es un parámetro de práctica configurable, no un requisito aprobado por El Cóndor. Las respuestas están incluidas en la aplicación: estas evaluaciones sirven para aprender, no son un examen inviolable ni una certificación.
      </Callout>
      <section className="card card-dark" style={{ marginBottom: 32, padding: '32px 28px' }}>
        <div className="next-step">
          <span className="tile-ico" style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bronze-light)', color: 'var(--espresso)' }}><GraduationCap aria-hidden="true" /></span>
          <div>
            <p className="eyebrow" style={{ color: 'var(--bronze-light)', marginBottom: 6 }}>Cuestionario integrador</p>
            <h2 style={{ marginBottom: 6 }}>Quince preguntas de todo el recorrido</h2>
            <p className="muted" style={{ margin: 0 }}>Una pregunta de cada módulo y cinco adicionales, sin repetir. {lastFinal ? `Último resultado: ${pct(lastFinal)} %. Intentos: ${finals.length}.` : 'Sin intentos todavía.'}</p>
          </div>
          <a className="btn btn-primary" style={{ background: 'var(--bronze-light)', color: 'var(--espresso)' }} href="#/evaluacion/final">{progress.active.final ? 'Continuar intento' : 'Empezar'}<ArrowRight aria-hidden="true" /></a>
        </div>
      </section>
      <div className="section-title"><h2>Por módulo</h2></div>
      <div className="grid">
        {MODULES.map((m) => {
          const s = moduleStats(progress, m);
          return (
            <a key={m.id} className="card card-link" href={`#/evaluacion/${m.id}`}>
              <div className="module-top" style={{ marginBottom: 10 }}>
                <span className="module-num" style={{ fontSize: '2.2rem' }} aria-hidden="true">{String(m.number).padStart(2, '0')}</span>
                <span className="module-cat">{m.category}</span>
              </div>
              <h3><span className="sr-only">Módulo {m.number}: </span>{m.title}</h3>
              <div className="badges">
                {progress.active[m.id] ? <Badge tone="warn">Intento en curso</Badge> : null}
                {s.best ? <Badge tone={s.quizPassed ? 'ok' : 'err'}>Mejor resultado: {pct(s.best)} %</Badge> : <Badge>Sin intentos</Badge>}
                {s.attempts > 0 && <Badge>{s.attempts} intento{s.attempts === 1 ? '' : 's'}</Badge>}
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

function QuestionCard({ attempt, qid, index, onAnswer }: { attempt: Attempt; qid: string; index: number; onAnswer: (opt: string) => void }) {
  const q = QUESTION_BY_ID[qid];
  const answered = attempt.answers[qid];
  const order = attempt.optionOrder[qid] ?? q.options.map((o) => o.id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [qid]);
  return (
    <div className="exercise fade-in" key={qid}>
      <p className="eyebrow">Pregunta {index + 1} de {attempt.total} · Módulo {MODULE_BY_ID[q.moduleId].number}</p>
      <h2 ref={headingRef} tabIndex={-1} style={{ fontSize: '1.6rem' }}>{q.prompt}</h2>
      <div className="options" role="group" aria-label="Opciones de respuesta">
        {order.map((oid, i) => {
          const o = q.options.find((x) => x.id === oid)!;
          const isCorrect = oid === q.correct;
          const isPicked = answered === oid;
          const cls = answered ? (isCorrect ? ' is-correct' : isPicked ? ' is-wrong' : '') : '';
          return (
            <button key={oid} type="button" className={`option${cls}`} disabled={!!answered} onClick={() => onAnswer(oid)}>
              <span className="key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
              <span>{o.text}</span>
              {answered && isCorrect && <span className="state"><CheckCircle2 aria-hidden="true" />Correcta</span>}
              {answered && isPicked && !isCorrect && <span className="state"><XCircle aria-hidden="true" />Tu respuesta</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <Feedback tone={answered === q.correct ? 'ok' : 'err'} title={answered === q.correct ? 'Respuesta correcta' : 'Respuesta incorrecta'}>
          <p>{q.explanation}</p>
          <p className="small"><strong>Respuesta esperada:</strong> {q.expected}</p>
        </Feedback>
      )}
    </div>
  );
}

export function QuizPage({ quizKey, resultId, reviewOnly }: { quizKey: string; resultId: string | null; reviewOnly: boolean }) {
  const progress = useProgress();
  const { settings } = useContent();
  const isFinal = quizKey === 'final';
  const mod = MODULE_BY_ID[quizKey];
  const [cursor, setCursor] = useState<number | null>(null);
  if (!isFinal && !mod) return <PageHeader title="Evaluación no encontrada" lead={<a href="#/evaluacion">Volver a evaluaciones</a>} />;
  const title = isFinal ? 'Cuestionario integrador' : `Evaluación · ${mod.title}`;
  const crumbs = [{ href: '#/evaluacion', label: 'Evaluaciones' }];
  const active = progress.active[quizKey];
  const history = progress.attempts.filter((a) => (isFinal ? a.kind === 'final' : a.kind === 'module' && a.moduleId === quizKey));

  if (resultId) {
    const a = progress.attempts.find((x) => x.id === resultId);
    if (a) return <Results attempt={a} title={title} crumbs={crumbs} quizKey={quizKey} reviewOnly={reviewOnly} />;
  }

  const start = () => {
    const a = isFinal ? createFinalAttempt(settings.threshold) : createModuleAttempt(quizKey, settings.threshold);
    store.updateProgress((p) => ({ ...p, active: { ...p.active, [quizKey]: a } }));
    setCursor(0);
  };

  if (!active) {
    return (
      <>
        <PageHeader crumbs={crumbs} eyebrow={isFinal ? 'Integrador' : `Módulo ${mod.number}`} title={title}
          lead={isFinal ? 'Quince preguntas: al menos una de cada módulo y cinco adicionales sin repetir. Vas a ver la explicación después de cada respuesta.' : 'Tres preguntas sobre los temas del módulo, con explicación después de cada respuesta.'}>
          <button type="button" className="btn btn-primary" onClick={start}><Play aria-hidden="true" />{history.length ? 'Nuevo intento' : 'Comenzar'}</button>
          {!isFinal && <a className="btn btn-ghost" href={`#/aprender/${quizKey}`}><BookOpen aria-hidden="true" />Repasar el módulo</a>}
        </PageHeader>
        <p className="small muted">Umbral pedagógico de práctica: {settings.threshold} %. Se guarda la fecha, cada respuesta y el resultado en tu perfil local.</p>
        {history.length > 0 && (
          <section className="section">
            <h2>Intentos anteriores</h2>
            <div className="table-wrap">
              <table className="responsive">
                <thead><tr><th>Fecha</th><th>Resultado</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {[...history].reverse().map((a) => (
                    <tr key={a.id}>
                      <td data-label="Fecha">{formatTimestamp(a.finishedAt)}</td>
                      <td data-label="Resultado">{a.score} de {a.total} ({pct(a)} %)</td>
                      <td data-label="Estado">{passed(a) ? <Badge tone="ok">Alcanzó el umbral</Badge> : <Badge tone="err">Para repasar</Badge>}</td>
                      <td data-label="Detalle"><a href={`#/evaluacion/${quizKey}?r=${a.id}`}>Ver respuestas</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    );
  }

  const firstUnanswered = active.questionIds.findIndex((id) => !active.answers[id]);
  const idx = cursor ?? (firstUnanswered === -1 ? active.questionIds.length - 1 : firstUnanswered);
  const qid = active.questionIds[Math.min(idx, active.questionIds.length - 1)];
  const answeredCount = Object.keys(active.answers).length;
  const allAnswered = answeredCount === active.total;

  const answer = (opt: string) => { setCursor(idx); store.updateProgress((p) => answerInProgress(p, quizKey, qid, opt)); };
  const finish = () => {
    const id = active.id;
    store.updateProgress((p) => ({ ...finishAttempt(p, quizKey), lastActivity: { at: new Date().toISOString(), label: title, href: `#/evaluacion/${quizKey}?r=${id}` } }));
    setCursor(null);
    navigate(`#/evaluacion/${quizKey}?r=${id}`);
  };

  return (
    <>
      <PageHeader crumbs={crumbs} eyebrow="Intento en curso" title={title} />
      <div className="meter-label"><span>{answeredCount} de {active.total} respondidas</span><span>Iniciado: {formatTimestamp(active.startedAt)}</span></div>
      <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={active.total} aria-valuenow={answeredCount} aria-label="Avance del intento" style={{ marginBottom: 20 }}>
        <span style={{ width: `${(answeredCount / active.total) * 100}%` }} />
      </div>
      <QuestionCard attempt={active} qid={qid} index={idx} onAnswer={answer} />
      <div className="row-between" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => setCursor(idx - 1)}>Anterior</button>
        {idx < active.total - 1 ? (
          <button type="button" className="btn btn-primary" disabled={!active.answers[qid]} onClick={() => setCursor(idx + 1)}>Siguiente<ArrowRight aria-hidden="true" /></button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!allAnswered} onClick={finish}><ListChecks aria-hidden="true" />Ver resultado</button>
        )}
      </div>
      {!allAnswered && idx === active.total - 1 && <p className="small muted" style={{ textAlign: 'right' }}>Respondé todas las preguntas para ver el resultado.</p>}
    </>
  );
}

function Results({ attempt, title, crumbs, quizKey, reviewOnly }: { attempt: Attempt; title: string; crumbs: { href: string; label: string }[]; quizKey: string; reviewOnly: boolean }) {
  const p = pct(attempt);
  const ok = passed(attempt);
  const wrongIds = attempt.questionIds.filter((id) => attempt.answers[id] !== QUESTION_BY_ID[id].correct);
  const list = reviewOnly ? wrongIds : attempt.questionIds;
  return (
    <>
      <PageHeader crumbs={crumbs} eyebrow="Resultado" title={title} lead={`Intento finalizado el ${formatTimestamp(attempt.finishedAt)}.`} />
      <section className="card row-between" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 18 }}>
          <div className="ring" style={{ ['--p' as string]: p, width: 84, height: 84 }}><span style={{ width: 68, height: 68, fontSize: '1.1rem' }}>{p}%</span></div>
          <div>
            <h2 style={{ marginBottom: 4 }}>{attempt.score} de {attempt.total} respuestas correctas</h2>
            {ok ? <Badge tone="ok" icon={<Trophy aria-hidden="true" />}>Alcanzaste el umbral de práctica ({attempt.threshold} %)</Badge>
              : <Badge tone="err">Por debajo del umbral de práctica ({attempt.threshold} %)</Badge>}
          </div>
        </div>
        <div className="row">
          {wrongIds.length > 0 && (reviewOnly
            ? <a className="btn btn-secondary" href={`#/evaluacion/${quizKey}?r=${attempt.id}`}>Ver todas</a>
            : <a className="btn btn-secondary" href={`#/evaluacion/${quizKey}?r=${attempt.id}&errores=1`}>Repasar {wrongIds.length} error{wrongIds.length === 1 ? '' : 'es'}</a>)}
          <a className="btn btn-primary" href={`#/evaluacion/${quizKey}`}><RotateCcw aria-hidden="true" />Reintentar</a>
        </div>
      </section>
      <p className="small muted">Un resultado del campus es pedagógico: no es una habilitación, certificación ni calificación laboral.</p>
      <div className="stack">
        {list.length === 0 && <Callout tone="ok" title="Sin errores en este intento">Respondiste todas las preguntas correctamente.</Callout>}
        {list.map((id, i) => {
          const q = QUESTION_BY_ID[id];
          const mine = attempt.answers[id];
          const right = mine === q.correct;
          return (
            <div key={id} className="card-flat">
              <div className="row-between" style={{ marginBottom: 6 }}>
                <span className="small muted">{reviewOnly ? `Error ${i + 1}` : `Pregunta ${attempt.questionIds.indexOf(id) + 1}`} · Módulo {MODULE_BY_ID[q.moduleId].number}</span>
                {right ? <Badge tone="ok" icon={<CheckCircle2 aria-hidden="true" />}>Correcta</Badge> : <Badge tone="err" icon={<XCircle aria-hidden="true" />}>Incorrecta</Badge>}
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>{q.prompt}</h3>
              {!right && <p className="small" style={{ color: 'var(--err)' }}><strong>Tu respuesta:</strong> {q.options.find((o) => o.id === mine)?.text}</p>}
              <p className="small" style={{ color: 'var(--ok)' }}><strong>Respuesta correcta:</strong> {q.options.find((o) => o.id === q.correct)?.text}</p>
              <p className="small" style={{ margin: 0 }}>{q.explanation}</p>
              {!right && <p className="small" style={{ margin: '8px 0 0' }}><a href={`#/aprender/${q.moduleId}`}>Repasar el módulo {MODULE_BY_ID[q.moduleId].number}</a></p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
