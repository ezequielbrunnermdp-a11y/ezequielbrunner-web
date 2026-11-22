import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Badge, Callout, PageHeader } from '../../components/ui';
import { CASE_IDS, SCENARIO_BY_ID } from '../../content/scenarios';
import { MODULES, MODULE_BY_ID } from '../../content/modules';
import { QUESTIONS } from '../../content/questions';
import { useProgress } from '../../storage/store';
import { ScenarioPlayer } from './ScenarioPlayer';
import { scenarioPracticeIds } from './Exercises';
import { setQuery } from '../../app/router';

export function CasesList() {
  const progress = useProgress();
  return (
    <>
      <PageHeader eyebrow="Practicar" title="Casos interactivos" lead="Situaciones habituales del servicio. Elegí qué harías, mirá la consecuencia y reintentá hasta encontrar la decisión esperada." />
      <div className="grid">
        {[...CASE_IDS, 'sim-mesa'].map((id, i) => {
          const sc = SCENARIO_BY_ID[id];
          const rec = progress.practices[`case-${id}`];
          return (
            <a key={id} className="card card-link module-card" href={`#/casos/${id}`}>
              <div className="row-between">
                <span className="module-cat" style={{ margin: 0 }}>{id === 'sim-mesa' ? 'Simulador' : `Caso ${i + 1}`} · Módulo {MODULE_BY_ID[sc.moduleId].number}</span>
                {rec?.completedAt ? <Badge tone="ok" icon={<CheckCircle2 aria-hidden="true" />}>Resuelto</Badge> : <Badge>Pendiente</Badge>}
              </div>
              <h3>{sc.title}</h3>
              <p className="muted" style={{ margin: 0 }}>{sc.steps[0].situation}</p>
              {rec && <p className="small muted" style={{ margin: 0 }}>Último resultado: {rec.lastResult}</p>}
            </a>
          );
        })}
      </div>
    </>
  );
}

export function CasePage({ id }: { id: string }) {
  const sc = SCENARIO_BY_ID[id];
  if (!sc) return <PageHeader title="Caso no encontrado" lead={<a href="#/casos">Volver a los casos</a>} />;
  return (
    <>
      <PageHeader crumbs={[{ href: '#/casos', label: 'Casos' }]} eyebrow={`Módulo ${MODULE_BY_ID[sc.moduleId].number} · ${MODULE_BY_ID[sc.moduleId].title}`} title={sc.title} />
      <div className="exercise">
        <ScenarioPlayer key={id} scenarioId={id} practiceIds={scenarioPracticeIds(id)} href={`#/casos/${id}`} />
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <a className="btn btn-ghost" href="#/casos">Todos los casos</a>
        <a className="btn btn-secondary" href={`#/aprender/${sc.moduleId}`}>Ir al módulo<ArrowRight aria-hidden="true" /></a>
      </div>
    </>
  );
}

/** Modo facilitador: herramienta local para evaluación oral. No es un sistema de permisos. */
export function FacilitatorPage({ moduleFilter, index }: { moduleFilter: string | null; index: number }) {
  const list = moduleFilter ? QUESTIONS.filter((q) => q.moduleId === moduleFilter) : QUESTIONS;
  const i = Math.max(0, Math.min(index, list.length - 1));
  const q = list[i];
  const [shown, setShown] = useState<string | null>(null);
  const revealed = shown === q.id;
  const go = (n: number) => { setShown(null); setQuery({ i: String(n) }); };
  return (
    <>
      <PageHeader eyebrow="Modo facilitador" title="Evaluación oral" lead="Mostrá la pregunta, escuchá la respuesta y recién después revelá la respuesta esperada y el criterio para calificar." />
      <Callout tone="warning" title="Herramienta local">Este modo funciona en este dispositivo y no crea permisos ni restringe el acceso: cualquier persona que abra el campus puede verlo. Las respuestas no son secretas.</Callout>
      <div className="row" style={{ marginBottom: 18 }}>
        <label htmlFor="fac-mod" className="label">Módulo</label>
        <select id="fac-mod" className="input" style={{ maxWidth: 360 }} value={moduleFilter ?? ''} onChange={(e) => { setShown(null); setQuery({ m: e.target.value || null, i: '0' }); }}>
          <option value="">Todos los módulos (30 preguntas)</option>
          {MODULES.map((m) => <option key={m.id} value={m.id}>Módulo {m.number}: {m.title}</option>)}
        </select>
      </div>
      <section className="card" aria-live="polite">
        <div className="row-between">
          <span className="module-cat" style={{ margin: 0 }}>{q.id} · Módulo {MODULE_BY_ID[q.moduleId].number}</span>
          <span className="small muted">Pregunta {i + 1} de {list.length}</span>
        </div>
        <h2 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.2rem)', margin: '14px 0 20px' }}>{q.prompt}</h2>
        {!revealed ? (
          <button type="button" className="btn btn-bronze" onClick={() => setShown(q.id)}><Eye aria-hidden="true" />Ver respuesta esperada</button>
        ) : (
          <div className="fade-in">
            <div className="example" style={{ background: 'var(--ok-bg)', borderColor: '#c4dccb' }}>
              <span className="badge badge-ok">Respuesta esperada</span>
              <p style={{ fontSize: '1.1rem' }}>{q.expected}</p>
            </div>
            <div className="example">
              <span className="badge badge-neutral"><ShieldAlert aria-hidden="true" />Criterio para calificar</span>
              <p>{q.criteria}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setShown(null)}><EyeOff aria-hidden="true" />Ocultar respuesta</button>
          </div>
        )}
      </section>
      <div className="row-between" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-secondary" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft aria-hidden="true" />Anterior</button>
        <button type="button" className="btn btn-primary" disabled={i === list.length - 1} onClick={() => go(i + 1)}>Siguiente<ChevronRight aria-hidden="true" /></button>
      </div>
    </>
  );
}
