import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Pencil, Plus, Trash2, Upload, Paperclip } from 'lucide-react';
import { Badge, Callout, ConfirmModal, Field, Modal, PageHeader, toast } from '../../components/ui';
import { store, useContent } from '../../storage/store';
import { MODULES } from '../../content/modules';
import { BASE_RESOURCES, VIDEO_SCRIPTS } from '../../content/library';
import type { ApprovalStatus, ContentMeta, Product, Promotion, PublicationStatus, Resource } from '../../content/types';
import { APPROVAL_LABEL, PUBLICATION_LABEL } from '../../content/meta';
import { CodeImporter } from '../consult/Codes';
import { buildContentBackup, downloadJSON, readJSONFile, validateContentBackup, type ContentBackup } from '../../storage/backup';
import { deleteFile, formatBytes, idbAvailable, listFiles, putFile, storageEstimate, type FileInfo } from '../../storage/idb';
import { formatCivil, formatMoney, formatTimestamp, isCivilDate, parseAmount, WEEKDAYS } from '../../lib/format';
import { uid } from '../../lib/text';
import { setQuery } from '../../app/router';
import { missingPromoFields, promoState, PROMO_STATE_LABEL } from '../../lib/promo';

const TABS = [
  ['textos', 'Textos'], ['metadatos', 'Metadatos y aprobación'], ['productos', 'Productos'], ['codigos', 'Códigos'],
  ['promociones', 'Promociones'], ['archivos', 'Archivos'], ['ajustes', 'Metas y umbral'], ['respaldo', 'Importar y exportar'],
] as const;

export function ManagePage({ tab }: { tab: string }) {
  const t = TABS.some(([id]) => id === tab) ? tab : 'textos';
  return (
    <>
      <PageHeader eyebrow="Gestionar contenido en este dispositivo" title="Ajustes locales del campus" lead="Cargá productos, códigos, promociones, textos y archivos para probarlos o usarlos en este navegador." />
      <Callout tone="warning" title="Los cambios no se publican para el equipo">
        Todo lo que se modifica acá queda guardado solo en este navegador. Otras personas no lo ven hasta que se incorpore a una nueva publicación del sitio. Esta sección no tiene PIN ni restricción de acceso: no es un sistema de permisos.
      </Callout>
      <nav className="tabs" aria-label="Secciones de gestión">
        {TABS.map(([id, label]) => <a key={id} href={`#/gestionar?t=${id}`} aria-current={t === id ? 'page' : undefined}>{label}</a>)}
      </nav>
      {t === 'textos' && <TextsTab />}
      {t === 'metadatos' && <MetaTab />}
      {t === 'productos' && <ProductsTab />}
      {t === 'codigos' && <CodesTab />}
      {t === 'promociones' && <PromotionsTab />}
      {t === 'archivos' && <FilesTab />}
      {t === 'ajustes' && <SettingsTab />}
      {t === 'respaldo' && <BackupTab />}
    </>
  );
}

function TextsTab() {
  const c = useContent();
  const [homeTitle, setHomeTitle] = useState(c.texts.homeTitle ?? '');
  const [homeText, setHomeText] = useState(c.texts.homeText ?? '');
  const [mod, setMod] = useState('m1');
  const cur = c.texts.modules[mod] ?? {};
  const base = MODULES.find((m) => m.id === mod)!;
  const [objective, setObjective] = useState(cur.objective ?? '');
  const [intro, setIntro] = useState(cur.intro ?? '');
  const [closing, setClosing] = useState(cur.closing ?? '');
  useEffect(() => { const x = c.texts.modules[mod] ?? {}; setObjective(x.objective ?? ''); setIntro(x.intro ?? ''); setClosing(x.closing ?? ''); }, [mod]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack-lg">
      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Inicio</h2>
        <p className="small muted">Dejá un campo vacío para usar el texto original.</p>
        <div className="stack">
          <Field label="Título principal" htmlFor="t-ht"><input id="t-ht" className="input" value={homeTitle} placeholder="Cada buen servicio empieza por un equipo preparado." onChange={(e) => setHomeTitle(e.target.value)} /></Field>
          <Field label="Texto de presentación" htmlFor="t-hx"><textarea id="t-hx" className="input" value={homeText} placeholder="Aprendé, practicá y encontrá lo que necesitás…" onChange={(e) => setHomeText(e.target.value)} /></Field>
          <div><button type="button" className="btn btn-primary" onClick={() => { store.updateContent((x) => ({ ...x, texts: { ...x.texts, homeTitle: homeTitle.trim() || null, homeText: homeText.trim() || null } })); toast('Textos de inicio guardados'); }}>Guardar</button></div>
        </div>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Módulos</h2>
        <div className="stack">
          <Field label="Módulo" htmlFor="t-mod"><select id="t-mod" className="input" value={mod} onChange={(e) => setMod(e.target.value)}>{MODULES.map((m) => <option key={m.id} value={m.id}>{m.number}. {m.title}</option>)}</select></Field>
          <Field label="Objetivo" htmlFor="t-obj"><textarea id="t-obj" className="input" value={objective} placeholder={base.objective} onChange={(e) => setObjective(e.target.value)} /></Field>
          <Field label="Introducción" htmlFor="t-int"><textarea id="t-int" className="input" style={{ minHeight: 140 }} value={intro} placeholder={base.intro} onChange={(e) => setIntro(e.target.value)} /></Field>
          <Field label="Frase de cierre" htmlFor="t-clo"><input id="t-clo" className="input" value={closing} placeholder={base.closing} onChange={(e) => setClosing(e.target.value)} /></Field>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => { store.updateContent((x) => ({ ...x, texts: { ...x.texts, modules: { ...x.texts.modules, [mod]: { objective, intro, closing } } } })); toast('Textos del módulo guardados'); }}>Guardar</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setObjective(''); setIntro(''); setClosing(''); store.updateContent((x) => { const m = { ...x.texts.modules }; delete m[mod]; return { ...x, texts: { ...x.texts, modules: m } }; }); toast('Se restauró el texto original'); }}>Restaurar original</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetaTab() {
  const c = useContent();
  return (
    <div className="stack">
      <Callout tone="info" title="Dos estados distintos">El estado de publicación indica si el contenido se muestra en el campus. El estado de aprobación indica si El Cóndor lo validó. Cargá “Aprobado” solo si existe una aprobación real, con fecha y responsable.</Callout>
      {MODULES.map((m) => <MetaEditor key={m.id} id={m.id} title={`${m.number}. ${m.title}`} meta={{ ...m.meta, ...(c.meta[m.id] ?? {}) }} />)}
    </div>
  );
}

function MetaEditor({ id, title, meta }: { id: string; title: string; meta: ContentMeta }) {
  const [f, setF] = useState(meta);
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    if (f.approvalStatus === 'aprobado' && (!f.approvedBy?.trim() || !f.approvedAt || !isCivilDate(f.approvedAt))) { setErr('Para marcar “Aprobado” indicá quién aprobó y una fecha válida.'); return; }
    setErr(null);
    const clean = f.approvalStatus === 'aprobado' ? f : { ...f, approvedAt: null, approvedBy: null };
    store.updateContent((x) => ({ ...x, meta: { ...x.meta, [id]: clean } }));
    toast('Metadatos guardados');
  };
  return (
    <details className="card-flat">
      <summary><strong>{title}</strong> <Badge>{PUBLICATION_LABEL[meta.publicationStatus]}</Badge> <Badge tone={meta.approvalStatus === 'aprobado' ? 'ok' : 'proposed'}>{meta.approvalStatus === 'aprobado' ? 'Aprobado' : meta.approvalStatus === 'en-revision' ? 'En revisión' : 'Propuesto'}</Badge></summary>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <Field label="Publicación en el campus" htmlFor={`${id}-pub`}>
          <select id={`${id}-pub`} className="input" value={f.publicationStatus} onChange={(e) => setF({ ...f, publicationStatus: e.target.value as PublicationStatus })}>
            {Object.entries(PUBLICATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Aprobación empresarial" htmlFor={`${id}-apr`}>
          <select id={`${id}-apr`} className="input" value={f.approvalStatus} onChange={(e) => setF({ ...f, approvalStatus: e.target.value as ApprovalStatus })}>
            {Object.entries(APPROVAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Aprobado por" htmlFor={`${id}-by`}><input id={`${id}-by`} className="input" disabled={f.approvalStatus !== 'aprobado'} value={f.approvedBy ?? ''} onChange={(e) => setF({ ...f, approvedBy: e.target.value })} /></Field>
        <Field label="Fecha de aprobación" htmlFor={`${id}-at`}><input id={`${id}-at`} type="date" className="input" disabled={f.approvalStatus !== 'aprobado'} value={f.approvedAt ?? ''} onChange={(e) => setF({ ...f, approvedAt: e.target.value || null })} /></Field>
        <Field label="Versión" htmlFor={`${id}-ver`}><input id={`${id}-ver`} className="input" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
        <Field label="Fecha de actualización" htmlFor={`${id}-upd`}><input id={`${id}-upd`} type="date" className="input" value={f.updatedAt} onChange={(e) => setF({ ...f, updatedAt: e.target.value })} /></Field>
        <Field label="Referencia de la fuente" htmlFor={`${id}-src`} full><input id={`${id}-src`} className="input" value={f.sourceReference} onChange={(e) => setF({ ...f, sourceReference: e.target.value })} /></Field>
        <div className="full">{err && <p className="small" style={{ color: 'var(--err)' }} role="alert">{err}</p>}<button type="button" className="btn btn-primary btn-sm" onClick={save}>Guardar</button></div>
      </div>
    </details>
  );
}

const emptyProduct = (): Product => ({ id: uid('prod'), code: null, category: '', name: '', description: '', price: null, currency: 'ARS', variants: [], ingredients: null, ingredientsStatus: 'desconocido', allergens: null, allergensStatus: 'desconocido', availability: 'sin-dato', photoFileId: null, source: '', verification: 'sin-verificar', isExample: false });

function ProductForm({ initial, onClose }: { initial: Product; onClose: () => void }) {
  const c = useContent();
  const [p, setP] = useState(initial);
  const [price, setPrice] = useState(initial.price === null ? '' : String(initial.price).replace('.', ','));
  const [variants, setVariants] = useState(initial.variants.join(', '));
  const [ingredients, setIngredients] = useState(initial.ingredients?.join(', ') ?? '');
  const [allergens, setAllergens] = useState(initial.allergens?.join(', ') ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const save = async (photo?: File) => {
    const e: Record<string, string> = {};
    if (!p.name.trim()) e.name = 'El nombre es obligatorio.';
    if (!p.category.trim()) e.category = 'Elegí o escribí una categoría.';
    const pr = price.trim() === '' ? null : parseAmount(price);
    if (price.trim() !== '' && pr === null) e.price = 'Ingresá un precio válido o dejalo vacío.';
    if (p.code !== null && /\s/.test(p.code)) e.code = 'El código no puede tener espacios.';
    setErrors(e);
    if (Object.keys(e).length) return;
    let photoFileId = p.photoFileId;
    if (photo) photoFileId = (await putFile(photo)).id;
    const next: Product = {
      ...p, name: p.name.trim(), category: p.category.trim(), price: pr, photoFileId,
      code: p.code?.trim() ? p.code.trim() : null,
      variants: split(variants),
      ingredients: p.ingredientsStatus === 'desconocido' ? null : split(ingredients),
      allergens: p.allergensStatus === 'desconocido' ? null : split(allergens),
    };
    store.updateContent((x) => ({
      ...x,
      categories: x.categories.includes(next.category) ? x.categories : [...x.categories, next.category],
      products: x.products.some((q) => q.id === next.id) ? x.products.map((q) => (q.id === next.id ? next : q)) : [...x.products, next],
    }));
    toast('Producto guardado en este dispositivo');
    onClose();
  };
  const photoRef = useRef<HTMLInputElement>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(photoRef.current?.files?.[0]); }}>
      <div className="form-grid">
        <Field label="Nombre" htmlFor="pf-name" error={errors.name}><input id="pf-name" className="input" value={p.name} aria-invalid={!!errors.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Categoría" htmlFor="pf-cat" error={errors.category}>
          <input id="pf-cat" className="input" list="pf-cats" value={p.category} aria-invalid={!!errors.category} onChange={(e) => setP({ ...p, category: e.target.value })} />
          <datalist id="pf-cats">{c.categories.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label="Código propio (opcional)" htmlFor="pf-code" hint="Se guarda como texto: conserva ceros iniciales." error={errors.code}><input id="pf-code" className="input" value={p.code ?? ''} onChange={(e) => setP({ ...p, code: e.target.value })} /></Field>
        <Field label="Precio en ARS (opcional)" htmlFor="pf-price" hint="Vacío = precio sin informar (no es $ 0)." error={errors.price}><input id="pf-price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Descripción propia" htmlFor="pf-desc" full><textarea id="pf-desc" className="input" value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></Field>
        <Field label="Variantes autorizadas" htmlFor="pf-var" hint="Separadas por coma." full><input id="pf-var" className="input" value={variants} onChange={(e) => setVariants(e.target.value)} /></Field>
        <Field label="Estado de ingredientes" htmlFor="pf-is">
          <select id="pf-is" className="input" value={p.ingredientsStatus} onChange={(e) => setP({ ...p, ingredientsStatus: e.target.value as Product['ingredientsStatus'] })}><option value="desconocido">Desconocido</option><option value="parcial">Parcial</option><option value="verificado">Verificado con ficha técnica</option></select>
        </Field>
        <Field label="Ingredientes" htmlFor="pf-ing" hint="Separados por coma."><input id="pf-ing" className="input" disabled={p.ingredientsStatus === 'desconocido'} value={ingredients} onChange={(e) => setIngredients(e.target.value)} /></Field>
        <Field label="Estado de alérgenos" htmlFor="pf-as">
          <select id="pf-as" className="input" value={p.allergensStatus} onChange={(e) => setP({ ...p, allergensStatus: e.target.value as Product['allergensStatus'] })}><option value="desconocido">Desconocido</option><option value="parcial">Parcial</option><option value="verificado">Verificado con ficha técnica</option></select>
        </Field>
        <Field label="Alérgenos" htmlFor="pf-al" hint="Una lista vacía no indica ausencia salvo que esté verificada."><input id="pf-al" className="input" disabled={p.allergensStatus === 'desconocido'} value={allergens} onChange={(e) => setAllergens(e.target.value)} /></Field>
        <Field label="Disponibilidad" htmlFor="pf-av">
          <select id="pf-av" className="input" value={p.availability} onChange={(e) => setP({ ...p, availability: e.target.value as Product['availability'] })}><option value="sin-dato">Sin informar</option><option value="disponible">Disponible</option><option value="no-disponible">No disponible</option><option value="temporada">De temporada</option></select>
        </Field>
        <Field label="Verificación de la ficha" htmlFor="pf-ver">
          <select id="pf-ver" className="input" value={p.verification} onChange={(e) => setP({ ...p, verification: e.target.value as Product['verification'] })}><option value="sin-verificar">Sin verificar</option><option value="verificado">Verificada</option></select>
        </Field>
        <Field label="Fuente" htmlFor="pf-src" hint="Por ejemplo: carta vigente, ficha técnica, fecha." full><input id="pf-src" className="input" value={p.source} onChange={(e) => setP({ ...p, source: e.target.value })} /></Field>
        <Field label="Foto propia (opcional)" htmlFor="pf-photo" hint="Usá solo fotos reales de El Cóndor." full><input ref={photoRef} id="pf-photo" type="file" accept="image/*" className="input" /></Field>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button type="submit" className="btn btn-primary">Guardar producto</button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
    </form>
  );
}

function ProductsTab() {
  const c = useContent();
  const [editing, setEditing] = useState<Product | null>(null);
  const [del, setDel] = useState<Product | null>(null);
  return (
    <section>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>{c.products.length ? `${c.products.length} productos cargados en este dispositivo.` : 'No hay productos cargados. Mientras tanto, el catálogo muestra la vista de práctica.'}</p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(emptyProduct())}><Plus aria-hidden="true" />Agregar producto</button>
      </div>
      {c.products.length > 0 && (
        <div className="table-wrap">
          <table className="responsive">
            <thead><tr><th>Producto</th><th>Categoría</th><th>Código</th><th>Precio</th><th>Alérgenos</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {c.products.map((p) => (
                <tr key={p.id}>
                  <td data-label="Producto"><strong>{p.name}</strong></td>
                  <td data-label="Categoría">{p.category}</td>
                  <td data-label="Código" className="code">{p.code ?? '—'}</td>
                  <td data-label="Precio">{formatMoney(p.price)}</td>
                  <td data-label="Alérgenos">{p.allergensStatus}</td>
                  <td data-label="Acciones"><div className="row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}><Pencil aria-hidden="true" />Editar</button><button type="button" className="btn btn-danger btn-sm" onClick={() => setDel(p)}><Trash2 aria-hidden="true" />Eliminar</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && c.products.some((p) => p.id === editing.id) ? 'Editar producto' : 'Nuevo producto'} wide>
        {editing && <ProductForm key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Eliminar producto" confirmLabel="Eliminar" danger onConfirm={() => { if (del) { store.updateContent((x) => ({ ...x, products: x.products.filter((p) => p.id !== del.id) })); if (del.photoFileId) deleteFile(del.photoFileId).catch(() => undefined); toast('Producto eliminado'); } }}>
        <p>Se eliminará “{del?.name}” de este dispositivo.</p>
      </ConfirmModal>
    </section>
  );
}

function CodesTab() {
  const c = useContent();
  const [clear, setClear] = useState(false);
  return (
    <section className="stack-lg">
      <div className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Importar códigos</h2>
        <CodeImporter />
      </div>
      <div className="card row-between">
        <div><strong>{c.codes.length.toLocaleString('es-AR')} códigos {c.codesInfo.importedAt ? 'importados en este dispositivo' : 'del listado oficial'}</strong><p className="small muted" style={{ margin: 0 }}>{c.codesInfo.source || 'Fuente sin indicar'}{c.codesInfo.importedAt ? ` · ${formatTimestamp(c.codesInfo.importedAt)}` : ''}</p></div>
        <div className="row">
          <a className="btn btn-secondary btn-sm" href="#/consultar/codigos">Consultar tabla</a>
          <button type="button" className="btn btn-danger btn-sm" disabled={!c.codesInfo.importedAt} onClick={() => setClear(true)}><Trash2 aria-hidden="true" />Volver al listado oficial</button>
        </div>
      </div>
      <ConfirmModal open={clear} onClose={() => setClear(false)} title="Volver al listado oficial" confirmLabel="Descartar importación" danger onConfirm={() => { store.updateContent((x) => ({ ...x, codes: [], codesInfo: { source: '', importedAt: null } })); toast('Se restauró el listado oficial'); }}>
        <p>Se descartarán los {c.codes.length.toLocaleString('es-AR')} códigos importados en este dispositivo y se volverá a usar el listado oficial incluido en el campus.</p>
      </ConfirmModal>
    </section>
  );
}

const emptyPromo = (): Promotion => ({ id: uid('promo'), entity: '', title: '', startDate: null, endDate: null, days: [], timeFrom: null, timeTo: null, benefitType: null, percent: null, paymentMethod: '', cards: '', channel: '', cap: null, capPeriod: '', conditions: '', exclusions: '', branches: '', source: '', verifiedAt: null, isExample: false });

function PromoForm({ initial, onClose }: { initial: Promotion; onClose: () => void }) {
  const [p, setP] = useState(initial);
  const [percent, setPercent] = useState(initial.percent === null ? '' : String(initial.percent));
  const [cap, setCap] = useState(initial.cap === null ? '' : String(initial.cap));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const e: Record<string, string> = {};
    if (!p.entity.trim()) e.entity = 'Indicá la entidad.';
    const pc = percent.trim() === '' ? null : parseAmount(percent);
    if (percent.trim() !== '' && (pc === null || pc > 100)) e.percent = 'Porcentaje entre 0 y 100, o vacío.';
    const cp = cap.trim() === '' ? null : parseAmount(cap);
    if (cap.trim() !== '' && cp === null) e.cap = 'Importe válido o vacío (sin tope informado).';
    if (p.startDate && p.endDate && p.endDate < p.startDate) e.endDate = 'La fecha final no puede ser anterior al inicio.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const next = { ...p, percent: pc, cap: cp };
    store.updateContent((x) => ({ ...x, promotions: x.promotions.some((q) => q.id === next.id) ? x.promotions.map((q) => (q.id === next.id ? next : q)) : [...x.promotions, next] }));
    const miss = missingPromoFields(next);
    toast(miss.length ? 'Guardada como incompleta' : 'Promoción guardada');
    onClose();
  };
  const set = (k: keyof Promotion) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value });
  const setNull = (k: keyof Promotion) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value || null });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Callout tone="info">Las fechas son civiles de Argentina (America/Argentina/Buenos_Aires). Dejá vacío lo que no esté confirmado: un dato faltante deja la promoción como “incompleta”.</Callout>
      <div className="form-grid">
        <Field label="Entidad" htmlFor="pr-ent" error={errors.entity}><input id="pr-ent" className="input" value={p.entity} onChange={set('entity')} /></Field>
        <Field label="Título breve" htmlFor="pr-tit"><input id="pr-tit" className="input" value={p.title} onChange={set('title')} /></Field>
        <Field label="Inicio" htmlFor="pr-sd"><input id="pr-sd" type="date" className="input" value={p.startDate ?? ''} onChange={setNull('startDate')} /></Field>
        <Field label="Final" htmlFor="pr-ed" error={errors.endDate}><input id="pr-ed" type="date" className="input" value={p.endDate ?? ''} onChange={setNull('endDate')} /></Field>
        <fieldset className="full" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 6 }}>Días</legend>
          <div className="chips">{WEEKDAYS.map((d, i) => <button key={d} type="button" className="chip" aria-pressed={p.days.includes(i)} onClick={() => setP({ ...p, days: p.days.includes(i) ? p.days.filter((x) => x !== i) : [...p.days, i].sort() })}>{d}</button>)}</div>
        </fieldset>
        <Field label="Horario desde" htmlFor="pr-tf"><input id="pr-tf" type="time" className="input" value={p.timeFrom ?? ''} onChange={setNull('timeFrom')} /></Field>
        <Field label="Horario hasta" htmlFor="pr-tt"><input id="pr-tt" type="time" className="input" value={p.timeTo ?? ''} onChange={setNull('timeTo')} /></Field>
        <Field label="Tipo de beneficio" htmlFor="pr-bt">
          <select id="pr-bt" className="input" value={p.benefitType ?? ''} onChange={(e) => setP({ ...p, benefitType: (e.target.value || null) as Promotion['benefitType'] })}>
            <option value="">Sin dato</option><option value="descuento-inmediato">Descuento inmediato</option><option value="reintegro">Reintegro posterior</option><option value="cuotas">Cuotas</option><option value="otro">Otro</option>
          </select>
        </Field>
        <Field label="Porcentaje" htmlFor="pr-pc" error={errors.percent}><input id="pr-pc" className="input" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>
        <Field label="Medio de pago" htmlFor="pr-mp"><input id="pr-mp" className="input" value={p.paymentMethod} onChange={set('paymentMethod')} /></Field>
        <Field label="Tarjetas" htmlFor="pr-cd"><input id="pr-cd" className="input" value={p.cards} onChange={set('cards')} /></Field>
        <Field label="Canal" htmlFor="pr-ch"><input id="pr-ch" className="input" value={p.channel} onChange={set('channel')} placeholder="Presencial, QR, app…" /></Field>
        <Field label="Tope (ARS)" htmlFor="pr-cap" error={errors.cap} hint="Vacío = sin tope informado."><input id="pr-cap" className="input" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
        <Field label="Período del tope" htmlFor="pr-cpp"><input id="pr-cpp" className="input" value={p.capPeriod} onChange={set('capPeriod')} placeholder="por mes, por semana…" /></Field>
        <Field label="Sucursales confirmadas" htmlFor="pr-br"><input id="pr-br" className="input" value={p.branches} onChange={set('branches')} /></Field>
        <Field label="Condiciones" htmlFor="pr-co" full><textarea id="pr-co" className="input" value={p.conditions} onChange={set('conditions')} /></Field>
        <Field label="Exclusiones" htmlFor="pr-ex" full><textarea id="pr-ex" className="input" value={p.exclusions} onChange={set('exclusions')} /></Field>
        <Field label="Fuente" htmlFor="pr-src" hint="Documento o comunicación que confirma la promoción."><input id="pr-src" className="input" value={p.source} onChange={set('source')} /></Field>
        <Field label="Fecha de verificación" htmlFor="pr-vf"><input id="pr-vf" type="date" className="input" value={p.verifiedAt ?? ''} onChange={setNull('verifiedAt')} /></Field>
      </div>
      <div className="row" style={{ marginTop: 16 }}><button type="submit" className="btn btn-primary">Guardar promoción</button><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button></div>
    </form>
  );
}

function PromotionsTab() {
  const c = useContent();
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [del, setDel] = useState<Promotion | null>(null);
  return (
    <section>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>{c.promotions.length ? `${c.promotions.length} promociones en este dispositivo.` : 'Sin promociones cargadas.'}</p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(emptyPromo())}><Plus aria-hidden="true" />Agregar promoción</button>
      </div>
      <ul className="list-plain">
        {c.promotions.map((p) => (
          <li key={p.id} className="card-flat row-between">
            <div><strong>{p.title || p.entity}</strong> <Badge>{PROMO_STATE_LABEL[promoState(p)]}</Badge><div className="small muted">{p.startDate ? `${formatCivil(p.startDate)} – ${formatCivil(p.endDate)}` : 'Sin fechas'}</div></div>
            <div className="row"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}><Pencil aria-hidden="true" />Editar</button><button type="button" className="btn btn-danger btn-sm" onClick={() => setDel(p)}><Trash2 aria-hidden="true" />Eliminar</button></div>
          </li>
        ))}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Promoción" wide>{editing && <PromoForm key={editing.id} initial={editing} onClose={() => setEditing(null)} />}</Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Eliminar promoción" confirmLabel="Eliminar" danger onConfirm={() => { if (del) { store.updateContent((x) => ({ ...x, promotions: x.promotions.filter((q) => q.id !== del.id) })); toast('Promoción eliminada'); } }}>
        <p>Se eliminará “{del?.title || del?.entity}” de este dispositivo.</p>
      </ConfirmModal>
    </section>
  );
}

function FilesTab() {
  const c = useContent();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => { listFiles().then(setFiles).catch(() => setErr('No se pudo leer el almacenamiento de archivos.')); storageEstimate().then(setEst); };
  useEffect(refresh, []);
  const resources = [...BASE_RESOURCES.filter((r) => r.kind !== 'leccion'), ...c.customResources];

  const attach = async (rid: string, f: File | undefined, meta: Partial<Resource>) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const info = await putFile(f);
      const prev = c.resources[rid]?.fileId;
      store.updateContent((x) => ({ ...x, resources: { ...x.resources, [rid]: { ...(x.resources[rid] ?? {}), ...meta, fileId: info.id, updatedAt: meta.updatedAt ?? new Date().toISOString().slice(0, 10) } } }));
      if (prev) await deleteFile(prev).catch(() => undefined);
      toast('Archivo asociado en este dispositivo');
      refresh();
    } catch (e) {
      setErr(e instanceof DOMException && e.name === 'QuotaExceededError' ? 'No hay espacio suficiente en el navegador para este archivo.' : 'No se pudo guardar el archivo en este navegador.');
    } finally { setBusy(false); }
  };
  const attachVideo = async (vid: string, f: File | undefined, kind: 'fileId' | 'captionsFileId') => {
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const info = await putFile(f);
      const prev = c.videos[vid]?.[kind];
      store.updateContent((x) => ({ ...x, videos: { ...x.videos, [vid]: { ...(x.videos[vid] ?? { fileId: null, captionsFileId: null }), [kind]: info.id } } }));
      if (prev) await deleteFile(prev).catch(() => undefined);
      toast(kind === 'fileId' ? 'Video asociado' : 'Subtítulos asociados');
      refresh();
    } catch { setErr('No se pudo guardar el archivo (puede faltar espacio en el navegador).'); } finally { setBusy(false); }
  };
  const detach = async (rid: string) => {
    const fid = c.resources[rid]?.fileId;
    store.updateContent((x) => ({ ...x, resources: { ...x.resources, [rid]: { ...(x.resources[rid] ?? {}), fileId: null } } }));
    if (fid) await deleteFile(fid).catch(() => undefined);
    refresh();
  };
  if (!idbAvailable()) return <Callout tone="err" title="Almacenamiento de archivos no disponible">Este navegador no permite guardar archivos (IndexedDB). Probá con otro navegador o fuera del modo privado.</Callout>;
  return (
    <div className="stack-lg">
      <Callout tone="info" title="Cómo se guardan los archivos">Los archivos se guardan como binarios en el almacenamiento del navegador (IndexedDB) y se vuelven a abrir en cada sesión. No se suben a ningún servidor ni viajan en el JSON de configuración. {est ? `Espacio usado: ${formatBytes(est.usage)} de ${formatBytes(est.quota)} disponibles.` : ''}</Callout>
      {err && <Callout tone="err">{err}</Callout>}
      <section>
        <h2 style={{ fontSize: '1.4rem' }}>Biblioteca</h2>
        <div className="stack">
          {resources.map((r) => <ResourceRow key={r.id} r={{ ...r, ...(c.resources[r.id] ?? {}) }} files={files} busy={busy} onAttach={attach} onDetach={detach} />)}
        </div>
      </section>
      <section>
        <h2 style={{ fontSize: '1.4rem' }}>Videos propios</h2>
        <p className="small muted">Formato recomendado: MP4 (H.264 y AAC), 720p, con subtítulos en WebVTT (.vtt). Los videos grandes ocupan mucho espacio del navegador; para publicarlos para todo el equipo, ver docs/publicacion-cloudflare.md.</p>
        <div className="stack">
          {VIDEO_SCRIPTS.map((v) => {
            const slot = c.videos[v.id];
            const vf = files.find((f) => f.id === slot?.fileId);
            const cf = files.find((f) => f.id === slot?.captionsFileId);
            return (
              <div key={v.id} className="card-flat">
                <div className="row-between"><strong>{v.title}</strong>{vf ? <Badge tone="ok">{vf.name} · {formatBytes(vf.size)}</Badge> : <Badge tone="proposed">Video propio pendiente</Badge>}</div>
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <label className="field"><span className="label">Archivo de video</span><input type="file" className="input" accept="video/mp4,video/webm,video/*" disabled={busy} onChange={(e) => { attachVideo(v.id, e.target.files?.[0], 'fileId'); e.target.value = ''; }} /></label>
                  <label className="field"><span className="label">Subtítulos .vtt {cf && <Badge tone="ok">{cf.name}</Badge>}</span><input type="file" className="input" accept=".vtt,text/vtt" disabled={busy} onChange={(e) => { attachVideo(v.id, e.target.files?.[0], 'captionsFileId'); e.target.value = ''; }} /></label>
                </div>
                {slot?.fileId && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={async () => { const ids = [slot.fileId, slot.captionsFileId].filter(Boolean) as string[]; store.updateContent((x) => { const vv = { ...x.videos }; delete vv[v.id]; return { ...x, videos: vv }; }); await Promise.all(ids.map((i) => deleteFile(i).catch(() => undefined))); refresh(); }}><Trash2 aria-hidden="true" />Quitar video</button>}
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 style={{ fontSize: '1.4rem' }}>Agregar un material propio</h2>
        <NewResource />
      </section>
    </div>
  );
}

function ResourceRow({ r, files, busy, onAttach, onDetach }: { r: Resource; files: FileInfo[]; busy: boolean; onAttach: (id: string, f: File | undefined, meta: Partial<Resource>) => void; onDetach: (id: string) => void }) {
  const f = files.find((x) => x.id === r.fileId);
  const [version, setVersion] = useState(r.version ?? '');
  const [updatedAt, setUpdatedAt] = useState(r.updatedAt ?? '');
  const [searchText, setSearchText] = useState(r.searchText ?? '');
  const saveMeta = () => { store.updateContent((x) => ({ ...x, resources: { ...x.resources, [r.id]: { ...(x.resources[r.id] ?? {}), version: version || null, updatedAt: updatedAt || null, searchText: searchText || null } } })); toast('Metadatos guardados'); };
  return (
    <details className="card-flat">
      <summary className="row-between" style={{ cursor: 'pointer' }}><strong>{r.title}</strong>{f ? <Badge tone="ok" icon={<Paperclip aria-hidden="true" />}>{f.name} · {formatBytes(f.size)}</Badge> : r.fileId ? <Badge tone="err">Archivo no encontrado</Badge> : <Badge tone="warn">Pendiente</Badge>}</summary>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <label className="field full"><span className="label">Archivo (PDF, imagen o documento)</span><input type="file" className="input" disabled={busy} accept="application/pdf,image/*,video/*,.doc,.docx,.txt" onChange={(e) => { onAttach(r.id, e.target.files?.[0], { version: version || null, updatedAt: updatedAt || null }); e.target.value = ''; }} /></label>
        <Field label="Versión" htmlFor={`${r.id}-v`}><input id={`${r.id}-v`} className="input" value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
        <Field label="Fecha de actualización" htmlFor={`${r.id}-u`}><input id={`${r.id}-u`} type="date" className="input" value={updatedAt} onChange={(e) => setUpdatedAt(e.target.value)} /></Field>
        <Field label="Texto para la búsqueda (opcional)" htmlFor={`${r.id}-s`} hint="Pegá el texto del documento para que el buscador lo encuentre. Los PDF escaneados no tienen texto: requieren transcripción u OCR." full><textarea id={`${r.id}-s`} className="input" value={searchText} onChange={(e) => setSearchText(e.target.value)} /></Field>
        <div className="full row">
          <button type="button" className="btn btn-primary btn-sm" onClick={saveMeta}>Guardar metadatos</button>
          {r.fileId && <button type="button" className="btn btn-danger btn-sm" onClick={() => onDetach(r.id)}><Trash2 aria-hidden="true" />Quitar archivo</button>}
        </div>
      </div>
    </details>
  );
}

function NewResource() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Resource['category']>('Atención');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const add = async () => {
    const f = ref.current?.files?.[0];
    if (!title.trim()) { setErr('Indicá un título.'); return; }
    if (!f) { setErr('Elegí un archivo.'); return; }
    setErr(null);
    try {
      const info = await putFile(f);
      const kind: Resource['kind'] = f.type.includes('pdf') ? 'pdf' : f.type.startsWith('image/') ? 'imagen' : f.type.startsWith('video/') ? 'video' : 'documento';
      const r: Resource = { id: uid('res'), title: title.trim(), category, description: description.trim(), kind, version: null, updatedAt: new Date().toISOString().slice(0, 10), href: null, fileId: info.id, searchText: null };
      store.updateContent((x) => ({ ...x, customResources: [...x.customResources, r] }));
      setTitle(''); setDescription(''); if (ref.current) ref.current.value = '';
      toast('Material agregado a la biblioteca de este dispositivo');
    } catch { setErr('No se pudo guardar el archivo en este navegador.'); }
  };
  return (
    <div className="card-flat form-grid">
      <Field label="Título" htmlFor="nr-t" error={err}><input id="nr-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Categoría" htmlFor="nr-c"><select id="nr-c" className="input" value={category} onChange={(e) => setCategory(e.target.value as Resource['category'])}>{['Atención', 'Productos', 'Códigos', 'Promociones', 'Personal', 'Seguridad e higiene', 'Cultura', 'Videos'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Descripción" htmlFor="nr-d" full><input id="nr-d" className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <label className="field full"><span className="label">Archivo</span><input ref={ref} type="file" className="input" /></label>
      <div className="full"><button type="button" className="btn btn-primary" onClick={add}><FileUp aria-hidden="true" />Agregar material</button></div>
    </div>
  );
}

function SettingsTab() {
  const c = useContent();
  const [goals, setGoals] = useState(c.timeGoals.map((g) => ({ ...g, minutesText: g.minutes === null ? '' : String(g.minutes) })));
  const [threshold, setThreshold] = useState(String(c.settings.threshold));
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const t = Number(threshold);
    if (!Number.isInteger(t) || t < 1 || t > 100) { setErr('El umbral debe ser un número entero entre 1 y 100.'); return; }
    const bad = goals.find((g) => g.minutesText.trim() !== '' && !(Number(g.minutesText) > 0));
    if (bad) { setErr(`La meta de “${bad.label}” debe ser un número de minutos mayor que cero, o quedar vacía.`); return; }
    setErr(null);
    store.updateContent((x) => ({ ...x, settings: { ...x.settings, threshold: t }, timeGoals: goals.map(({ minutesText, ...g }) => ({ ...g, minutes: minutesText.trim() === '' ? null : Number(minutesText) })) }));
    toast('Ajustes guardados');
  };
  return (
    <div className="stack-lg">
      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Metas de tiempo del servicio</h2>
        <p className="small muted">Inicialmente vacías: se muestran como “Meta sin definir” hasta que El Cóndor defina un estándar propio. Cada meta necesita hitos de inicio y fin explícitos.</p>
        <div className="stack">
          {goals.map((g, i) => (
            <div key={g.id} className="form-grid card-flat">
              <Field label="Etapa" htmlFor={`g-l-${i}`}><input id={`g-l-${i}`} className="input" value={g.label} onChange={(e) => setGoals(goals.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} /></Field>
              <Field label="Hito de inicio" htmlFor={`g-s-${i}`}><input id={`g-s-${i}`} className="input" value={g.start} onChange={(e) => setGoals(goals.map((x, k) => (k === i ? { ...x, start: e.target.value } : x)))} /></Field>
              <Field label="Hito de fin" htmlFor={`g-e-${i}`}><input id={`g-e-${i}`} className="input" value={g.end} onChange={(e) => setGoals(goals.map((x, k) => (k === i ? { ...x, end: e.target.value } : x)))} /></Field>
              <Field label="Minutos" htmlFor={`g-m-${i}`} hint="Vacío = meta sin definir."><input id={`g-m-${i}`} className="input" inputMode="numeric" value={g.minutesText} onChange={(e) => setGoals(goals.map((x, k) => (k === i ? { ...x, minutesText: e.target.value } : x)))} /></Field>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Umbral pedagógico de las evaluaciones</h2>
        <p className="small muted">Parámetro de práctica sugerido: 80 %. No es un requisito aprobado por El Cóndor. Se aplica a los intentos nuevos.</p>
        <Field label="Umbral (%)" htmlFor="s-th"><input id="s-th" className="input" style={{ maxWidth: 140 }} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
      </section>
      {err && <Callout tone="err">{err}</Callout>}
      <div><button type="button" className="btn btn-primary" onClick={save}>Guardar ajustes</button></div>
    </div>
  );
}

function BackupTab() {
  const c = useContent();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ b: ContentBackup; warnings: string[] } | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const exportIt = async () => {
    const files = await listFiles().catch(() => []);
    downloadJSON(`contenido-el-condor-${new Date().toISOString().slice(0, 10)}.json`, buildContentBackup(c, files));
  };
  const onFile = async (f: File | undefined) => {
    setErrors(null);
    if (!f) return;
    try {
      const v = validateContentBackup(await readJSONFile(f));
      if (!v.ok) { setErrors(v.errors); return; }
      setPending({ b: v.value, warnings: v.warnings });
    } catch (e) { setErrors([(e as Error).message]); }
  };
  return (
    <div className="stack-lg">
      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Exportar configuración</h2>
        <p>Descarga un JSON con textos, metadatos, productos, códigos, promociones, metas y ajustes de este dispositivo.</p>
        <Callout tone="warning" title="Los archivos no viajan en el JSON">PDF, imágenes y videos no se incluyen. El JSON trae un manifiesto (“fileManifest”) que lista qué archivos hay que volver a asociar en el otro dispositivo.</Callout>
        <button type="button" className="btn btn-primary" onClick={exportIt}><Download aria-hidden="true" />Exportar JSON</button>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Importar configuración</h2>
        <p>Se valida la versión y la estructura antes de aplicar. Si el archivo no es válido, la configuración actual no cambia.</p>
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.click()}><Upload aria-hidden="true" />Elegir archivo JSON</button>
        <input ref={ref} type="file" accept=".json,application/json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        {errors && <div style={{ marginTop: 14 }}><Callout tone="err" title="No se importó la configuración">La configuración actual no cambió. {errors.join(' ')}</Callout></div>}
      </section>
      <Modal open={!!pending} onClose={() => setPending(null)} title="Reemplazar la configuración" footer={pending && (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={() => { store.replaceContent(pending.b.content); setPending(null); toast('Configuración importada'); setQuery({ t: 'respaldo' }); }}>Reemplazar configuración</button>
        </>
      )}>
        {pending && (
          <div className="stack">
            <dl className="kv">
              <dt>Exportada</dt><dd>{formatTimestamp(pending.b.exportedAt)}</dd>
              <dt>Contiene</dt><dd>{pending.b.content.products.length} productos · {pending.b.content.codes.length} códigos · {pending.b.content.promotions.length} promociones</dd>
              <dt>Actual</dt><dd>{c.products.length} productos · {c.codes.length} códigos · {c.promotions.length} promociones</dd>
            </dl>
            {pending.warnings.map((w) => <Callout key={w} tone="warning">{w}</Callout>)}
            {pending.b.fileManifest?.length > 0 && (
              <div><strong>Archivos mencionados</strong><ul className="small">{pending.b.fileManifest.map((f) => <li key={f.fileId}>{f.usedBy}: {f.name ?? 'sin nombre'}{f.size ? ` (${formatBytes(f.size)})` : ''}</li>)}</ul></div>
            )}
            <p>La configuración actual de este dispositivo se reemplazará por completo. El progreso de los perfiles no se modifica.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
