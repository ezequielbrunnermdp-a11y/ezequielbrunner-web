import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Film, AlertTriangle } from 'lucide-react';
import { Badge, Callout, PageHeader, toast } from '../../components/ui';
import { VideoPendingArt } from '../../components/Illustrations';
import { VIDEO_SCRIPTS } from '../../content/library';
import { MODULE_BY_ID } from '../../content/modules';
import { store, useContent, useProgress } from '../../storage/store';
import { fileURL } from '../../storage/idb';
import { formatTimestamp } from '../../lib/format';
import type { VideoRecord } from '../../storage/schema';

/** Une intervalos reproducidos y devuelve el total de segundos efectivamente vistos. */
export function mergeIntervals(list: [number, number][]): [number, number][] {
  const s = [...list].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
export function watchedSeconds(list: [number, number][]) {
  return mergeIntervals(list).reduce((n, [a, b]) => n + (b - a), 0);
}
export function watchedPercent(r: VideoRecord | undefined) {
  if (!r?.duration) return 0;
  return Math.min(100, Math.round((watchedSeconds(r.intervals) / r.duration) * 100));
}

function Player({ videoId, fileId, captionsId, title, directSrc, directCaptions }: { videoId: string; fileId: string | null; captionsId: string | null; title: string; directSrc?: string | null; directCaptions?: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  const [tracks, setTracks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const lastT = useRef<number | null>(null);
  const pending = useRef<[number, number][]>([]);

  useEffect(() => {
    let alive = true;
    if (directSrc) { setSrc(directSrc); setTracks(directCaptions ?? null); return () => { alive = false; }; }
    if (!fileId) return () => { alive = false; };
    fileURL(fileId).then((u) => { if (alive) { if (u) setSrc(u); else setError('El archivo asociado ya no está en este dispositivo. Volvé a asociarlo desde “Gestionar contenido”.'); } })
      .catch(() => alive && setError('No se pudo leer el archivo guardado en este navegador.'));
    if (captionsId) fileURL(captionsId).then((u) => alive && setTracks(u)).catch(() => undefined);
    return () => { alive = false; };
  }, [fileId, captionsId, directSrc, directCaptions]);

  const flush = () => {
    const v = ref.current;
    if (!pending.current.length) return;
    const add = pending.current;
    pending.current = [];
    store.updateProgress((p) => {
      const prev = p.videos[videoId] ?? { intervals: [], duration: null, readEquivalentAt: null };
      return { ...p, videos: { ...p.videos, [videoId]: { ...prev, duration: v && Number.isFinite(v.duration) ? v.duration : prev.duration, intervals: mergeIntervals([...prev.intervals, ...add]) } } };
    });
  };

  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="video-frame"><div className="video-pending"><AlertTriangle aria-hidden="true" /><p>{error}</p></div></div>;
  if (!src) return <div className="video-frame"><p>Cargando video…</p></div>;
  return (
    <div className="video-frame">
      <video ref={ref} controls playsInline preload="metadata" src={src} aria-label={title}
        onError={() => setError('El navegador no pudo reproducir este archivo. Probá con un MP4 (H.264 y AAC).')}
        onPlay={() => { lastT.current = ref.current?.currentTime ?? null; }}
        onTimeUpdate={() => {
          const v = ref.current; if (!v || v.paused) return;
          const t = v.currentTime;
          // Solo cuentan los avances continuos: un salto con el cursor no suma tiempo visto.
          if (lastT.current !== null && t > lastT.current && t - lastT.current < 1.5) pending.current.push([lastT.current, t]);
          lastT.current = t;
          if (pending.current.length > 20) flush();
        }}
        onSeeking={() => { lastT.current = null; }}
        onSeeked={() => { lastT.current = ref.current?.currentTime ?? null; }}
        onPause={flush} onEnded={flush}>
        {tracks && <track kind="subtitles" srcLang="es" label="Español" src={tracks} default />}
      </video>
    </div>
  );
}

export function VideosPage({ focus }: { focus: string | null }) {
  const content = useContent();
  const progress = useProgress();
  useEffect(() => {
    if (focus) setTimeout(() => document.getElementById(`video-${focus}`)?.scrollIntoView({ block: 'start' }), 60);
  }, [focus]);
  return (
    <>
      <PageHeader eyebrow="Audiovisual" title="Videos de El Cóndor" lead="Tres espacios preparados para videos propios. Mientras no estén disponibles, podés completar el aprendizaje leyendo el contenido equivalente." />
      <Callout tone="info" title="Cómo se registra">El porcentaje visto se calcula con los tramos efectivamente reproducidos: mover el cursor hasta el final no cuenta como visualización completa. “Leí el contenido equivalente” se registra como lectura, no como video visto.</Callout>
      <div className="stack-lg">
        {VIDEO_SCRIPTS.map((v, i) => {
          const slot = content.videos[v.id];
          const rec = progress.videos[v.id];
          const percent = watchedPercent(rec);
          return (
            <section key={v.id} id={`video-${v.id}`} className="card" aria-labelledby={`${v.id}-t`} style={{ scrollMarginTop: 90 }}>
              <div className="row-between" style={{ marginBottom: 14 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 4 }}>Guion {i + 1} · Módulo {MODULE_BY_ID[v.moduleId].number}</p>
                  <h2 id={`${v.id}-t`} style={{ margin: 0 }}>{v.title}</h2>
                </div>
                <div className="badges">
                  {v.src ? <Badge tone="ok" icon={<Film aria-hidden="true" />}>Video publicado</Badge> : slot?.fileId ? <Badge tone="ok" icon={<Film aria-hidden="true" />}>Video en este dispositivo</Badge> : <Badge tone="proposed">Video propio pendiente</Badge>}
                  {rec?.duration ? <Badge>{percent} % visto</Badge> : null}
                  {rec?.readEquivalentAt && <Badge tone="ok" icon={<CheckCircle2 aria-hidden="true" />}>Contenido leído</Badge>}
                </div>
              </div>
              {v.src ? (
                <Player videoId={v.id} fileId={null} captionsId={null} title={v.title} directSrc={v.src} directCaptions={v.captions} />
              ) : slot?.fileId ? (
                <Player videoId={v.id} fileId={slot.fileId} captionsId={slot.captionsFileId} title={v.title} />
              ) : (
                <div className="video-frame">
                  <div className="video-pending">
                    <VideoPendingArt />
                    <p style={{ margin: '8px 0 4px', fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>Video propio pendiente</p>
                    <p className="small" style={{ color: '#ddd4c7', margin: 0, maxWidth: '44ch' }}>Este espacio está preparado para un video de El Cóndor. Todavía no se grabó ni se asoció ningún archivo.</p>
                  </div>
                </div>
              )}
              <h3 style={{ marginTop: 22 }}>Contenido equivalente en texto</h3>
              <p className="script">{v.script}</p>
              <div className="row">
                <button type="button" className="btn btn-secondary" disabled={!!rec?.readEquivalentAt} onClick={() => {
                  store.updateProgress((p) => {
                    const prev = p.videos[v.id] ?? { intervals: [], duration: null, readEquivalentAt: null };
                    return { ...p, videos: { ...p.videos, [v.id]: { ...prev, readEquivalentAt: new Date().toISOString() } }, lastActivity: { at: new Date().toISOString(), label: `Video: ${v.title}`, href: `#/videos?v=${v.id}` } };
                  });
                  toast('Lectura registrada');
                }}>
                  <BookOpenCheck aria-hidden="true" />{rec?.readEquivalentAt ? `Leído el ${formatTimestamp(rec.readEquivalentAt)}` : 'Leí el contenido equivalente'}
                </button>
                <a className="btn btn-ghost" href={`#/aprender/${v.moduleId}`}>Ir al módulo {MODULE_BY_ID[v.moduleId].number}</a>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
