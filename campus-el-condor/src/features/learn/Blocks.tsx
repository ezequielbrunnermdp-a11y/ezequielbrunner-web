import { Check, Lightbulb, MessageCircleQuestion, ThumbsUp, X, AlertTriangle, Clock } from 'lucide-react';
import type { Block } from '../../content/types';
import { Callout, Disclosure, PracticeBadge } from '../../components/ui';
import { PendingDoc } from '../practice/Exercises';
import { useContent } from '../../storage/store';

export function TimeGoals() {
  const { timeGoals } = useContent();
  return (
    <div className="table-wrap" style={{ marginBottom: '1.2em' }}>
      <table className="responsive">
        <caption className="sr-only">Metas de tiempo del servicio</caption>
        <thead><tr><th>Etapa</th><th>Desde</th><th>Hasta</th><th>Meta</th></tr></thead>
        <tbody>
          {timeGoals.map((g) => (
            <tr key={g.id}>
              <td data-label="Etapa"><strong>{g.label}</strong></td>
              <td data-label="Desde">{g.start || 'Hito sin definir'}</td>
              <td data-label="Hasta">{g.end || 'Hito sin definir'}</td>
              <td data-label="Meta">{g.minutes === null ? <span className="badge badge-proposed"><Clock aria-hidden="true" />Meta sin definir</span> : `${g.minutes} min`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p': return <p key={i}>{b.text}</p>;
          case 'list': return b.ordered ? <ol key={i}>{b.items.map((t) => <li key={t}>{t}</li>)}</ol> : <ul key={i}>{b.items.map((t) => <li key={t}>{t}</li>)}</ul>;
          case 'example': return (
            <div key={i} className="example">
              <PracticeBadge label={b.title ?? 'Práctica'} />
              <p>{b.text}</p>
            </div>
          );
          case 'phrases': return <ul key={i} className="phrases" aria-label="Ejemplos de lenguaje">{b.items.map((t) => <li key={t}>{t}</li>)}</ul>;
          case 'callout': return <Callout key={i} tone={b.tone} title={b.title}>{b.text}</Callout>;
          case 'dodont': return (
            <div key={i} className="dodont">
              <div className="do"><h4>Conviene</h4><ul>{b.doText.map((t) => <li key={t}><Check aria-hidden="true" /><span>{t}</span></li>)}</ul></div>
              <div className="dont"><h4>Conviene evitar</h4><ul>{b.dontText.map((t) => <li key={t}><X aria-hidden="true" /><span>{t}</span></li>)}</ul></div>
            </div>
          );
          case 'stations': return <ol key={i} className="stations">{b.items.map((s) => <li key={s.title + s.text}><strong>{s.title}</strong><span>{s.text}</span></li>)}</ol>;
          case 'moments': return (
            <div key={i}>
              {b.items.map((m, k) => (
                <Disclosure key={m.title} number={k + 1} title={m.title} defaultOpen={k === 0}>
                  <p>{m.summary}</p>
                  <div className="moment-grid">
                    <div><h4 style={{ color: 'var(--ok)' }}><ThumbsUp aria-hidden="true" />Conducta útil</h4><p>{m.useful}</p></div>
                    <div><h4 style={{ color: 'var(--err)' }}><AlertTriangle aria-hidden="true" />Error frecuente</h4><p>{m.mistake}</p></div>
                    <div><h4 style={{ color: 'var(--info)' }}><Lightbulb aria-hidden="true" />Ejemplo · Práctica</h4><p>{m.example}</p></div>
                    <div><h4 style={{ color: 'var(--bronze-text)' }}><MessageCircleQuestion aria-hidden="true" />Para pensar</h4><p>{m.question}</p></div>
                  </div>
                </Disclosure>
              ))}
            </div>
          );
          case 'timeGoals': return <TimeGoals key={i} />;
          case 'pendingDoc': return <PendingDoc key={i} resourceId={b.resourceId} text={b.text} />;
          default: return null;
        }
      })}
    </div>
  );
}
