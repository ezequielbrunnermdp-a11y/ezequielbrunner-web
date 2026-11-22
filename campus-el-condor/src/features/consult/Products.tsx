import { useEffect, useMemo, useState } from 'react';
import { ImageOff, Search, Settings } from 'lucide-react';
import { Badge, Callout, EmptyState, FavoriteButton, Modal, PracticeBadge } from '../../components/ui';
import { EmptyTag } from '../../components/Illustrations';
import { PRACTICE_PRODUCTS } from '../../content/library';
import type { Product } from '../../content/types';
import { useContent, useProgress } from '../../storage/store';
import { formatMoney } from '../../lib/format';
import { matchesAll } from '../../lib/text';
import { setQuery } from '../../app/router';
import { fileURL } from '../../storage/idb';

const AVAIL: Record<Product['availability'], string> = { 'sin-dato': 'Disponibilidad sin informar', disponible: 'Disponible', 'no-disponible': 'No disponible', temporada: 'De temporada' };
const DATA_STATUS = { desconocido: 'Desconocido', parcial: 'Parcial', verificado: 'Verificado' } as const;

export function ProductPhoto({ fileId, alt }: { fileId: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let a = true; if (fileId) fileURL(fileId).then((u) => a && setUrl(u)).catch(() => undefined); return () => { a = false; }; }, [fileId]);
  if (!fileId || !url) return null;
  return <img src={url} alt={alt} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />;
}

function listOrUnknown(list: string[] | null, status: Product['allergensStatus'], noun: string) {
  if (list === null || status === 'desconocido') return <span><Badge tone="warn">Desconocido</Badge> <span className="small muted">Sin información confirmada de {noun}. Consultá la ficha técnica y a quien prepara.</span></span>;
  if (!list.length) return <span><Badge tone={status === 'verificado' ? 'ok' : 'warn'}>{DATA_STATUS[status]}</Badge> <span className="small muted">{status === 'verificado' ? `Ficha verificada sin ${noun} declarados.` : `Lista vacía: no significa ausencia comprobada.`}</span></span>;
  return <span>{list.join(', ')} <Badge tone={status === 'verificado' ? 'ok' : 'warn'}>{DATA_STATUS[status]}</Badge></span>;
}

export function ProductDetail({ p }: { p: Product }) {
  return (
    <div>
      <ProductPhoto fileId={p.photoFileId} alt={p.name} />
      <div className="badges" style={{ marginBottom: 12 }}>
        {p.isExample && <PracticeBadge label="Práctica · no es oferta comercial" />}
        <Badge tone={p.verification === 'verificado' ? 'ok' : 'proposed'}>{p.verification === 'verificado' ? 'Ficha verificada' : 'Ficha sin verificar'}</Badge>
        <Badge>{AVAIL[p.availability]}</Badge>
      </div>
      <p>{p.description || <span className="muted">Sin descripción propia.</span>}</p>
      <dl className="kv">
        <dt>Categoría</dt><dd>{p.category || '—'}</dd>
        <dt>Código</dt><dd>{p.code ?? <span className="muted">Código sin asignar</span>}</dd>
        <dt>Precio</dt><dd>{formatMoney(p.price)}</dd>
        <dt>Variantes</dt><dd>{p.variants.length ? p.variants.join(', ') : <span className="muted">Sin variantes informadas</span>}</dd>
        <dt>Ingredientes</dt><dd>{listOrUnknown(p.ingredients, p.ingredientsStatus, 'ingredientes')}</dd>
        <dt>Alérgenos</dt><dd>{listOrUnknown(p.allergens, p.allergensStatus, 'alérgenos')}</dd>
        <dt>Fuente</dt><dd>{p.source || <span className="muted">Sin fuente</span>}</dd>
      </dl>
      <Callout tone="warning" title="Antes de responder sobre alergias">Ante una alergia o restricción, verificá la ficha técnica vigente y consultá al responsable de preparación. No garantices ausencia de alérgenos ni de contaminación cruzada por suposición.</Callout>
    </div>
  );
}

export function ProductsSection({ query }: { query: URLSearchParams }) {
  const content = useContent();
  const favs = useProgress().favorites;
  const official = content.products;
  const [text, setText] = useState('');
  const [cat, setCat] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const openId = query.get('p');
  const showPractice = !official.length;
  const list = showPractice ? PRACTICE_PRODUCTS : official;
  const categories = useMemo(() => [...new Set([...content.categories, ...list.map((p) => p.category)])].filter((c) => list.some((p) => p.category === c)), [content.categories, list]);
  const filtered = list.filter((p) => (!cat || p.category === cat) && (!text || matchesAll(`${p.name} ${p.description} ${p.code ?? ''} ${p.variants.join(' ')}`, text)) && (!onlyFav || favs.includes(`product:${p.id}`)));
  const open = [...official, ...PRACTICE_PRODUCTS].find((p) => p.id === openId);
  return (
    <section aria-label="Productos">
      {showPractice && (
        <EmptyState art={<EmptyTag />} title="Todavía no hay carta oficial cargada"
          actions={<a className="btn btn-secondary" href="#/gestionar?t=productos"><Settings aria-hidden="true" />Cargar productos en este dispositivo</a>}>
          Cuando El Cóndor entregue su carta y fichas técnicas, los productos van a aparecer acá con precio, código, variantes y alérgenos. Mientras tanto, practicá con nombres genéricos.
        </EmptyState>
      )}
      <div className="section-title" style={{ marginTop: 28 }}>
        <h2>{showPractice ? 'Catálogo de práctica' : 'Catálogo de este dispositivo'}</h2>
        {showPractice ? <PracticeBadge label="Práctica · precios y códigos sin informar" /> : <Badge>{official.length} productos</Badge>}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search-box" style={{ flex: '1 1 240px' }}>
          <Search aria-hidden="true" />
          <label htmlFor="prod-q" className="sr-only">Buscar productos</label>
          <input id="prod-q" className="input" type="search" placeholder="Buscar por nombre, código o variante" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 46 }} />
        </div>
        <label htmlFor="prod-cat" className="sr-only">Categoría</label>
        <select id="prod-cat" className="input" style={{ width: 'auto', minWidth: 170 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="button" className="chip" aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>Solo favoritos</button>
      </div>
      {filtered.length === 0 ? <p className="muted">No hay productos que coincidan con los filtros.</p> : (
        <div className="grid">
          {filtered.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row-between" style={{ flexWrap: 'nowrap' }}>
                <span className="small muted">{p.category}</span>
                <FavoriteButton id={`product:${p.id}`} label={p.name} />
              </div>
              {!p.photoFileId && <div aria-hidden="true" style={{ display: 'grid', placeItems: 'center', aspectRatio: '5 / 2', background: 'var(--sand)', borderRadius: 12, color: 'var(--muted)' }}><ImageOff /></div>}
              <ProductPhoto fileId={p.photoFileId} alt={p.name} />
              <h3 style={{ margin: 0 }}>{p.name}</h3>
              <div className="badges">
                {p.isExample && <PracticeBadge />}
                <Badge>{formatMoney(p.price)}</Badge>
                <Badge tone="warn">Alérgenos: {p.allergens === null ? 'desconocido' : DATA_STATUS[p.allergensStatus].toLowerCase()}</Badge>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'auto' }} onClick={() => setQuery({ p: p.id })}>Ver ficha</button>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!open} onClose={() => setQuery({ p: null })} title={open?.name ?? 'Producto'}>
        {open && <ProductDetail p={open} />}
      </Modal>
    </section>
  );
}
