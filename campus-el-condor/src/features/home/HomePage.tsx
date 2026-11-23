import { ArrowRight, BookOpen, Check, ClipboardList, Search, Users, Video, Library, RotateCcw, Hash, Info } from 'lucide-react';
import { HeroCup } from '../../components/Illustrations';
import { BrandLarge } from '../../components/Brand';
import { Badge, Callout, Meter } from '../../components/ui';
import { useContent, useProgress, useActiveProfile, store } from '../../storage/store';
import { nextStep, overallStats, reviewRecommendations, moduleStats, STATUS_LABEL } from '../../lib/learning';
import { useModules } from '../learn/useModule';
import { formatTimestamp } from '../../lib/format';
import { AUTH_ENABLED } from '../../auth/config';

export function HomePage() {
  const progress = useProgress();
  const content = useContent();
  const profile = useActiveProfile();
  const modules = useModules();
  const stats = overallStats(progress);
  const next = nextStep(progress);
  const recs = reviewRecommendations(progress);
  const last = progress.lastActivity;
  const customTitle = content.texts.homeTitle?.trim();
  const text = content.texts.homeText?.trim() || 'Aprendé, practicá y encontrá lo que necesitás para trabajar con más claridad y confianza.';
  const started = stats.started;
  const continueHref = last?.href ?? next?.href ?? '#/aprender/m1';

  return (
    <div className="stack-lg">
      <section className="hero fade-in" aria-labelledby="home-title">
        <div>
          <BrandLarge className="hero-logo" />
          <p className="eyebrow">Campus de formación</p>
          <h1 id="home-title">{customTitle ? customTitle : <>Cada buen servicio empieza por un <em>equipo preparado.</em></>}</h1>
          <p className="hero-text">{text}</p>
          <div className="hero-actions">
            {started ? (
              <a className="btn btn-primary" href={continueHref}>Continuar donde quedé<ArrowRight aria-hidden="true" /></a>
            ) : (
              <a className="btn btn-primary" href="#/aprender/m1">Empezar mi recorrido<ArrowRight aria-hidden="true" /></a>
            )}
            <a className="btn btn-secondary" href="#/consultar"><Search aria-hidden="true" />Consultar una duda</a>
          </div>
          {started && last && <p className="hero-meta">Última actividad: {last.label} · {formatTimestamp(last.at)}</p>}
        </div>
        <HeroCup className="hero-art" />
      </section>

      {started && (
        <section aria-labelledby="home-progress">
          <h2 id="home-progress" className="sr-only">Tu avance</h2>
          <div className="hero-stats">
            <div><strong>{stats.completed}<small> / {modules.length}</small></strong><span>Módulos completados</span></div>
            <div><strong>{stats.lessonsRead}<small> / {stats.lessonsTotal}</small></strong><span>Lecciones leídas</span></div>
            <div><strong>{stats.practicesDone}<small> / {stats.practicesTotal}</small></strong><span>Prácticas hechas</span></div>
          </div>
        </section>
      )}

      {next && (
        <section className="card" aria-labelledby="home-next">
          <div className="next-step">
            <span className="next-num" aria-hidden="true">{String(next.module.number).padStart(2, '0')}</span>
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>{started ? (profile.alias ? `${profile.alias}, tu próximo paso` : 'Tu próximo paso') : 'Por dónde empezar'}</p>
              <h2 id="home-next">{next.module.title}</h2>
              <p className="muted" style={{ margin: 0 }}>{next.label.split(' · ').slice(1).join(' · ') || next.module.short}</p>
            </div>
            <a className="btn btn-primary" href={next.href}>{started ? 'Seguir' : 'Empezar'}<ArrowRight aria-hidden="true" /></a>
          </div>
          {started && <div style={{ marginTop: 20 }}><Meter value={((stats.lessonsRead + stats.practicesDone) / (stats.lessonsTotal + stats.practicesTotal)) * 100} label="Lecturas y prácticas del recorrido" /></div>}
        </section>
      )}

      {recs.length > 0 && (
        <section aria-labelledby="home-recs">
          <div className="section-title"><h2 id="home-recs">Para repasar</h2><a href="#/progreso">Ver todos los errores</a></div>
          <p className="muted" style={{ marginTop: -6 }}>Según tus respuestas incorrectas más recientes que todavía no corregiste.</p>
          <div className="grid">
            {recs.slice(0, 3).map(({ module: m, qids }) => (
              <a key={m.id} className="card card-link" href={`#/aprender/${m.id}`}>
                <Badge tone="err" icon={<RotateCcw aria-hidden="true" />}>{qids.length} pregunta{qids.length === 1 ? '' : 's'} para repasar</Badge>
                <h3 style={{ marginTop: 12 }}>Módulo {m.number}: {m.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>Releé la lección y volvé a intentar la evaluación.</p>
              </a>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="home-path">
        <div className="section-title"><h2 id="home-path">Recorrido sugerido</h2><a href="#/aprender">Ver todos los módulos</a></div>
        <ol className="path">
          {modules.map((m) => {
            const s = moduleStats(progress, m);
            const cls = s.status === 'completado' ? 'done' : s.status === 'sin-empezar' ? '' : 'doing';
            return (
              <li key={m.id} className={cls}>
                <a href={`#/aprender/${m.id}`}>
                  <span className="pnum" aria-hidden="true">{s.status === 'completado' ? <Check /> : m.number}</span>
                  <span>
                    <span className="ptitle"><span className="sr-only">Módulo {m.number}: </span>{m.title}</span>
                    <span className="pstate">{STATUS_LABEL[s.status]}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="home-quick">
        <div className="section-title"><h2 id="home-quick">Accesos rápidos</h2></div>
        <div className="quick">
          {[
            { href: '#/casos', Icon: ClipboardList, t: 'Casos interactivos', d: 'Seis situaciones del servicio y un simulador de mesa.' },
            { href: '#/evaluacion/final', Icon: BookOpen, t: 'Cuestionario integrador', d: 'Quince preguntas con explicación.' },
            { href: '#/consultar/codigos', Icon: Hash, t: 'Códigos', d: content.codes.length ? `${content.codes.length.toLocaleString('es-AR')} códigos activos para consultar.` : 'Tabla oficial pendiente de carga.' },
            { href: '#/consultar/biblioteca', Icon: Library, t: 'Biblioteca', d: 'Materiales y estado de cada documento.' },
            { href: '#/videos', Icon: Video, t: 'Videos', d: 'Tres guiones con su texto equivalente.' },
            { href: '#/facilitador', Icon: Users, t: 'Modo facilitador', d: 'Evaluación oral con respuestas esperadas.' },
          ].map(({ href, Icon, t, d }) => (
            <a key={href} href={href}>
              <span className="tile-ico"><Icon aria-hidden="true" /></span>
              <span><strong>{t}</strong><span className="d">{d}</span></span>
            </a>
          ))}
        </div>
      </section>

      {!store.storageOk() && <Callout tone="err" title="El progreso no se está guardando">Este navegador bloquea el almacenamiento local (por ejemplo, en modo privado). Podés usar el campus, pero al cerrarlo se perderá el avance.</Callout>}
      <p className="small muted row" style={{ gap: 8, justifyContent: 'center', textAlign: 'center' }}>
        <Info size={15} aria-hidden="true" />{AUTH_ENABLED ? 'Tu progreso se guarda en tu usuario: podés seguir desde cualquier dispositivo.' : 'Tu progreso queda en este dispositivo y no se sincroniza con otros teléfonos.'} <a href="#/acerca">Ver más</a>
      </p>
    </div>
  );
}
