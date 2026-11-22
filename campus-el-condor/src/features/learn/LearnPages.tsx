import { useEffect } from 'react';
import { BookOpen, Check, CheckCircle2, Circle, ClipboardCheck, Clock, Printer, Target, ArrowRight, ArrowLeft, Video, GraduationCap, ClipboardList } from 'lucide-react';
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
  return (
    <Badge tone={STATUS_TONE[status]} icon={status === 'completado' ? <CheckCircle2 aria-hidden="true" /> : <span className="status-dot" aria-hidden="true" />}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function minutesOf(m: { lessons: { minutes: number }[] }) {
  return m.lessons.reduce((n, l) => n + l.minutes, 0);
}

export function ModuleList() {
  const modules = useModules();
  const progress = useProgress();
  return (
    <>
      <PageHeader eyebrow="Aprender" title="Diez módulos para empezar con confianza" lead="Lecciones breves, ejemplos, prácticas y una evaluación con respuestas explicadas. Podés avanzar en orden o ir directo al tema que necesitás." />
      <Callout tone="pending" title="Contenido propuesto">Las lecciones son una propuesta pedagógica original del campus. Hasta que El Cóndor las apruebe, no constituyen políticas oficiales. Marcar una lectura no equivale a aprobar una evaluación.</Callout>
      <div className="grid">
        {modules.map((m) => {
          const s = moduleStats(progress, m);
          return (
            <a key={m.id} className={`card card-link module-card${s.status === 'completado' ? ' is-done' : ''}`} href={`#/aprender/${m.id}`}>
              <div className="module-top">
                <span className="module-num" aria-hidden="true">{String(m.number).padStart(2, '0')}</span>
                <StatusBadge status={s.status} />
              </div>
              <span className="module-cat">{m.category}</span>
              <h3><span className="sr-only">Módulo {m.number}: </span>{m.title}</h3>
              <p className="desc">{m.short}</p>
              <div className="module-foot">
                <div className="meta-strip">
                  <span><Clock aria-hidden="true" />{minutesOf(m)} min</span>
                  <span><BookOpen aria-hidden="true" />{s.lessonsRead}/{m.lessons.length} lecciones</span>
                  <span><ClipboardCheck aria-hidden="true" />{s.practicesDone}/{m.exercises.length} prácticas</span>
                </div>
                <div className={s.status === 'completado' ? 'meter ok' : 'meter'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent} aria-label={`Avance del módulo ${m.number}: ${s.percent} %`}>
                  <span style={{ width: `${s.percent}%` }} />
                </div>
              </div>
            </a>
          );
        })}
        <a className="card card-link card-dark module-card" href="#/casos">
          <span className="tile-ico" style={{ background: 'var(--bronze-light)', color: 'var(--espresso)' }}><ClipboardList aria-hidden="true" /></span>
          <span className="module-cat" style={{ color: 'var(--bronze-light)' }}>Práctica integrada</span>
          <h3>Casos interactivos</h3>
          <p className="desc muted">Seis situaciones del servicio y un simulador de mesa completo, con decisiones y reintentos.</p>
          <span className="module-foot" style={{ borderColor: 'var(--espresso-line)', color: 'var(--bronze-light)', fontWeight: 650, fontSize: '0.9rem' }}>Ir a los casos →</span>
        </a>
        <a className="card card-link card-dark module-card" href="#/evaluacion/final">
          <span className="tile-ico" style={{ background: 'var(--bronze-light)', color: 'var(--espresso)' }}><GraduationCap aria-hidden="true" /></span>
          <span className="module-cat" style={{ color: 'var(--bronze-light)' }}>Cierre del recorrido</span>
          <h3>Cuestionario integrador</h3>
          <p className="desc muted">Quince preguntas de los diez módulos, con la explicación de cada respuesta.</p>
          <span className="module-foot" style={{ borderColor: 'var(--espresso-line)', color: 'var(--bronze-light)', fontWeight: 650, fontSize: '0.9rem' }}>Hacer el cuestionario →</span>
        </a>
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
  const tick = (on: boolean) => <span className={`tick${on ? ' on' : ''}`} aria-hidden="true">{on && <Check />}</span>;

  return (
    <article>
      <header className="module-hero fade-in">
        <span className="big-num" aria-hidden="true">{String(m.number).padStart(2, '0')}</span>
        <nav className="breadcrumb" aria-label="Ruta de navegación"><a href="#/aprender"><ArrowLeft size={15} aria-hidden="true" />Aprender</a></nav>
        <p className="eyebrow">Módulo {m.number} de {MODULES.length} · {m.category}</p>
        <h1>{m.title}</h1>
        <div className="row">
          <StatusBadge status={s.status} />
          <MetaBadges meta={m.meta} />
        </div>
        <div className="meta-strip">
          <span><Clock aria-hidden="true" />Lectura orientativa: {minutesOf(m)} min</span>
          <span><BookOpen aria-hidden="true" />{m.lessons.length} lecciones · {m.exercises.length} prácticas</span>
          <span>Fuente: {SOURCE_LABEL[m.meta.sourceType]} · v{m.meta.version} · {formatCivil(m.meta.updatedAt)}</span>
        </div>
        <div className="row no-print" style={{ marginTop: 20 }}>
          <a className="btn btn-ghost btn-sm" href={`#/imprimir/${m.id}`}><Printer aria-hidden="true" />Versión imprimible</a>
        </div>
      </header>

      <div className="module-layout">
        <div className="stack-lg" style={{ minWidth: 0 }}>
          <div>
            <div className="objective">
              <span className="tile-ico"><Target aria-hidden="true" /></span>
              <div><strong>Objetivo</strong><p>{m.objective}</p></div>
            </div>
            <p className="intro">{m.intro}</p>
            <nav className="lesson-nav mobile-only no-print" aria-label="Contenido del módulo">
              {m.lessons.map((l) => <a key={l.id} href={`#/aprender/${m.id}?l=${l.id}`}>{progress.lessonsRead[l.id] ? <CheckCircle2 aria-hidden="true" /> : null}{l.title}</a>)}
              {m.exercises.map((x) => <a key={x.id} href={`#/aprender/${m.id}?l=${x.id}`}>{progress.practices[x.id]?.completedAt ? <CheckCircle2 aria-hidden="true" /> : null}{x.title}</a>)}
              <a href={`#/aprender/${m.id}?l=${m.id}-sintesis`}>Síntesis</a>
              <a href={`#/evaluacion/${m.id}`}>Evaluación</a>
            </nav>
          </div>

          {m.lessons.map((l, i) => {
            const read = !!progress.lessonsRead[l.id];
            return (
              <section key={l.id} id={l.id} className="card lesson" tabIndex={-1} aria-labelledby={`${l.id}-t`}>
                <div className="lesson-head">
                  <div>
                    <p className="lesson-label"><b>Lección {i + 1}</b><span aria-hidden="true">·</span>{l.minutes} min</p>
                    <h2 id={`${l.id}-t`}>{l.title}</h2>
                  </div>
                  <FavoriteButton id={`lesson:${l.id}`} label={l.title} />
                </div>
                <Blocks blocks={l.blocks} />
                <div className="lesson-foot no-print">
                  {read ? <span className="read-state"><CheckCircle2 aria-hidden="true" />Leída</span> : <span className="unread-state"><Circle aria-hidden="true" />Sin marcar</span>}
                  <button type="button" className={`btn ${read ? 'btn-ghost' : 'btn-primary'} btn-sm`} aria-pressed={read} onClick={() => toggleRead(l.id, l.title)}>
                    {read ? 'Desmarcar lectura' : <><Check aria-hidden="true" />Marcar como leída</>}
                  </button>
                </div>
              </section>
            );
          })}

          {video && (
            <a className="link-card no-print" href={`#/videos?v=${video.id}`}>
              <span className="tile-ico dark"><Video aria-hidden="true" /></span>
              <span className="grow"><strong>Video del módulo: {video.title}</strong><span className="d">{video.summary}</span></span>
              <ArrowRight aria-hidden="true" className="go" />
            </a>
          )}

          {m.exercises.map((x) => <ExerciseView key={x.id} ex={x} moduleTitle={m.title} href={`#/aprender/${m.id}?l=${x.id}`} />)}

          <section id={`${m.id}-sintesis`} className="synthesis" tabIndex={-1} aria-label="Síntesis del módulo">
            <p className="eyebrow">Síntesis</p>
            <ul>{m.synthesis.map((t) => <li key={t}><Check aria-hidden="true" /><span>{t}</span></li>)}</ul>
            <blockquote>{m.closing}</blockquote>
          </section>

          <section className="card no-print" aria-labelledby={`${m.id}-eval`}>
            <div className="next-step">
              <span className="tile-ico dark" style={{ width: 52, height: 52, borderRadius: 16 }}><GraduationCap aria-hidden="true" /></span>
              <div>
                <h2 id={`${m.id}-eval`} style={{ fontSize: '1.4rem', margin: '0 0 4px' }}>Evaluación del módulo</h2>
                <p className="muted small" style={{ margin: 0 }}>
                  Tres preguntas con explicación después de cada respuesta.
                  {last ? ` Último resultado: ${pct(last)} % (${last.score} de ${last.total}). Intentos: ${s.attempts}.` : ' Todavía no hiciste ningún intento.'}
                  {progress.active[m.id] ? ' Tenés un intento en curso.' : ''}
                </p>
              </div>
              <a className="btn btn-primary" href={`#/evaluacion/${m.id}`}>{progress.active[m.id] ? 'Continuar evaluación' : s.attempts ? 'Reintentar evaluación' : 'Hacer la evaluación'}<ArrowRight aria-hidden="true" /></a>
            </div>
          </section>

          <nav className="row-between no-print" aria-label="Módulos contiguos">
            {prev ? <a className="btn btn-ghost" href={`#/aprender/${prev.id}`}><ArrowLeft aria-hidden="true" />Módulo {prev.number}</a> : <span />}
            {next ? <a className="btn btn-secondary" href={`#/aprender/${next.id}`}>Módulo {next.number}: {next.title}<ArrowRight aria-hidden="true" /></a> : <a className="btn btn-secondary" href="#/evaluacion/final">Cuestionario integrador<ArrowRight aria-hidden="true" /></a>}
          </nav>
        </div>

        <aside className="module-aside no-print" aria-label="Índice del módulo">
          <nav className="toc" aria-label="En este módulo">
            <h2>En este módulo</h2>
            <Meter value={s.percent} label="Avance" />
            <div className="sep">Lecciones</div>
            <ol>{m.lessons.map((l) => <li key={l.id}><a href={`#/aprender/${m.id}?l=${l.id}`}>{tick(!!progress.lessonsRead[l.id])}{l.title}</a></li>)}</ol>
            <div className="sep">Prácticas</div>
            <ol>{m.exercises.map((x) => <li key={x.id}><a href={`#/aprender/${m.id}?l=${x.id}`}>{tick(!!progress.practices[x.id]?.completedAt)}{x.title}</a></li>)}</ol>
            <div className="sep">Cierre</div>
            <ol>
              <li><a href={`#/aprender/${m.id}?l=${m.id}-sintesis`}>{tick(false)}Síntesis</a></li>
              <li><a href={`#/evaluacion/${m.id}`}>{tick(s.quizPassed)}Evaluación</a></li>
            </ol>
          </nav>
        </aside>
      </div>
    </article>
  );
}
