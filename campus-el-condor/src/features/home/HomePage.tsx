import { ArrowRight, BookOpen, ClipboardList, Search, Users, Video, Library, RotateCcw, Hash } from 'lucide-react';
import { HeroCup } from '../../components/Illustrations';
import { Badge, Callout, Meter } from '../../components/ui';
import { useContent, useProgress, useActiveProfile, store } from '../../storage/store';
import { nextStep, overallStats, reviewRecommendations, moduleStats } from '../../lib/learning';
import { useModules } from '../learn/useModule';
import { StatusBadge } from '../learn/LearnPages';
import { formatTimestamp } from '../../lib/format';
import { BRAND } from '../../brand.config';

export function HomePage() {
  const progress = useProgress();
  const content = useContent();
  const profile = useActiveProfile();
  const modules = useModules();
  const stats = overallStats(progress);
  const next = nextStep(progress);
  const recs = reviewRecommendations(progress);
  const last = progress.lastActivity;
  const title = content.texts.homeTitle?.trim() || 'Cada buen servicio empieza por un equipo preparado.';
  const text = content.texts.homeText?.trim() || 'Aprendé, practicá y encontrá lo que necesitás para trabajar con más claridad y confianza.';
  const started = stats.started;
  const continueHref = last?.href ?? next?.href ?? '#/aprender/m1';

  return (
    <div className="stack-lg">
      <section className="hero fade-in" aria-labelledby="home-title">
        <div>
          <p className="eyebrow">{BRAND.fullName.replace(' Coffee Shop', '')} · Campus de formación</p>
          <h1 id="home-title">{title}</h1>
          <p>{text}</p>
          <div className="row" style={{ marginTop: 22 }}>
            {started ? (
              <a className="btn btn-primary" href={continueHref}>Continuar donde quedé<ArrowRight aria-hidden="true" /></a>
            ) : (
              <a className="btn btn-primary" href="#/aprender/m1">Empezar mi recorrido<ArrowRight aria-hidden="true" /></a>
            )}
            <a className="btn btn-secondary" href="#/consultar"><Search aria-hidden="true" />Consultar una duda</a>
          </div>
          {started && last && <p className="small" style={{ marginTop: 14, marginBottom: 0, color: '#c9bfb2' }}>Última actividad: {last.label} · {formatTimestamp(last.at)}</p>}
        </div>
        <HeroCup className="hero-art" />
      </section>

      {started && (
        <section className="card" aria-labelledby="home-progress">
          <div className="row-between">
            <div>
              <p className="eyebrow">{profile.alias ? `Hola, ${profile.alias}` : 'Tu avance'}</p>
              <h2 id="home-progress" style={{ marginBottom: 4 }}>{stats.completed} de {modules.length} módulos completados</h2>
              <p className="muted small" style={{ margin: 0 }}>{stats.lessonsRead} de {stats.lessonsTotal} lecciones leídas · {stats.practicesDone} de {stats.practicesTotal} prácticas · {progress.attempts.length} evaluaciones realizadas</p>
            </div>
            {next && <a className="btn btn-secondary" href={next.href}>Siguiente: {next.label}<ArrowRight aria-hidden="true" /></a>}
          </div>
          <div style={{ marginTop: 16 }}><Meter value={(stats.lessonsRead + stats.practicesDone) / (stats.lessonsTotal + stats.practicesTotal) * 100} label="Lecturas y prácticas" /></div>
        </section>
      )}

      {recs.length > 0 && (
        <section aria-labelledby="home-recs">
          <div className="section-title"><h2 id="home-recs">Para repasar</h2><a href="#/progreso">Ver todos los errores</a></div>
          <p className="muted">Según tus respuestas incorrectas más recientes que todavía no corregiste.</p>
          <div className="grid">
            {recs.slice(0, 3).map(({ module: m, qids }) => (
              <a key={m.id} className="card card-link" href={`#/aprender/${m.id}`}>
                <Badge tone="err" icon={<RotateCcw aria-hidden="true" />}>{qids.length} pregunta{qids.length === 1 ? '' : 's'} para repasar</Badge>
                <h3 style={{ marginTop: 10 }}>Módulo {m.number}: {m.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>Releé la lección y volvé a intentar la evaluación.</p>
              </a>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="home-path">
        <div className="section-title"><h2 id="home-path">Recorrido sugerido</h2><a href="#/aprender">Ver todos los módulos</a></div>
        <ol className="list-plain">
          {modules.map((m) => {
            const s = moduleStats(progress, m);
            return (
              <li key={m.id}>
                <a className="result row" href={`#/aprender/${m.id}`} style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 16 }}>
                  <span className="module-num" style={{ fontSize: '1.8rem', minWidth: 40 }} aria-hidden="true">{String(m.number).padStart(2, '0')}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', display: 'block' }}>{m.title}</strong>
                    <span className="small muted">{m.short}</span>
                  </span>
                  <StatusBadge status={s.status} />
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="home-quick">
        <h2 id="home-quick">Accesos rápidos</h2>
        <div className="grid-3">
          {[
            { href: '#/casos', Icon: ClipboardList, t: 'Casos interactivos', d: 'Seis situaciones y un simulador de mesa.' },
            { href: '#/evaluacion/final', Icon: BookOpen, t: 'Cuestionario integrador', d: 'Quince preguntas con explicación.' },
            { href: '#/consultar/codigos', Icon: Hash, t: 'Códigos', d: content.codes.length ? `${content.codes.length} códigos cargados.` : 'Tabla oficial pendiente.' },
            { href: '#/consultar/biblioteca', Icon: Library, t: 'Biblioteca', d: 'Materiales y estado de documentos.' },
            { href: '#/videos', Icon: Video, t: 'Videos', d: 'Tres guiones con contenido equivalente.' },
            { href: '#/facilitador', Icon: Users, t: 'Modo facilitador', d: 'Evaluación oral con respuestas esperadas.' },
          ].map(({ href, Icon, t, d }) => (
            <a key={href} className="card card-link" href={href}>
              <Icon aria-hidden="true" color="var(--bronze-text)" />
              <h3 style={{ marginTop: 10, fontSize: '1.2rem' }}>{t}</h3>
              <p className="small muted" style={{ margin: 0 }}>{d}</p>
            </a>
          ))}
        </div>
      </section>

      {!store.storageOk() && <Callout tone="err" title="El progreso no se está guardando">Este navegador bloquea el almacenamiento local (por ejemplo, en modo privado). Podés usar el campus, pero al cerrarlo se perderá el avance.</Callout>}
      <Callout tone="info" title="Tu progreso queda en este dispositivo">Se guarda en este navegador y no se sincroniza con otros teléfonos ni genera reportes para el equipo. <a href="#/acerca">Ver límites de esta versión</a>.</Callout>
    </div>
  );
}
