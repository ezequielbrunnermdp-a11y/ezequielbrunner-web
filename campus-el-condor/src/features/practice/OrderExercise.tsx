import { useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Check, RotateCcw, X } from 'lucide-react';
import { Feedback } from '../../components/ui';
import { recordPractice, savePracticeState } from './recordPractice';
import { useProgress } from '../../storage/store';

interface Props {
  id: string;
  items: { id: string; text: string }[];
  instructions: string;
  explanation: string;
  context: { label: string; href: string };
}

/** Orden inicial determinístico y distinto del correcto: se guarda para conservarlo al recargar. */
function scrambled(ids: string[]): string[] {
  const out = [...ids];
  for (let i = 0; i < out.length - 1; i += 2) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  if (out.length % 2 === 1 && out.length > 1) [out[0], out[out.length - 1]] = [out[out.length - 1], out[0]];
  return out;
}

/**
 * Ordenar una secuencia sin depender de arrastrar: botones de subir y bajar, y teclado
 * (Espacio para tomar un elemento, flechas para moverlo, Espacio para soltarlo).
 * Se evalúa la secuencia completa: solo es correcta si todas las posiciones coinciden.
 */
export function OrderExercise({ id, items, instructions, explanation, context }: Props) {
  const progress = useProgress();
  const saved = progress.practices[id]?.state as { order?: string[] } | undefined;
  const correctIds = useMemo(() => items.map((i) => i.id), [items]);
  const initial = saved?.order && saved.order.length === items.length ? saved.order : scrambled(correctIds);
  const [order, setOrder] = useState<string[]>(initial);
  const [checked, setChecked] = useState(false);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
    setChecked(false);
    savePracticeState(id, { order: next });
    setAnnounce(`${byId[x].text}, posición ${to + 1} de ${order.length}`);
    requestAnimationFrame(() => document.getElementById(`${id}-item-${x}`)?.focus());
  };

  const onKey = (e: KeyboardEvent, index: number, itemId: string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      setGrabbed((g) => (g === itemId ? null : itemId));
      setAnnounce(grabbed === itemId ? `${byId[itemId].text} ubicado en la posición ${index + 1}` : `${byId[itemId].text} tomado. Usá las flechas para moverlo.`);
    } else if (e.key === 'ArrowUp' && grabbed === itemId) { e.preventDefault(); move(index, index - 1); }
    else if (e.key === 'ArrowDown' && grabbed === itemId) { e.preventDefault(); move(index, index + 1); }
    else if (e.key === 'Escape') setGrabbed(null);
  };

  const correctCount = order.filter((x, i) => x === correctIds[i]).length;
  const allCorrect = correctCount === order.length;

  const check = () => {
    setChecked(true);
    setGrabbed(null);
    recordPractice(id, allCorrect ? 'Secuencia correcta' : `${correctCount} de ${order.length} en su lugar`, allCorrect, context.label, context.href);
  };

  const reset = () => {
    const s = scrambled(correctIds);
    setOrder(s);
    setChecked(false);
    savePracticeState(id, { order: s });
  };

  return (
    <div>
      <p>{instructions}</p>
      <p className="small muted">Con teclado: tabulá hasta un paso, presioná <span className="kbd">Espacio</span> para tomarlo, movelo con <span className="kbd">↑</span> <span className="kbd">↓</span> y volvé a presionar <span className="kbd">Espacio</span>.</p>
      <ol className="order-list" aria-label="Secuencia para ordenar">
        {order.map((itemId, i) => {
          const ok = order[i] === correctIds[i];
          return (
            <li key={itemId} id={`${id}-item-${itemId}`} tabIndex={0} className={`order-item${checked ? (ok ? ' is-correct' : ' is-wrong') : ''}`}
              data-grabbed={grabbed === itemId} aria-roledescription="elemento ordenable"
              aria-label={`${byId[itemId].text}, posición ${i + 1} de ${order.length}${grabbed === itemId ? ', tomado' : ''}`}
              onKeyDown={(e) => onKey(e, i, itemId)}>
              <span className="pos" aria-hidden="true">{i + 1}</span>
              <span className="txt">{byId[itemId].text}</span>
              {checked && (
                <span className="mark">{ok ? <><Check size={15} aria-hidden="true" />En su lugar</> : <><X size={15} aria-hidden="true" />Revisar</>}</span>
              )}
              <span className="ctrls">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Subir ${byId[itemId].text}`}><ArrowUp size={18} aria-hidden="true" /></button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label={`Bajar ${byId[itemId].text}`}><ArrowDown size={18} aria-hidden="true" /></button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="assertive">{announce}</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={check}><Check aria-hidden="true" />Comprobar secuencia</button>
        <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw aria-hidden="true" />Volver a mezclar</button>
      </div>
      {checked && (allCorrect ? (
        <Feedback tone="ok" title="Secuencia correcta"><p>{explanation}</p></Feedback>
      ) : (
        <Feedback tone="err" title={`${correctCount} de ${order.length} pasos están en su lugar`}>
          <p>La secuencia se evalúa completa. Revisá los pasos marcados y volvé a comprobar.</p>
        </Feedback>
      ))}
    </div>
  );
}
