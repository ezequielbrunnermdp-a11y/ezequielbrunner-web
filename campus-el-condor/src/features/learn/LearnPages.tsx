import { useEffect } from 'react';
import { BookOpen, CheckCircle2, Circle, ClipboardCheck, Clock, Printer, Target, ArrowRight, ArrowLeft, Video } from 'lucide-react';
import { Badge, Callout, FavoriteButton, Meter, MetaBadges, PageHeader, toast } from '../../components/ui';
import { useModules, useModule } from './useModule';
import { Blocks } from './Blocks';
import { ExerciseView } from '../practice/Exercises';
import { moduleStats, STATUS_LABEL, type ModuleStatus, pct } from '../../lib/learning';
import { store, useProgress } from '../../storage/store';
import { MODULES } from '../../content/modules';
import { VIDEO_SCRIPTS } from '../../content/library';
import { formatCivil } from '../../lib/format';
import { SOURCE_LABEL } from '../../content/meta';

const STATUS_TONE: Record<ModuleStatus, 'neutral' | 'warn' | 'practice' | 'proposed' | 'ok'> = {
  'sin-empezar': 'neutral',
  'en-curso': 'warn',
  'practica-pendiente': 'practice',
  leido: 'proposed',
  completado: 'ok',
};

export function StatusBadge({ status }: { status: ModuleStatus }) {
  return <Badge tone={STATUS_TONE[status]} icon={status === 'completado' ? <CheckCircle2 aria-hidden="true" /> : undefined}>{STATUS_LABEL[status]}</Badge>;
}

export function minutesOf(m: { lessons: { minutes: number }[] }) {
  return m.lessons.reduce((n, l) => n + l.minutes, 0);
}

export function ModuleList() {
  const modules = useModules();
  const progress = useProgress();
  return (
    <>
      <PageHeader eyebrow="Aprender" title="Diez módulos para empezar con confianza" lead="Cada módulo combina lecciones breves, ejemplos, prácticas y una evaluación con respuestas explicadas. Podés avanzar en orden o ir directo al tema que necesitás." />
      <Callout tone="pending" title="Contenido propuesto">Las lecciones son una propuesta pedagógica original del campus. Hasta que El Cóndor las apruebe, no constituyen políticas oficiales. Marcar una lectura no equivale a aprobar una evaluación.</Callout>
      <div className="grid">
        {modules.map((m) => {
          const s = moduleStats(progress, m);
          return (
            <a key={m.id} className="card card-link module-card" href={`#/aprender/${m.id}`}>
              <div className="row-between">
                <span className="module-num" aria-hidden="true">{String(m.number).padStart(2, '0')}</span>
                <StatusBadge status={s.status} />
              </div>
              <h3><span className="sr-only">Módulo {m.number}: </span>{m.title}</h3>
              <p className="muted" style={{ margin: 0 }}>{m.short}</p>
              <div className="meta-strip">
                <span><Clock aria-hidden="true" />{minutesOf(m)} min de lectura</span>
                <span><BookOpen aria-hidden="true" />{s.lessonsRead}/{m.lessons.length} lecciones</span>
                <span><ClipboardCheck aria-hidden="true" />{s.practicesDone}/{m.exercises.length} prácticas</span>
              </div>
              <Meter value={s.percent} label="Avance del módulo" />
            </a>
          );
        })}
      </div>
    </>
  );
}

export function ModulePage({ id, focus }: { id: string; focus: string | null }) {
  const m = useModule(id);
  const progress = useProgress();

  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const el = document.getElementById(focus);
      if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
    }, 60);
    return () => clearTimeout(t);
  }, [focus, id]);

  useEffect(() => { if (m) store.touch(`Módulo ${m.number}: ${m.title}`, `#/aprender/${m.id}`); }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return <PageHeader title="Módulo no encontrado" lead={<a href="#/aprender">Volver a los módulos</a>} />;
  const s = moduleStats(progress, m);
  const idx = MODULES.findIndex((x) => x.id === m.id);
  const prev = MODULES[idx - 1];
  const next = MODULES[idx + 1];
  const video = VIDEO_SCRIPTS.find((v) => v.moduleId === m.id);
  const last = [...progress.attempts].reverse().find((a) => a.kind === 'module' && a.moduleId === m.id);
  const toggleRead = (lessonId: string, title: string) => {
    const read = !!progress.lessonsRead[lessonId];
    store.updateProgress((p) => {
      const lr = { ...p.lessonsRead };
      if (read) delete lr[lessonId]; else lr[lessonId] = new Date().toISOString();
      return { ...p, lessonsRead: lr, lastActivity: { at: new Date().toISOString(), label: `${m.title} · ${title}`, href: `#/aprender/${m.id}?l=${lessonId}` } };
    });
    if (!read) toast('Lección marcada como leída');
  };

  return (
    <article>
      <PageHeader crumbs={[{ href: '#/aprender', label: 'Aprender' }]} eyebrow={`Módulo ${m.number} de ${MODULES.length}`} title={m.title}>
        <StatusBadge status={s.status} />
        <a className="btn btn-ghost btn-sm no-print" href={`#/imprimir/${m.id}`}><Printer aria-hidden="true" />Versión imprimible</a>
      </PageHeader>
      <div className="stack" style={{ marginBottom: 24 }}>
        <MetaBadges meta={m.meta} />
        <div className="meta-strip">
          <span><Clock aria-hidden="true" />Lectura orientativa: {minutesOf(m)} min</span>
          <span>Fuente: {SOURCE_LABEL[m.meta.sourceType]}</span>
          <span>Versión {m.meta.version} · {formatCivil(m.meta.updatedAt)}</span>
        </div>
      </div>
      <div className="objective"><Target aria-hidden="true" /><div><strong>Objetivo</strong><p style={{ margin: 0 }}>{m.objective}</p></div></div>
      <p className="lead" style={{ maxWidth: '68ch' }}>{m.intro}</p>

      <nav className="lesson-nav no-print" aria-label="Contenido del módulo">
        {m.lessons.map((l) => (
          <a key={l.id} href={`#/aprender/${m.id}?l=${l.id}`}>{progress.lessonsRead[l.id] ? <CheckCircle2 aria-hidden="true" /> : null}{l.title}</a>
        ))}
        {m.exercises.map((x) => <a key={x.id} href={`#/aprender/${m.id}?l=${x.id}`}>{progress.practices[x.id]?.completedAt ? <CheckCircle2 aria-hidden="true" /> : null}{x.title}</a>)}
        <a href={`#/aprender/${m.id}?l=${m.id}-sintesis`}>Síntesis</a>
        <a href={`#/evaluacion/${m.id}`}>Evaluación</a>
      </nav>

      <div className="stack-lg">
        {m.lessons.map((l, i) => {
          const read = !!progress.lessonsRead[l.id];
          return (
            <section key={l.id} id={l.id} className="card lesson" tabIndex={-1} aria-labelledby={`${l.id}-t`}>
              <div className="lesson-head">
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Lección {i + 1} · {l.minutes} min</p>
                  <h3 id={`${l.id}-t`}>{l.title}</h3>
                </div>
                <FavoriteButton id={`lesson:${l.id}`} label={l.title} />
              </div>
              <Blocks blocks={l.blocks} />
              <div className="lesson-foot no-print">
                {read ? <span className="read-state"><CheckCircle2 aria-hidden="true" />Leída</span> : <span className="small muted"><Circle size={14} aria-hidden="true" /> Sin marcar</span>}
                <button type="button" className={`btn ${read ? 'btn-ghost' : 'btn-primary'} btn-sm`} aria-pressed={read} onClick={() => toggleRead(l.id, l.title)}>
                  {read ? 'Desmarcar lectura' : 'Marcar como leída'}
                </button>
              </div>
            </section>
          );
        })}

        {video && (
          <div className="card-flat row-between no-print">
            <div className="row"><Video aria-hidden="true" color="var(--bronze-text)" /><div><strong>Video del módulo: {video.title}</strong><p className="small muted" style={{ margin: 0 }}>{video.summary}</p></div></div>
            <a className="btn btn-secondary btn-sm" href={`#/videos?v=${video.id}`}>Ver o leer</a>
          </div>
        )}

        {m.exercises.map((x) => <ExerciseView key={x.id} ex={x} moduleTitle={m.title} href={`#/aprender/${m.id}?l=${x.id}`} />)}

        <section id={`${m.id}-sintesis`} className="card" tabIndex={-1} style={{ background: 'var(--espresso)', color: 'var(--ivory)', borderColor: 'var(--espresso)' }}>
          <p className="eyebrow" style={{ color: 'var(--bronze-light)' }}>Síntesis</p>
          <ul style={{ paddingLeft: '1.2em', margin: '0 0 16px' }}>{m.synthesis.map((t) => <li key={t} style={{ margin: '6px 0' }}>{t}</li>)}</ul>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', margin: 0, color: 'var(--ivory)' }}>{m.closing}</p>
        </section>

        <section className="card row-between no-print" aria-labelledby={`${m.id}-eval`}>
          <div>
            <h3 id={`${m.id}-eval`}>Evaluación del módulo</h3>
            <p className="muted" style={{ margin: 0 }}>
              Tres preguntas con explicación después de cada respuesta.
              {last ? ` Último resultado: ${pct(last)} % (${last.score} de ${last.total}). Intentos: ${s.attempts}.` : ' Todavía no hiciste ningún intento.'}
              {progress.active[m.id] ? ' Tenés un intento en curso.' : ''}
            </p>
          </div>
          <a className="btn btn-primary" href={`#/evaluacion/${m.id}`}>{progress.active[m.id] ? 'Continuar evaluación' : s.attempts ? 'Reintentar evaluación' : 'Hacer la evaluación'}<ArrowRight aria-hidden="true" /></a>
        </section>

        <nav className="row-between no-print" aria-label="Módulos contiguos">
          {prev ? <a className="btn btn-ghost" href={`#/aprender/${prev.id}`}><ArrowLeft aria-hidden="true" />Módulo {prev.number}</a> : <span />}
          {next ? <a className="btn btn-secondary" href={`#/aprender/${next.id}`}>Módulo {next.number}: {next.title}<ArrowRight aria-hidden="true" /></a> : <a className="btn btn-secondary" href="#/evaluacion/final">Cuestionario integrador<ArrowRight aria-hidden="true" /></a>}
        </nav>
      </div>
    </article>
  );
}
