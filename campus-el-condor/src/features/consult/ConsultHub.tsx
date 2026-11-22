import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Hash, Library, MessageSquare, Percent, Search, ShoppingBag, Star } from 'lucide-react';
import { EmptyState, FavoriteButton, PageHeader } from '../../components/ui';
import { EmptyCup } from '../../components/Illustrations';
import { useContent, useProgress } from '../../storage/store';
import { buildIndex, search, type SearchCategory } from './searchIndex';
import { setQuery } from '../../app/router';
import { ProductsSection } from './Products';
import { CodesSection } from './Codes';
import { PromotionsSection } from './Promotions';
import { LibrarySection } from './Library';
import { MODULE_BY_ID } from '../../content/modules';
import { FAQ } from '../../content/library';

const SECTIONS = [
  { id: '', label: 'Buscar', Icon: Search },
  { id: 'atencion', label: 'Atención', Icon: MessageSquare },
  { id: 'productos', label: 'Productos', Icon: ShoppingBag },
  { id: 'codigos', label: 'Códigos', Icon: Hash },
  { id: 'promociones', label: 'Promociones', Icon: Percent },
  { id: 'biblioteca', label: 'Biblioteca', Icon: Library },
  { id: 'favoritos', label: 'Favoritos', Icon: Star },
];

export function ConsultHub({ section, query }: { section: string; query: URLSearchParams }) {
  return (
    <>
      <PageHeader eyebrow="Consultar" title="Encontrá lo que necesitás" lead="Buscá en lecciones, casos, productos, códigos, promociones y biblioteca. La búsqueda no distingue tildes ni mayúsculas." />
      <nav className="tabs" aria-label="Secciones de consulta">
        {SECTIONS.map(({ id, label, Icon }) => (
          <a key={id} href={`#/consultar${id ? `/${id}` : ''}`} aria-current={section === id ? 'page' : undefined}><Icon aria-hidden="true" />{label}</a>
        ))}
      </nav>
      {section === '' && <SearchSection q={query.get('q') ?? ''} cat={query.get('c') ?? ''} />}
      {section === 'atencion' && <AttentionSection />}
      {section === 'productos' && <ProductsSection query={query} />}
      {section === 'codigos' && <CodesSection query={query} />}
      {section === 'promociones' && <PromotionsSection query={query} />}
      {section === 'biblioteca' && <LibrarySection query={query} />}
      {section === 'favoritos' && <FavoritesSection />}
    </>
  );
}

const CATS: SearchCategory[] = ['Lecciones', 'Preguntas frecuentes', 'Casos', 'Evaluación', 'Productos', 'Códigos', 'Promociones', 'Biblioteca', 'Videos'];

function SearchSection({ q, cat }: { q: string; cat: string }) {
  const content = useContent();
  const index = useMemo(() => buildIndex(content), [content]);
  const [text, setText] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { if (text !== q) setQuery({ q: text }); }, 250); return () => clearTimeout(t); }, [text, q]);
  const hits = useMemo(() => search(index, q), [index, q]);
  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c, hits.filter((h) => h.doc.category === c).length])), [hits]);
  const shown = cat ? hits.filter((h) => h.doc.category === cat) : hits;
  return (
    <section aria-label="Buscador">
      <form role="search" onSubmit={(e) => { e.preventDefault(); setQuery({ q: text }); }}>
        <label htmlFor="global-search" className="sr-only">Buscar en el campus</label>
        <div className="search-box">
          <Search aria-hidden="true" />
          <input ref={inputRef} id="global-search" className="input" type="search" placeholder="Por ejemplo: demora, alérgenos, reintegro, comanda" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        </div>
      </form>
      {q && (
        <div className="chips" style={{ margin: '16px 0' }} role="group" aria-label="Filtrar por categoría">
          <button type="button" className="chip" aria-pressed={!cat} onClick={() => setQuery({ c: null })}>Todo ({hits.length})</button>
          {CATS.filter((c) => counts[c]).map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setQuery({ c })}>{c} ({counts[c]})</button>
          ))}
        </div>
      )}
      <p className="sr-only" role="status">{q ? `${shown.length} resultados para ${q}` : ''}</p>
      {!q ? (
        <div style={{ marginTop: 24 }}>
          <div className="section-title"><h2>Consultas frecuentes</h2></div>
          <div className="grid-2">
            {FAQ.slice(0, 6).map((f) => (
              <a key={f.id} className="result" href={f.link}><span className="result-cat">Ayuda rápida</span><h3>{f.q}</h3><p>{f.a}</p></a>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>La búsqueda recorre el texto de este campus y los datos cargados en este dispositivo. No busca dentro de PDF ni imágenes, salvo que se haya cargado su texto en “Gestionar contenido”.</p>
        </div>
      ) : shown.length === 0 ? (
        <EmptyState art={<EmptyCup />} title="Sin resultados" actions={<button type="button" className="btn btn-secondary" onClick={() => { setText(''); setQuery({ q: null, c: null }); inputRef.current?.focus(); }}>Limpiar búsqueda</button>}>
          No encontramos “{q}”. Probá con otra palabra o consultá a tu referente: si el tema falta en el campus, puede incorporarse.
        </EmptyState>
      ) : (
        <ul className="list-plain" aria-label="Resultados">
          {shown.map(({ doc, snip }) => (
            <li key={doc.category + doc.id} className="result-row">
              <a className="result" href={doc.href}>
                <span className="result-cat">{doc.category}<span>{doc.context}</span></span>
                <h3>{doc.title}</h3>
                {snip && <p>{snip.before}<mark>{snip.match}</mark>{snip.after}</p>}
              </a>
              {doc.favId && <FavoriteButton id={doc.favId} label={doc.title} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionSection() {
  const m2 = MODULE_BY_ID.m2;
  const moments = m2.lessons[0].blocks.find((b) => b.type === 'moments');
  const phrases = m2.lessons[1].blocks.find((b) => b.type === 'phrases');
  return (
    <div className="stack-lg">
      <section>
        <div className="section-title"><h2>Cinco momentos de la atención</h2><a href="#/aprender/m2">Ver lección completa</a></div>
        <ol className="stations">
          {moments?.type === 'moments' && moments.items.map((m) => <li key={m.title}><strong>{m.title}</strong><span>{m.useful}</span></li>)}
        </ol>
      </section>
      <section>
        <div className="section-title"><h2>Frases que ayudan</h2><span className="badge badge-practice">Práctica</span></div>
        <ul className="phrases">{phrases?.type === 'phrases' && phrases.items.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <section>
        <h2>Preguntas frecuentes</h2>
        <div className="grid-2">
          {FAQ.map((f) => <a key={f.id} className="result" href={f.link}><h3>{f.q}</h3><p>{f.a}</p></a>)}
        </div>
      </section>
    </div>
  );
}

function FavoritesSection() {
  const content = useContent();
  const favs = useProgress().favorites;
  const index = useMemo(() => buildIndex(content), [content]);
  const items = favs.map((f) => index.find((d) => d.favId === f)).filter(Boolean) as ReturnType<typeof buildIndex>;
  if (!items.length) {
    return (
      <EmptyState art={<EmptyCup />} title="Todavía no guardaste favoritos" actions={<a className="btn btn-secondary" href="#/aprender">Ir a las lecciones</a>}>
        Tocá la estrella <BookMarked size={14} aria-hidden="true" /> en una lección, un producto, un código o un material para encontrarlo rápido acá.
      </EmptyState>
    );
  }
  return (
    <ul className="list-plain">
      {items.map((d) => (
        <li key={d.favId} className="result-row">
          <a className="result" href={d.href}><span className="result-cat">{d.category}<span>{d.context}</span></span><h3>{d.title}</h3></a>
          <FavoriteButton id={d.favId!} label={d.title} />
        </li>
      ))}
    </ul>
  );
}
