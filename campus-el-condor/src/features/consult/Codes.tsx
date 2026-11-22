import { useMemo, useState } from 'react';
import { BadgeCheck, FileUp, Search, X } from 'lucide-react';
import { Badge, Callout, EmptyState, FavoriteButton, Modal, toast } from '../../components/ui';
import { EmptyTag } from '../../components/Illustrations';
import { store, useContent, useProgress } from '../../storage/store';
import { matchesAll } from '../../lib/text';
import { mergeCodes, previewCodes, type CodesPreview } from '../../lib/codesImport';
import { CodePractice } from './CodePractice';
import { formatCivil, formatTimestamp } from '../../lib/format';
import { OFFICIAL_BRANCH, OFFICIAL_DATE } from '../../data/officialCodes';

/** Importador con validación, vista previa y errores por fila. Cancelar no modifica el catálogo. */
export function CodeImporter({ onDone }: { onDone?: () => void }) {
  const { codes } = useContent();
  const [preview, setPreview] = useState<CodesPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [source, setSource] = useState('');
  const [readError, setReadError] = useState<string | null>(null);

  const onFile = async (f: File | undefined) => {
    setReadError(null);
    if (!f) return;
    const isJson = f.name.toLowerCase().endsWith('.json') || f.type.includes('json');
    const isCsv = f.name.toLowerCase().endsWith('.csv') || f.type.includes('csv') || f.type === 'text/plain';
    if (!isJson && !isCsv) { setReadError('Elegí un archivo .csv o .json.'); return; }
    setFileName(f.name);
    setPreview(previewCodes(await f.text(), isJson ? 'json' : 'csv', codes));
  };
  const cancel = () => { setPreview(null); setFileName(''); toast('Importación cancelada: el catálogo no cambió'); };
  const confirm = () => {
    if (!preview) return;
    store.updateContent((c) => ({ ...c, codes: mergeCodes(c.codes, preview.valid, mode), codesInfo: { source: source.trim() || fileName, importedAt: new Date().toISOString() } }));
    toast(`${preview.valid.length} códigos importados en este dispositivo`);
    setPreview(null); setFileName('');
    onDone?.();
  };
  return (
    <div className="stack">
      <p className="small">Columnas obligatorias: <strong>codigo</strong> y <strong>nombre</strong>. Opcionales: categoria, variante, observaciones. Separador coma o punto y coma. Los códigos se guardan como texto, conservando ceros iniciales.</p>
      <label className="field">
        <span className="label">Archivo CSV o JSON</span>
        <input type="file" className="input" accept=".csv,.json,text/csv,application/json" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {readError && <Callout tone="err">{readError}</Callout>}
      {preview && (
        <div className="card-flat fade-in">
          <div className="row-between">
            <h4 style={{ margin: 0 }}>Vista previa · {fileName}</h4>
            <div className="badges">
              <Badge tone="ok">{preview.valid.length} válidos</Badge>
              {preview.errors.length > 0 && <Badge tone="err">{preview.errors.length} con errores</Badge>}
              {preview.warnings.length > 0 && <Badge tone="warn">{preview.warnings.length} avisos</Badge>}
            </div>
          </div>
          {preview.errors.length > 0 && (
            <details open style={{ marginTop: 12 }}>
              <summary><strong>Errores por fila (no se importan)</strong></summary>
              <ul className="small">{preview.errors.slice(0, 50).map((e, i) => <li key={i}>{e.row ? `Fila ${e.row}: ` : ''}{e.message}</li>)}</ul>
              {preview.errors.length > 50 && <p className="small muted">Y {preview.errors.length - 50} errores más.</p>}
            </details>
          )}
          {preview.warnings.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary>Avisos</summary>
              <ul className="small">{preview.warnings.slice(0, 50).map((e, i) => <li key={i}>{e.row ? `Fila ${e.row}: ` : ''}{e.message}</li>)}</ul>
            </details>
          )}
          {preview.valid.length > 0 && (
            <>
              <div className="table-wrap" style={{ margin: '12px 0', maxHeight: 260, overflowY: 'auto' }}>
                <table><thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Variante</th></tr></thead>
                  <tbody>{preview.valid.slice(0, 30).map((c) => <tr key={c.code}><td className="code">{c.code}</td><td>{c.name}</td><td>{c.category}</td><td>{c.variant}</td></tr>)}</tbody></table>
              </div>
              {preview.valid.length > 30 && <p className="small muted">Se muestran 30 de {preview.valid.length}.</p>}
              <div className="form-grid">
                <label className="field"><span className="label">Fuente del listado</span><input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Por ejemplo: exportación del sistema, fecha" /></label>
                <label className="field"><span className="label">Cómo importar</span>
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
                    <option value="merge">Agregar y actualizar los existentes</option>
                    <option value="replace">Reemplazar todo el listado actual ({codes.length})</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" disabled={!preview.valid.length} onClick={confirm}>Importar {preview.valid.length} códigos</button>
            <button type="button" className="btn btn-secondary" onClick={cancel}><X aria-hidden="true" />Cancelar sin cambios</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CodesSection({ query }: { query: URLSearchParams }) {
  const { codes, codesInfo } = useContent();
  const favs = useProgress().favorites;
  const [text, setText] = useState(query.get('q') ?? '');
  const [cat, setCat] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const cats = useMemo(() => [...new Set(codes.map((c) => c.category).filter(Boolean))].sort(), [codes]);
  const hasVariants = useMemo(() => codes.some((c) => c.variant), [codes]);
  const filtered = codes.filter((c) => (!cat || c.category === cat) && (!onlyFav || favs.includes(`code:${c.code}`)) && (!text || c.code.toLowerCase().startsWith(text.toLowerCase().trim()) || matchesAll(`${c.name} ${c.variant} ${c.notes} ${c.code}`, text)));
  if (text.trim()) {
    const t = text.trim().toLowerCase();
    filtered.sort((x, y) => Number(!(x.code.toLowerCase().startsWith(t) || x.name.toLowerCase().startsWith(t))) - Number(!(y.code.toLowerCase().startsWith(t) || y.name.toLowerCase().startsWith(t))));
  }
  return (
    <section aria-label="Códigos">
      <Callout tone="info" title="Los códigos no son universales">Un código identifica un producto en un sistema determinado. Antes de usarlo, verificá que pertenezca al catálogo vigente de El Cóndor.</Callout>
      {codes.length === 0 ? (
        <EmptyState art={<EmptyTag />} title="Tabla oficial de códigos vacía" actions={<button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}><FileUp aria-hidden="true" />Importar CSV o JSON</button>}>
          No se cargó ningún código de El Cóndor. El campus no genera números ficticios: importá el listado oficial para consultarlo y activar la práctica de asociación. Mientras tanto, practicá cantidades y variantes en el módulo 5.
        </EmptyState>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div className="stack" style={{ gap: 6 }}>
              <div className="badges">
                {codesInfo.importedAt ? <Badge tone="warn">Listado importado en este dispositivo</Badge> : <Badge tone="ok" icon={<BadgeCheck aria-hidden="true" />}>Listado oficial · {OFFICIAL_BRANCH}</Badge>}
                <Badge>{codes.length.toLocaleString('es-AR')} códigos activos</Badge>
              </div>
              <p className="small muted" style={{ margin: 0 }}>{codesInfo.importedAt ? `Fuente: ${codesInfo.source || 'sin indicar'} · Importado: ${formatTimestamp(codesInfo.importedAt)}` : `Exportación del sistema de gestión recibida el ${formatCivil(OFFICIAL_DATE)}. Los códigos corresponden a esta sucursal: verificá con tu referente si trabajás en otra.`}</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(true)}><FileUp aria-hidden="true" />Importar</button>
          </div>
          <div className="toolbar">
            <div className="search-box">
              <Search aria-hidden="true" />
              <label htmlFor="code-q" className="sr-only">Buscar por código o nombre</label>
              <input id="code-q" className="input" type="search" inputMode="search" placeholder="Código o nombre" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            {cats.length > 0 && (
              <select className="input" aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas las categorías</option>{cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            <button type="button" className="chip" aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>Solo favoritos</button>
          </div>
          <div className="table-wrap">
            <table className="codes-table">
              <caption className="sr-only">Códigos de caja</caption>
              <thead><tr><th>Código</th><th>Producto</th><th>Rubro</th>{hasVariants && <th>Variante</th>}<th><span className="sr-only">Favorito</span></th></tr></thead>
              <tbody>
                {filtered.slice(0, 300).map((c) => (
                  <tr key={c.code}>
                    <td className="code">{c.code}</td>
                    <td className="cname">{c.name}{c.notes && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>{c.notes === 'Producto compuesto' ? 'Compuesto' : c.notes}</span>}</td>
                    <td className="ccat">{c.category || '—'}</td>
                    {hasVariants && <td>{c.variant || '—'}</td>}
                    <td className="cfav"><FavoriteButton id={`code:${c.code}`} label={`código ${c.code}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Ningún código coincide con la búsqueda.</p>}
          {filtered.length > 300 && <p className="small muted" style={{ marginTop: 10 }}>Se muestran 300 de {filtered.length.toLocaleString('es-AR')}. Buscá por nombre o código, o elegí un rubro.</p>}
          {codes.length >= 4 && <div className="card" style={{ marginTop: 24 }}><CodePractice /></div>}
        </>
      )}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar códigos" wide>
        <Callout tone="pending">La importación se guarda solo en este navegador. No publica el listado para otras personas.</Callout>
        <CodeImporter onDone={() => setImportOpen(false)} />
      </Modal>
    </section>
  );
}
