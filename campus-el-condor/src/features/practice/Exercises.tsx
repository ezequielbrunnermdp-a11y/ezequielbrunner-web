import { useState } from 'react';
import { PenLine, Check, CheckCircle2, Download, Eye, List, Map as MapIcon, RotateCcw, Save, XCircle, AlertTriangle } from 'lucide-react';
import type { Exercise } from '../../content/types';
import { Badge, Callout, Feedback, Field, toast } from '../../components/ui';
import { HAZARDS, HazardScene } from '../../components/Illustrations';
import { recordPractice } from './recordPractice';
import { OrderExercise } from './OrderExercise';
import { ScenarioPlayer } from './ScenarioPlayer';
import { store, useContent, useProgress } from '../../storage/store';
import { MODULES } from '../../content/modules';
import { BASE_RESOURCES, PRACTICE_PROMOTION } from '../../content/library';
import { estimateBenefit } from '../../lib/promo';
import { formatMoney, formatTimestamp, parseAmount } from '../../lib/format';
import { downloadBlob } from '../../storage/backup';
import { CodePractice } from '../consult/CodePractice';

export function scenarioPracticeIds(scenarioId: string): string[] {
  const ids = MODULES.flatMap((m) => m.exercises).filter((x) => x.kind === 'scenario' && x.scenarioId === scenarioId).map((x) => x.id);
  return [...ids, `case-${scenarioId}`];
}

export function ExerciseView({ ex, moduleTitle, href }: { ex: Exercise; moduleTitle: string; href: string }) {
  const rec = useProgress().practices[ex.id];
  const ctx = { label: `${moduleTitle} · ${ex.title}`, href };
  return (
    <section className="exercise" id={ex.id} aria-labelledby={`${ex.id}-title`}>
      <div className="exercise-head">
        <div>
          <p className="exercise-kicker"><PenLine aria-hidden="true" />Práctica</p>
          <h2 id={`${ex.id}-title`}>{ex.title}</h2>
        </div>
        {rec?.completedAt ? (
          <Badge tone="ok" icon={<CheckCircle2 aria-hidden="true" />}>Completada · {rec.attempts} intento{rec.attempts === 1 ? '' : 's'}</Badge>
        ) : rec?.attempts ? (
          <Badge tone="warn">En progreso · {rec.attempts} intento{rec.attempts === 1 ? '' : 's'}</Badge>
        ) : (
          <Badge>Pendiente</Badge>
        )}
      </div>
      {ex.kind === 'order' && <OrderExercise id={ex.id} items={ex.items} instructions={ex.instructions} explanation={ex.explanation} context={ctx} />}
      {ex.kind === 'scenario' && <ScenarioPlayer scenarioId={ex.scenarioId} practiceIds={scenarioPracticeIds(ex.scenarioId)} href={href} />}
      {ex.kind === 'flashcards' && <Flashcards id={ex.id} cards={ex.cards} ctx={ctx} />}
      {ex.kind === 'checklist' && <Checklist id={ex.id} ctx={ctx} />}
      {ex.kind === 'classify' && <Classify ex={ex} ctx={ctx} />}
      {ex.kind === 'multiselect' && <MultiSelect ex={ex} ctx={ctx} />}
      {ex.kind === 'hazards' && <Hazards id={ex.id} ctx={ctx} />}
      {ex.kind === 'promoCalc' && <PromoCalc id={ex.id} ctx={ctx} />}
      {ex.kind === 'reviewPlan' && <ReviewPlan id={ex.id} ctx={ctx} />}
      {ex.kind === 'comanda' && <Comanda id={ex.id} ctx={ctx} />}
    </section>
  );
}

type Ctx = { label: string; href: string };

function Flashcards({ id, cards, ctx }: { id: string; cards: { front: string; back: string }[]; ctx: Ctx }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const seen = Object.keys(flipped).length;
  return (
    <div>
      <p>Pensá la respuesta y tocá cada tarjeta para darla vuelta.</p>
      <div className="grid-3">
        {cards.map((c, i) => (
          <div key={i} className="flashcard" data-flipped={!!flipped[i]}>
            <button type="button" aria-pressed={!!flipped[i]} aria-label={flipped[i] ? `Respuesta: ${c.back}. Tocá para ver la pregunta.` : `Pregunta: ${c.front}. Tocá para ver la respuesta.`}
              onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}>
              <span className="flash-inner">
                <span className="flash-face flash-front" aria-hidden={!!flipped[i]}><span className="flash-hint"><span>Pregunta {i + 1}</span><span>Tocá para girar</span></span><p>{c.front}</p></span>
                <span className="flash-face flash-back" aria-hidden={!flipped[i]}><span className="flash-hint"><span>Respuesta</span><span>{i + 1} de {cards.length}</span></span><p>{c.back}</p></span>
              </span>
            </button>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" disabled={seen < cards.length}
          onClick={() => { recordPractice(id, 'Tarjetas repasadas', true, ctx.label, ctx.href); toast('Repaso registrado'); }}>
          <Check aria-hidden="true" />Marcar repaso como hecho
        </button>
        <span className="small muted">{seen < cards.length ? `Diste vuelta ${seen} de ${cards.length} tarjetas.` : 'Ya viste todas las respuestas.'}</span>
      </div>
    </div>
  );
}

function Checklist({ id, ctx }: { id: string; ctx: Ctx }) {
  const saved = useProgress().checklist;
  const [form, setForm] = useState(saved);
  const materials = [
    ...MODULES.slice(0, 3).map((m) => ({ id: m.id, label: `Módulo ${m.number}: ${m.title}` })),
    { id: 'biblioteca', label: 'Biblioteca de materiales' },
    { id: 'consultar', label: 'Buscador de consultas' },
  ];
  const save = () => {
    store.updateProgress((p) => ({ ...p, checklist: form }));
    recordPractice(id, 'Checklist guardado', true, ctx.label, ctx.href);
    toast('Checklist guardado en este dispositivo');
  };
  return (
    <div>
      <Callout tone="info" title="Todos los campos son opcionales">Se guardan solo en este navegador, dentro de tu perfil local. No pedimos DNI ni datos personales.</Callout>
      <div className="form-grid">
        <Field label="Mi referente en el turno" htmlFor={`${id}-ref`} hint="Nombre o función, como prefieras.">
          <input id={`${id}-ref`} className="input" value={form.referente} onChange={(e) => setForm({ ...form, referente: e.target.value })} />
        </Field>
        <Field label="Mi sector" htmlFor={`${id}-sec`}>
          <select id={`${id}-sec`} className="input" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
            <option value="">Sin indicar</option>
            {['Salón', 'Recepción', 'Barra', 'Cocina', 'Caja', 'Encargado/a'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Dónde se informan las novedades" htmlFor={`${id}-can`} hint="Por ejemplo: pizarra, cuaderno o reunión de inicio.">
          <input id={`${id}-can`} className="input" value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} />
        </Field>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: '18px 0' }}>
        <legend className="label" style={{ marginBottom: 8 }}>Materiales que ya consulté</legend>
        <div className="stack" style={{ gap: 8 }}>
          {materials.map((m) => (
            <label key={m.id} className="check-row">
              <input type="checkbox" checked={!!form.materiales[m.id]} onChange={(e) => setForm({ ...form, materiales: { ...form.materiales, [m.id]: e.target.checked } })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Dudas para consultar" htmlFor={`${id}-not`}>
        <textarea id={`${id}-not`} className="input" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
      </Field>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={save}><Save aria-hidden="true" />Guardar checklist</button>
      </div>
    </div>
  );
}

function Classify({ ex, ctx }: { ex: Extract<Exercise, { kind: 'classify' }>; ctx: Ctx }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const complete = ex.cases.every((c) => answers[c.id]);
  const correct = ex.cases.filter((c) => answers[c.id] === c.answer).length;
  const label = (id: string) => ex.categories.find((c) => c.id === id)?.label ?? id;
  return (
    <div>
      <p>{ex.instructions}</p>
      {ex.cases.map((c, i) => {
        const ok = answers[c.id] === c.answer;
        return (
          <div key={c.id} className="classify-case">
            <p style={{ margin: 0 }}><strong>{i + 1}.</strong> {c.text}</p>
            <fieldset>
              <legend className="sr-only">Tipo de movimiento para el caso {i + 1}</legend>
              <div className="chips" role="radiogroup">
                {ex.categories.map((cat) => {
                  const sel = answers[c.id] === cat.id;
                  const cls = checked && sel ? (ok ? ' is-correct' : ' is-wrong') : sel ? ' is-active' : '';
                  return (
                    <button key={cat.id} type="button" role="radio" aria-checked={sel} className={`chip${cls}`}
                      onClick={() => { setAnswers({ ...answers, [c.id]: cat.id }); setChecked(false); }}>{cat.label}</button>
                  );
                })}
              </div>
            </fieldset>
            {checked && (
              <div className="small" style={{ marginTop: 8 }}>
                {ok ? <p style={{ margin: 0, color: 'var(--ok)' }}><strong>Correcto: {label(c.answer)}.</strong></p>
                  : <p style={{ margin: 0, color: 'var(--err)' }}><strong>Corresponde a: {label(c.answer)}.</strong></p>}
                <p style={{ margin: '4px 0 0' }}><strong>Qué autorización o registro falta:</strong> {c.missing}</p>
              </div>
            )}
          </div>
        );
      })}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!complete}
          onClick={() => { setChecked(true); recordPractice(ex.id, `${correct} de ${ex.cases.length} casos bien clasificados`, correct === ex.cases.length, ctx.label, ctx.href); }}>
          <Check aria-hidden="true" />Comprobar clasificación
        </button>
        {checked && <button type="button" className="btn btn-ghost" onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw aria-hidden="true" />Reintentar</button>}
        {!complete && <span className="small muted">Elegí una categoría para cada caso.</span>}
      </div>
      {checked && (
        <Feedback tone={correct === ex.cases.length ? 'ok' : 'partial'} title={`${correct} de ${ex.cases.length} casos bien clasificados`}>
          <p>Identificar el motivo correcto permite reconstruir lo ocurrido y usar el registro adecuado.</p>
        </Feedback>
      )}
    </div>
  );
}

function MultiSelect({ ex, ctx }: { ex: Extract<Exercise, { kind: 'multiselect' }>; ctx: Ctx }) {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState(false);
  const allRight = ex.options.every((o) => !!sel[o.id] === o.correct);
  const hits = ex.options.filter((o) => o.correct && sel[o.id]).length;
  const totalCorrect = ex.options.filter((o) => o.correct).length;
  return (
    <div>
      <p><strong>{ex.situation}</strong></p>
      <p>{ex.prompt}</p>
      <div className="stack" style={{ gap: 8 }}>
        {ex.options.map((o) => {
          let cls = '';
          if (checked) cls = o.correct ? (sel[o.id] ? ' is-correct' : ' is-missed') : sel[o.id] ? ' is-wrong' : '';
          return (
            <label key={o.id} className={`check-row${cls}`}>
              <input type="checkbox" checked={!!sel[o.id]} onChange={(e) => { setSel({ ...sel, [o.id]: e.target.checked }); setChecked(false); }} />
              <span>
                {o.text}
                {checked && (o.correct || sel[o.id]) && (
                  <span className="small" style={{ display: 'block', marginTop: 4 }}>
                    <strong>{o.correct ? (sel[o.id] ? 'Necesaria. ' : 'Te faltó marcarla. ') : 'No corresponde. '}</strong>{o.why}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={() => { setChecked(true); recordPractice(ex.id, `${hits} de ${totalCorrect} acciones necesarias${allRight ? '' : ', con errores'}`, allRight, ctx.label, ctx.href); }}>
          <Check aria-hidden="true" />Comprobar
        </button>
        {checked && <button type="button" className="btn btn-ghost" onClick={() => { setSel({}); setChecked(false); }}><RotateCcw aria-hidden="true" />Reintentar</button>}
      </div>
      {checked && (allRight
        ? <Feedback tone="ok" title="Información completa"><p>Barra, comanda y caja quedan con el mismo dato. Cocina ya tenía su modificación.</p></Feedback>
        : <Feedback tone="partial" title="Revisá las acciones marcadas"><p>La información tiene que llegar a cada sector que prepara o cobra, y quedar registrada.</p></Feedback>)}
    </div>
  );
}

const LIST_ITEMS = [
  ...HAZARDS.map((h) => ({ id: h.id, text: h.detail, risk: true })),
  { id: 'n1', text: 'La cafetera está encendida y ordenada sobre la mesada.', risk: false },
  { id: 'n2', text: 'Los frascos del estante superior están alineados.', risk: false },
  { id: 'n3', text: 'Las tazas limpias están apiladas en un sector propio.', risk: false },
  { id: 'n4', text: 'En la heladera hay recipientes con rótulo visible.', risk: false },
].sort((a, b) => a.text.localeCompare(b.text));

function Hazards({ id, ctx }: { id: string; ctx: Ctx }) {
  const [mode, setMode] = useState<'scene' | 'list'>('scene');
  const [found, setFound] = useState<string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState(false);
  const find = (hid: string) => {
    setLast(hid);
    if (found.includes(hid)) return;
    const next = [...found, hid];
    setFound(next);
    if (next.length === HAZARDS.length) recordPractice(id, 'Cuatro riesgos identificados en la escena', true, ctx.label, ctx.href);
  };
  const lastH = HAZARDS.find((h) => h.id === last);
  const listOk = LIST_ITEMS.every((i) => !!marks[i.id] === i.risk);
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Formato de la actividad">
        <button type="button" role="tab" aria-selected={mode === 'scene'} onClick={() => setMode('scene')}><MapIcon aria-hidden="true" />Escena ilustrada</button>
        <button type="button" role="tab" aria-selected={mode === 'list'} onClick={() => setMode('list')}><List aria-hidden="true" />Lista equivalente</button>
      </div>
      {mode === 'scene' ? (
        <div>
          <p>Encontrá los cuatro riesgos en la escena. Tocá o seleccioná con el teclado cada zona que te parezca un riesgo. <span className="small muted">Si usás lector de pantalla, la lista equivalente presenta la misma actividad en texto.</span></p>
          <div className="hazard-scene"><HazardScene found={found} onFind={find} /></div>
          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="small"><strong>{found.length} de {HAZARDS.length}</strong> riesgos identificados</span>
            {found.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFound([]); setLast(null); }}><RotateCcw aria-hidden="true" />Reiniciar</button>}
          </div>
          {lastH && (
            <Feedback tone="ok" title={lastH.label}>
              <p>{lastH.detail}</p>
              <p><strong>Qué hacer:</strong> {lastH.action}</p>
            </Feedback>
          )}
          {found.length === HAZARDS.length && <Callout tone="ok" title="Encontraste los cuatro riesgos">Corregir o informar a tiempo previene accidentes y problemas sanitarios. Esta actividad no reemplaza la capacitación práctica.</Callout>}
        </div>
      ) : (
        <div>
          <p>Marcá las situaciones que representan un riesgo que hay que corregir o informar.</p>
          <div className="stack" style={{ gap: 8 }}>
            {LIST_ITEMS.map((it) => {
              let cls = '';
              if (checked) cls = it.risk ? (marks[it.id] ? ' is-correct' : ' is-missed') : marks[it.id] ? ' is-wrong' : '';
              const h = HAZARDS.find((x) => x.id === it.id);
              return (
                <label key={it.id} className={`check-row${cls}`}>
                  <input type="checkbox" checked={!!marks[it.id]} onChange={(e) => { setMarks({ ...marks, [it.id]: e.target.checked }); setChecked(false); }} />
                  <span>{it.text}{checked && h && <span className="small" style={{ display: 'block', marginTop: 4 }}><strong>{h.label}.</strong> {h.action}</span>}
                    {checked && !it.risk && marks[it.id] && <span className="small" style={{ display: 'block', marginTop: 4 }}>Esta situación está en orden.</span>}</span>
                </label>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={() => { setChecked(true); recordPractice(id, listOk ? 'Riesgos identificados en la lista' : 'Lista con errores', listOk, ctx.label, ctx.href); }}><Check aria-hidden="true" />Comprobar</button>
          </div>
          {checked && (listOk ? <Feedback tone="ok" title="Identificaste los cuatro riesgos"><p>Cada uno requiere corregir o informar según el procedimiento.</p></Feedback>
            : <Feedback tone="partial" title="Revisá las situaciones marcadas"><p>Hay cuatro riesgos en total.</p></Feedback>)}
        </div>
      )}
    </div>
  );
}

function PromoCalc({ id, ctx }: { id: string; ctx: Ctx }) {
  const [amount, setAmount] = useState('30.000');
  const [percent, setPercent] = useState(String(PRACTICE_PROMOTION.percent));
  const [cap, setCap] = useState('5.000');
  const [type, setType] = useState<'reintegro' | 'descuento-inmediato'>('reintegro');
  const [q, setQ] = useState<string | null>(null);
  const a = parseAmount(amount);
  const p = parseAmount(percent);
  const c = cap.trim() === '' ? null : parseAmount(cap);
  const capInvalid = cap.trim() !== '' && c === null;
  const est = a !== null && p !== null && p <= 100 && !capInvalid ? estimateBenefit(a, p, c) : null;
  return (
    <div>
      <Callout tone="info" title="Práctica · no es una promoción real">Entidad y condiciones ficticias para entrenar el cálculo. No representa un convenio de El Cóndor.</Callout>
      <div className="form-grid">
        <Field label="Importe elegible (ARS)" htmlFor={`${id}-a`} error={amount && a === null ? 'Ingresá un importe válido, por ejemplo 12.500,50.' : null}>
          <input id={`${id}-a`} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!amount && a === null} />
        </Field>
        <Field label="Porcentaje del beneficio" htmlFor={`${id}-p`} error={percent && (p === null || p > 100) ? 'Ingresá un porcentaje entre 0 y 100.' : null}>
          <input id={`${id}-p`} className="input" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
        <Field label="Tope disponible informado (ARS)" htmlFor={`${id}-c`} hint="Dejalo vacío si no hay tope informado." error={capInvalid ? 'Ingresá un importe válido o dejalo vacío.' : null}>
          <input id={`${id}-c`} className="input" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <Field label="Mecanismo" htmlFor={`${id}-t`}>
          <select id={`${id}-t`} className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="reintegro">Reintegro posterior de la entidad</option>
            <option value="descuento-inmediato">Descuento inmediato en el cobro</option>
          </select>
        </Field>
      </div>
      {est && (
        <div className="card-flat" style={{ marginTop: 16 }} aria-live="polite">
          <dl className="kv">
            <dt>Importe × porcentaje</dt><dd>{formatMoney(est.byPercent)}</dd>
            <dt>Tope disponible</dt><dd>{est.cap === null ? 'Sin tope informado' : formatMoney(est.cap)}</dd>
            <dt>Beneficio estimado</dt><dd><strong>{formatMoney(est.estimate)}</strong>{est.limitedByCap && ' (limitado por el tope)'}</dd>
            <dt>Importe a cobrar hoy</dt><dd>{type === 'reintegro' ? `${formatMoney(a)} — el reintegro lo acredita la entidad después` : `${formatMoney(a! - est.estimate)} — si se confirman todas las condiciones`}</dd>
          </dl>
          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Límite de la estimación: no considera consumos previos del cliente con la misma entidad, que pueden haber reducido su tope, ni condiciones no informadas (días, horarios, tarjetas, exclusiones).</p>
        </div>
      )}
      <hr className="divider" />
      <h4>Comprobá lo aprendido</h4>
      <p>Una consumición de $ 30.000 con un reintegro del 20 % y un tope informado de $ 5.000 por mes. El cliente no sabe si ya usó parte del tope. ¿Qué podés decirle?</p>
      <div className="options">
        {[
          { id: 'a', t: 'Que recibirá $ 6.000 de reintegro.', ok: false, f: 'El 20 % de $ 30.000 es $ 6.000, pero el tope informado limita el beneficio.' },
          { id: 'b', t: 'Que el reintegro estimado es de hasta $ 5.000, que lo acredita la entidad y que depende de cuánto tope tenga disponible.', ok: true, f: 'Correcto: el menor valor entre $ 6.000 y $ 5.000, aclarando que depende de consumos previos que el local desconoce.' },
          { id: 'c', t: 'Que le cobrás $ 25.000.', ok: false, f: 'Un reintegro posterior no modifica el importe cobrado por el local.' },
        ].map((o, i) => (
          <button key={o.id} type="button" className={`option${q === o.id ? (o.ok ? ' is-correct' : ' is-wrong') : ''}`}
            onClick={() => { setQ(o.id); recordPractice(id, o.ok ? 'Cálculo de entrenamiento correcto' : 'Cálculo de entrenamiento con error', o.ok, ctx.label, ctx.href); }}>
            <span className="key" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{o.t}</span>
            {q === o.id && <span className="state">{o.ok ? <><CheckCircle2 aria-hidden="true" />Correcta</> : <><XCircle aria-hidden="true" />Incorrecta</>}</span>}
          </button>
        ))}
      </div>
      {q && (q === 'b'
        ? <Feedback tone="ok" title="Respuesta correcta"><p>Beneficio estimado = menor valor entre importe elegible × porcentaje y tope disponible informado.</p></Feedback>
        : <Feedback tone="err" title="Revisá el cálculo"><p>Recordá el tope y quién realiza el reintegro. Podés elegir otra opción.</p></Feedback>)}
    </div>
  );
}

function ReviewPlan({ id, ctx }: { id: string; ctx: Ctx }) {
  const saved = useProgress().reviewPlan;
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!form.tema.trim() || !form.como.trim() || !form.quien.trim()) { setError('Completá las tres preguntas para guardar tu plan.'); return; }
    setError(null);
    const next = { ...form, updatedAt: new Date().toISOString() };
    store.updateProgress((p) => ({ ...p, reviewPlan: next }));
    setForm(next);
    recordPractice(id, 'Plan de repaso guardado', true, ctx.label, ctx.href);
    toast('Plan guardado en tu perfil local');
  };
  const exportPlan = () => {
    const text = `EL CÓNDOR · Campus de formación\nMi plan personal de repaso\n\n1. ¿Qué tema quiero reforzar?\n${form.tema}\n\n2. ¿Cómo voy a practicarlo?\n${form.como}\n\n3. ¿A quién puedo consultar?\n${form.quien}\n\nActualizado: ${formatTimestamp(form.updatedAt)}\n`;
    downloadBlob('plan-de-repaso.txt', new Blob([text], { type: 'text/plain;charset=utf-8' }));
  };
  return (
    <div>
      <div className="stack">
        <Field label="1. ¿Qué tema quiero reforzar?" htmlFor={`${id}-1`}><textarea id={`${id}-1`} className="input" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} /></Field>
        <Field label="2. ¿Cómo voy a practicarlo?" htmlFor={`${id}-2`}><textarea id={`${id}-2`} className="input" value={form.como} onChange={(e) => setForm({ ...form, como: e.target.value })} /></Field>
        <Field label="3. ¿A quién puedo consultar?" htmlFor={`${id}-3`} error={error}><textarea id={`${id}-3`} className="input" value={form.quien} onChange={(e) => setForm({ ...form, quien: e.target.value })} /></Field>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={save}><Save aria-hidden="true" />Guardar plan</button>
        <button type="button" className="btn btn-secondary" onClick={exportPlan} disabled={!saved.updatedAt}><Download aria-hidden="true" />Exportar como texto</button>
        {saved.updatedAt && <span className="small muted">Guardado: {formatTimestamp(saved.updatedAt)}</span>}
      </div>
    </div>
  );
}

const COMANDA_ROUNDS = [
  { said: '“Dos cortados y un café con leche, por favor.”', options: [
    { t: '2 cortado · 1 café con leche', ok: true, f: 'Cada producto con su cantidad: barra sabe exactamente qué preparar.' },
    { t: '3 cafés', ok: false, f: 'Agrupar productos distintos obliga a barra a adivinar las variantes.' },
    { t: '2 café con leche · 1 cortado', ok: false, f: 'Las cantidades quedaron invertidas: conviene confirmar en voz alta antes de registrar.' },
  ] },
  { said: '“Un té, pero con limón en lugar de leche.”', options: [
    { t: '1 té', ok: false, f: 'Falta la observación: la preparación puede salir con leche.' },
    { t: '1 té · observación: con limón, si la variante está autorizada', ok: true, f: 'La observación queda registrada y se verifica que el local la admita.' },
    { t: '1 té con leche · avisar de palabra que es con limón', ok: false, f: 'El registro contradice el pedido y la aclaración verbal puede no llegar.' },
  ] },
  { said: '“Un tostado… no, mejor que sean dos.”', options: [
    { t: '1 tostado y otro después, si lo vuelven a pedir', ok: false, f: 'El cliente ya modificó la cantidad: hay que registrar lo que aceptó.' },
    { t: '3 tostados, por las dudas', ok: false, f: 'La comanda debe reflejar lo aceptado, no una estimación.' },
    { t: 'Confirmás “¿dos tostados, entonces?” y registrás 2 tostado', ok: true, f: 'Confirmar el cambio evita dudas y la comanda refleja lo aceptado.' },
  ] },
];

function Comanda({ id, ctx }: { id: string; ctx: Ctx }) {
  const content = useContent();
  const [round, setRound] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const r = COMANDA_ROUNDS[round];
  const choose = (i: number) => {
    if (pick !== null) return;
    setPick(i);
    if (r.options[i].ok) setScore((s) => s + 1);
  };
  const next = () => {
    if (round < COMANDA_ROUNDS.length - 1) { setRound(round + 1); setPick(null); return; }
    setDone(true);
    recordPractice(id, `${score} de ${COMANDA_ROUNDS.length} comandas correctas`, true, ctx.label, ctx.href);
  };
  const validCodes = content.codes.length;
  return (
    <div>
      <Callout tone={validCodes >= 4 ? 'info' : 'pending'} title={validCodes >= 4 ? 'Práctica con los códigos de El Cóndor' : 'Práctica sin códigos oficiales'}>
        {validCodes >= 4 ? `Primero practicá cantidades y variantes. Después, más abajo, asociá códigos reales con su producto (${validCodes.toLocaleString('es-AR')} códigos disponibles).` : 'La práctica de códigos se activa cuando se carguen al menos cuatro códigos válidos de El Cóndor. Mientras tanto, practicá cantidades, variantes y confirmación con nombres genéricos.'}
      </Callout>
      {!done ? (
        <div>
          <p className="small muted">Comanda {round + 1} de {COMANDA_ROUNDS.length}</p>
          <p>La mesa dice: <strong>{r.said}</strong></p>
          <p>¿Cómo queda registrada la comanda?</p>
          <div className="options">
            {r.options.map((o, i) => (
              <button key={i} type="button" className={`option${pick === i ? (o.ok ? ' is-correct' : ' is-wrong') : pick !== null && o.ok ? ' is-correct' : ''}`} disabled={pick !== null} onClick={() => choose(i)}>
                <span className="key" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{o.t}</span>
                {pick !== null && (pick === i || o.ok) && <span className="state">{o.ok ? <><CheckCircle2 aria-hidden="true" />Correcta</> : <><XCircle aria-hidden="true" />Tu elección</>}</span>}
              </button>
            ))}
          </div>
          {pick !== null && (
            <>
              <Feedback tone={r.options[pick].ok ? 'ok' : 'err'} title={r.options[pick].ok ? 'Bien registrada' : 'Esa comanda genera un error'}><p>{r.options[pick].f}</p></Feedback>
              <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn btn-primary" onClick={next}>{round < COMANDA_ROUNDS.length - 1 ? 'Siguiente comanda' : 'Ver resultado'}</button></div>
            </>
          )}
        </div>
      ) : (
        <div>
          <Feedback tone={score === COMANDA_ROUNDS.length ? 'ok' : 'partial'} title={`${score} de ${COMANDA_ROUNDS.length} comandas correctas`}><p>La comanda refleja lo que el cliente aceptó: producto, cantidad, variante y observaciones admitidas.</p></Feedback>
          <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn btn-secondary" onClick={() => { setRound(0); setPick(null); setScore(0); setDone(false); }}><RotateCcw aria-hidden="true" />Practicar de nuevo</button></div>
        </div>
      )}
      {validCodes >= 4 && (<><hr className="divider" /><CodePractice /></>)}
    </div>
  );
}

export function PendingDoc({ resourceId, text }: { resourceId: string; text: string }) {
  const content = useContent();
  const base = BASE_RESOURCES.find((r) => r.id === resourceId);
  const linked = content.resources[resourceId]?.fileId || content.resources[resourceId]?.href;
  return (
    <div className="pending-doc">
      {linked ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <div className="grow">
        <p><strong>{base?.title ?? text}</strong></p>
        <p className="small muted">{linked ? 'Documento disponible en la biblioteca de este dispositivo.' : `Documento propio pendiente: ${text}`}</p>
      </div>
      <a className="btn btn-secondary btn-sm" href={`#/consultar/biblioteca?r=${resourceId}`}><Eye aria-hidden="true" />{linked ? 'Abrir' : 'Ver estado'}</a>
    </div>
  );
}
