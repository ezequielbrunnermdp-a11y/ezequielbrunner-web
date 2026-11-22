import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, CheckCircle2, BookOpen, ClipboardCheck, ListChecks, Clock } from 'lucide-react';
import { Badge, Callout, ConfirmModal, EmptyState, Meter, Modal, PageHeader, Ring, toast } from '../../components/ui';
import { EmptyBook } from '../../components/Illustrations';
import { store, useActiveProfile, useProgress, useStore, profileName } from '../../storage/store';
import { overallStats, pct, passed } from '../../lib/learning';
import { QUESTION_BY_ID } from '../../content/questions';
import { MODULE_BY_ID } from '../../content/modules';
import { formatTimestamp } from '../../lib/format';
import { buildProgressBackup, downloadJSON, readJSONFile, validateProgressBackup, type ProgressBackup } from '../../storage/backup';
import { StatusBadge } from '../learn/LearnPages';
import { VIDEO_SCRIPTS } from '../../content/library';
import { watchedPercent } from '../videos/VideosPage';

export function ProgressPage() {
  const progress = useProgress();
  const profile = useActiveProfile();
  const profiles = useStore((s) => s.profiles);
  const stats = overallStats(progress);
  const wrong = Object.entries(progress.wrong).sort((a, b) => b[1].at.localeCompare(a[1].at));
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [pending, setPending] = useState<ProgressBackup | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const overall = Math.round(((stats.lessonsRead + stats.practicesDone + stats.per.filter((x) => x.s.quizPassed).length) / (stats.lessonsTotal + stats.practicesTotal + stats.per.length)) * 100);

  const onImport = async (f: File | undefined) => {
    setErrors(null);
    if (!f) return;
    try {
      const raw = await readJSONFile(f);
      const v = validateProgressBackup(raw);
      if (!v.ok) { setErrors(v.errors); return; }
      setPending(v.value);
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };
  const existing = pending ? profiles.find((p) => p.id === pending.profile.id) : undefined;
  const existingProgress = existing ? store.readProgressOf(existing.id) : null;

  return (
    <>
      <PageHeader eyebrow="Progreso" title={`Avance de ${profileName(profile)}`} lead="Datos reales de tu perfil local: lecturas, prácticas, evaluaciones y errores para repasar.">
        <button type="button" className="btn btn-secondary" onClick={() => downloadJSON(`progreso-el-condor-${new Date().toISOString().slice(0, 10)}.json`, buildProgressBackup(profile, progress))}><Download aria-hidden="true" />Exportar respaldo</button>
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" />Importar respaldo</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
      </PageHeader>
      {errors && <Callout tone="err" title="No se importó el respaldo">Tu progreso actual no cambió. {errors.join(' ')}</Callout>}

      <section className="card row" style={{ gap: 24, marginBottom: 24 }}>
        <Ring value={overall} />
        <div className="grid-3" style={{ flex: 1 }}>
          <div className="stat"><strong>{stats.lessonsRead}/{stats.lessonsTotal}</strong><span>Lecciones leídas</span></div>
          <div className="stat"><strong>{stats.practicesDone}/{stats.practicesTotal}</strong><span>Prácticas completadas</span></div>
          <div className="stat"><strong>{progress.attempts.length}</strong><span>Intentos de evaluación</span></div>
          <div className="stat"><strong>{wrong.length}</strong><span>Errores para repasar</span></div>
        </div>
      </section>
      <p className="small muted"><Clock size={14} aria-hidden="true" /> Última actividad: {progress.lastActivity ? `${progress.lastActivity.label} · ${formatTimestamp(progress.lastActivity.at)}` : 'Sin actividad registrada'}</p>

      <section className="section">
        <h2>Por módulo</h2>
        <div className="table-wrap">
          <table className="responsive">
            <thead><tr><th>Módulo</th><th>Estado</th><th>Lecturas</th><th>Prácticas</th><th>Evaluación</th><th>Intentos</th></tr></thead>
            <tbody>
              {stats.per.map(({ m, s }) => (
                <tr key={m.id}>
                  <td data-label="Módulo"><a href={`#/aprender/${m.id}`}>{m.number}. {m.title}</a><div style={{ marginTop: 6, maxWidth: 220 }}><Meter value={s.percent} label={`Avance del módulo ${m.number}`} /></div></td>
                  <td data-label="Estado"><StatusBadge status={s.status} /></td>
                  <td data-label="Lecturas"><BookOpen size={14} aria-hidden="true" /> {s.lessonsRead}/{m.lessons.length}</td>
                  <td data-label="Prácticas"><ClipboardCheck size={14} aria-hidden="true" /> {s.practicesDone}/{m.exercises.length}</td>
                  <td data-label="Evaluación">{s.best ? `${pct(s.best)} % (mejor)` : 'Sin intentos'}</td>
                  <td data-label="Intentos">{s.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-title"><h2>Errores para repasar</h2>{wrong.length > 0 && <span className="small muted">Desaparecen cuando respondés bien esa pregunta en otro intento.</span>}</div>
        {wrong.length === 0 ? (
          <EmptyState art={<EmptyBook />} title="Sin errores pendientes" actions={<a className="btn btn-secondary" href="#/evaluacion">Ir a evaluaciones</a>}>Cuando respondas una pregunta de forma incorrecta, va a aparecer acá con su explicación.</EmptyState>
        ) : (
          <div className="stack">
            {wrong.map(([qid, w]) => {
              const q = QUESTION_BY_ID[qid];
              if (!q) return null;
              return (
                <div key={qid} className="card-flat">
                  <div className="row-between"><span className="small muted">{q.id} · Módulo {MODULE_BY_ID[q.moduleId].number} · {formatTimestamp(w.at)}</span><Badge tone="err">{w.count} vez{w.count === 1 ? '' : 'es'} incorrecta</Badge></div>
                  <h3 style={{ fontSize: '1.2rem', margin: '8px 0' }}>{q.prompt}</h3>
                  <p className="small" style={{ color: 'var(--ok)' }}><strong>Respuesta correcta:</strong> {q.options.find((o) => o.id === q.correct)?.text}</p>
                  <p className="small" style={{ margin: 0 }}>{q.explanation}</p>
                  <div className="row" style={{ marginTop: 10 }}>
                    <a className="btn btn-ghost btn-sm" href={`#/aprender/${q.moduleId}`}>Repasar módulo</a>
                    <a className="btn btn-secondary btn-sm" href={`#/evaluacion/${q.moduleId}`}><RotateCcw aria-hidden="true" />Reintentar evaluación</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Resultados de evaluaciones</h2>
        {progress.attempts.length === 0 ? <p className="muted">Todavía no completaste ninguna evaluación.</p> : (
          <div className="table-wrap">
            <table className="responsive">
              <thead><tr><th>Fecha</th><th>Evaluación</th><th>Resultado</th><th>Umbral</th><th><span className="sr-only">Detalle</span></th></tr></thead>
              <tbody>
                {[...progress.attempts].reverse().map((a) => {
                  const key = a.kind === 'final' ? 'final' : a.moduleId!;
                  return (
                    <tr key={a.id}>
                      <td data-label="Fecha">{formatTimestamp(a.finishedAt)}</td>
                      <td data-label="Evaluación">{a.kind === 'final' ? 'Integrador' : `Módulo ${MODULE_BY_ID[a.moduleId!].number}`}</td>
                      <td data-label="Resultado">{a.score}/{a.total} · {pct(a)} %</td>
                      <td data-label="Umbral">{passed(a) ? <Badge tone="ok" icon={<CheckCircle2 aria-hidden="true" />}>Alcanzado</Badge> : <Badge tone="err">No alcanzado</Badge>}</td>
                      <td data-label="Detalle"><a href={`#/evaluacion/${key}?r=${a.id}`}><ListChecks size={14} aria-hidden="true" /> Ver</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Videos y contenido equivalente</h2>
        <ul className="list-plain">
          {VIDEO_SCRIPTS.map((v) => {
            const r = progress.videos[v.id];
            return <li key={v.id} className="card-flat row-between"><span>{v.title}</span><span className="badges">{r?.duration ? <Badge>{watchedPercent(r)} % visto</Badge> : <Badge>Sin reproducción</Badge>}{r?.readEquivalentAt ? <Badge tone="ok">Texto leído</Badge> : <Badge>Texto sin leer</Badge>}</span></li>;
          })}
        </ul>
      </section>

      <Callout tone="info" title="Límites del progreso local">Este progreso está guardado en este navegador. Se pierde si se borra el almacenamiento del navegador, y no se sincroniza entre dispositivos. Exportá un respaldo si vas a cambiar de teléfono. No hay reportes colectivos del equipo.</Callout>
      <div className="row">
        <a className="btn btn-ghost" href="#/perfiles">Administrar perfiles locales</a>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setResetOpen(true)}>Borrar el progreso de este perfil</button>
      </div>

      <ConfirmModal open={resetOpen} onClose={() => setResetOpen(false)} title="Borrar progreso" confirmLabel="Borrar progreso" danger onConfirm={() => { store.resetProgress(); toast('Progreso borrado'); }}>
        <p>Se borrarán lecturas, prácticas, intentos, errores, favoritos y plan de repaso de <strong>{profileName(profile)}</strong>. No se puede deshacer. Si querés conservarlo, exportá un respaldo antes.</p>
      </ConfirmModal>

      <Modal open={!!pending} onClose={() => setPending(null)} title="Importar respaldo" footer={pending && (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>Cancelar</button>
          <button type="button" className="btn btn-secondary" onClick={() => { store.importProgress(pending.profile, pending.progress, 'new'); setPending(null); toast('Respaldo importado como perfil nuevo'); }}>Importar como perfil nuevo</button>
          {existing && <button type="button" className="btn btn-danger" onClick={() => { store.importProgress(pending.profile, pending.progress, 'replace'); setPending(null); toast('Progreso reemplazado'); }}>Reemplazar progreso existente</button>}
          {!existing && <button type="button" className="btn btn-primary" onClick={() => { store.importProgress(pending.profile, pending.progress, 'replace'); setPending(null); toast('Respaldo importado'); }}>Importar</button>}
        </>
      )}>
        {pending && (
          <div className="stack">
            <dl className="kv">
              <dt>Perfil</dt><dd>{pending.profile.alias || 'Sin alias'}{pending.profile.sector ? ` · ${pending.profile.sector}` : ''}</dd>
              <dt>Exportado</dt><dd>{formatTimestamp(pending.exportedAt)}</dd>
              <dt>Contenido</dt><dd>{Object.keys(pending.progress.lessonsRead).length} lecturas · {Object.keys(pending.progress.practices).length} prácticas · {pending.progress.attempts.length} intentos</dd>
            </dl>
            {existing && existingProgress ? (
              <Callout tone="warning" title="Conflicto: este perfil ya existe en el dispositivo">
                El perfil {profileName(existing)} tiene {Object.keys(existingProgress.lessonsRead).length} lecturas y {existingProgress.attempts.length} intentos. Reemplazarlo borra ese progreso. Si no estás seguro, importalo como perfil nuevo.
              </Callout>
            ) : <p>El perfil no existe en este dispositivo: se agregará como perfil local.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
