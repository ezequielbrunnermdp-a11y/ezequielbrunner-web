import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Film, Image as ImageIcon, Printer, Settings, Clock, BookOpen } from 'lucide-react';
import { Badge, Callout, FavoriteButton, Modal, ProposedBadge } from '../../components/ui';
import { useContent } from '../../storage/store';
import { resolveResources } from './searchIndex';
import { fileURL, getFile } from '../../storage/idb';
import type { Resource } from '../../content/types';
import { formatCivil } from '../../lib/format';
import { setQuery } from '../../app/router';

const KIND_ICON = { pdf: FileText, imagen: ImageIcon, video: Film, documento: FileText, leccion: BookOpen };
const KIND_LABEL = { pdf: 'PDF', imagen: 'Imagen', video: 'Video', documento: 'Documento', leccion: 'Lección imprimible' };

function useResourceFile(r: Resource | undefined) {
  const [state, setState] = useState<{ url: string | null; type: string | null; name: string | null; missing: boolean }>({ url: null, type: null, name: null, missing: false });
  useEffect(() => {
    let alive = true;
    if (!r) return;
    if (r.fileId) {
      Promise.all([fileURL(r.fileId), getFile(r.fileId)]).then(([u, f]) => {
        if (alive) setState({ url: u, type: f?.type ?? null, name: f?.name ?? null, missing: !u });
      }).catch(() => alive && setState({ url: null, type: null, name: null, missing: true }));
    } else if (r.href) {
      setState({ url: r.href, type: r.kind === 'pdf' ? 'application/pdf' : null, name: r.href.split('/').pop() ?? null, missing: false });
    } else setState({ url: null, type: null, name: null, missing: false });
    return () => { alive = false; };
  }, [r?.fileId, r?.href]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function Viewer({ r }: { r: Resource }) {
  const f = useResourceFile(r);
  const [frameError, setFrameError] = useState(false);
  const available = !!(r.fileId || r.href);
  if (r.kind === 'leccion') {
    return (
      <div>
        <ProposedBadge />
        <p style={{ marginTop: 12 }}>{r.description} Se imprime identificada como contenido pedagógico propuesto, no como política aprobada.</p>
        <a className="btn btn-primary" href={`#/imprimir/${r.lessonModuleId}`}><Printer aria-hidden="true" />Abrir versión imprimible</a>
      </div>
    );
  }
  if (!available) {
    return (
      <div>
        <Callout tone="pending" title="Material pendiente">Todavía no se asoció ningún archivo de El Cóndor a este recurso. No hay nada para ver ni descargar.</Callout>
        <p className="small">Si tenés el documento oficial, podés asociarlo en este dispositivo desde “Gestionar contenido”. Para que lo vean todas las personas, hay que incluirlo en una nueva publicación del sitio (ver docs/publicacion-cloudflare.md).</p>
        <a className="btn btn-secondary" href="#/gestionar?t=archivos"><Settings aria-hidden="true" />Asociar archivo</a>
      </div>
    );
  }
  if (f.missing) return <Callout tone="err" title="Archivo no encontrado">El archivo asociado ya no está en este navegador (pudo borrarse el almacenamiento). Volvé a asociarlo desde “Gestionar contenido”.</Callout>;
  if (!f.url) return <p>Cargando material…</p>;
  const isPdf = (f.type ?? '').includes('pdf') || r.kind === 'pdf';
  const isImg = (f.type ?? '').startsWith('image/') || r.kind === 'imagen';
  const isVideo = (f.type ?? '').startsWith('video/') || r.kind === 'video';
  return (
    <div className="stack">
      <div className="row">
        <a className="btn btn-primary btn-sm" href={f.url} target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />Abrir en otra pestaña</a>
        <a className="btn btn-secondary btn-sm" href={f.url} download={f.name ?? r.title}><Download aria-hidden="true" />Descargar</a>
      </div>
      {isPdf && !frameError && (
        <>
          <iframe title={r.title} src={f.url} style={{ width: '100%', height: '70vh', border: '1px solid var(--line)', borderRadius: 12 }} onError={() => setFrameError(true)} />
          <p className="small muted">Si el visor no se muestra en tu teléfono, usá “Abrir en otra pestaña”.</p>
        </>
      )}
      {isImg && <img src={f.url} alt={r.title} loading="lazy" style={{ borderRadius: 12, border: '1px solid var(--line)' }} />}
      {isVideo && <video src={f.url} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 12 }} />}
      {!isPdf && !isImg && !isVideo && <p className="small">Este tipo de archivo no puede previsualizarse. Usá “Abrir en otra pestaña” o “Descargar”.</p>}
      {!r.searchText && <p className="small muted">El buscador no recorre el contenido de este archivo: no se cargó texto extraído.</p>}
    </div>
  );
}

export function LibrarySection({ query }: { query: URLSearchParams }) {
  const content = useContent();
  const resources = resolveResources(content);
  const [cat, setCat] = useState('');
  const cats = [...new Set(resources.map((r) => r.category))];
  const openId = query.get('r');
  const open = resources.find((r) => r.id === openId);
  const list = resources.filter((r) => !cat || r.category === cat);
  return (
    <section aria-label="Biblioteca">
      <div className="chips" style={{ marginBottom: 16 }} role="group" aria-label="Filtrar por categoría">
        <button type="button" className="chip" aria-pressed={!cat} onClick={() => setCat('')}>Todas</button>
        {cats.map((c) => <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="grid">
        {list.map((r) => {
          const Icon = KIND_ICON[r.kind];
          const available = r.kind === 'leccion' || !!(r.fileId || r.href);
          return (
            <article key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row-between" style={{ flexWrap: 'nowrap' }}>
                <span className="row small muted" style={{ gap: 6 }}><Icon size={16} aria-hidden="true" />{r.category} · {KIND_LABEL[r.kind]}</span>
                <FavoriteButton id={`resource:${r.id}`} label={r.title} />
              </div>
              <h3 style={{ margin: 0 }}>{r.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>{r.description}</p>
              <div className="badges">
                {r.kind === 'leccion' ? <ProposedBadge /> : available ? <Badge tone="ok">Disponible en este dispositivo</Badge> : <Badge tone="warn" icon={<Clock aria-hidden="true" />}>Pendiente</Badge>}
                {r.version && <Badge>Versión {r.version}</Badge>}
                <Badge>{r.updatedAt ? `Actualizado: ${formatCivil(r.updatedAt)}` : 'Sin fecha de actualización'}</Badge>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'auto' }} onClick={() => setQuery({ r: r.id })}>{available ? 'Ver material' : 'Ver estado'}</button>
            </article>
          );
        })}
      </div>
      <Modal open={!!open} onClose={() => setQuery({ r: null })} title={open?.title ?? 'Material'} wide>{open && <Viewer r={open} />}</Modal>
    </section>
  );
}
