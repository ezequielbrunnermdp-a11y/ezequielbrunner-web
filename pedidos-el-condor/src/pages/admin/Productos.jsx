import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import Modal from '../../components/Modal.jsx';
import { fmtMoneda } from '../../lib/formato.js';

const sinAcentos = (s = '') => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Lee números como 1890.00, 1.890,00 o "$ 1,890.00"
export function leerPrecio(txt) {
  let s = String(txt ?? '').replace(/[^\d.,-]/g, '');
  const ultimo = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (ultimo >= 0 && s.length - ultimo - 1 <= 2) {
    s = `${s.slice(0, ultimo).replace(/[.,]/g, '')}.${s.slice(ultimo + 1)}`;
  } else s = s.replace(/[.,]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// CSV simple con comillas; detecta separador , o ;
function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ';' : ',';
  const partir = (l) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const cab = partir(lineas[0]).map((h) => sinAcentos(h));
  return lineas.slice(1).map((l) => Object.fromEntries(partir(l).map((v, i) => [cab[i], v])));
}

function EditarProducto({ producto, categorias, onCerrar, onGuardado }) {
  const [f, setF] = useState(producto || { nombre: '', presentacion: 'Unidad', precio_sin_iva: '', categoria_id: categorias[0]?.id, permite_medios: false, activo: true });
  const [precio, setPrecio] = useState(producto ? String(producto.precio_sin_iva).replace('.', ',') : '');
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    const p = leerPrecio(precio);
    if (p === null) return setError('Precio inválido.');
    const datos = { nombre: f.nombre.trim().toUpperCase(), presentacion: f.presentacion.trim(), precio_sin_iva: p,
      categoria_id: Number(f.categoria_id), permite_medios: f.permite_medios, activo: f.activo };
    const q = producto ? supabase.from('productos').update(datos).eq('id', producto.id) : supabase.from('productos').insert({ ...datos, orden: 99999 });
    const { error } = await q;
    if (error) return setError(error.code === '23505' ? 'Ya existe un producto con ese nombre y presentación.' : 'No se pudo guardar.');
    onGuardado();
  }

  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label htmlFor="pn">Nombre</label>
        <input id="pn" value={f.nombre} onChange={set('nombre')} required />
        <label htmlFor="pp">Presentación de venta</label>
        <input id="pp" value={f.presentacion} onChange={set('presentacion')} required list="presentaciones" />
        <datalist id="presentaciones">{['Kg', 'Unidad', 'Docena (12 unidades)', 'Caja de 6 unidades', 'Caja de 120 unidades (10 docenas)', 'Pack de 7 unidades'].map((x) => <option key={x} value={x} />)}</datalist>
        <label htmlFor="pr">Precio sin IVA</label>
        <input id="pr" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
        <label htmlFor="pc">Categoría</label>
        <select id="pc" value={f.categoria_id} onChange={set('categoria_id')}>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.seccion} · {c.nombre}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={f.permite_medios} onChange={set('permite_medios')} /> Acepta medios (0,5) — para productos por kg</label>
        <label className="check"><input type="checkbox" checked={f.activo} onChange={set('activo')} /> Activo (se muestra a los clientes)</label>
        {error && <div className="aviso error">{error}</div>}
        <button className="primario ancho" style={{ marginTop: 12 }}>Guardar</button>
      </form>
    </Modal>
  );
}

function Importar({ productos, onCerrar, onListo }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  async function leer(e) {
    setError('');
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const datos = leerCsv(await archivo.text());
      const req = ['seccion', 'categoria', 'producto', 'presentacion', 'precio_sin_iva'];
      if (!datos.length || req.some((k) => !(k in datos[0]))) throw new Error(`El archivo tiene que tener las columnas: ${req.join(', ')}`);
      const malas = datos.filter((d) => !d.producto || !d.presentacion || leerPrecio(d.precio_sin_iva) === null);
      if (malas.length) throw new Error(`Hay ${malas.length} filas incompletas o con precio inválido (ej.: "${malas[0].producto || 'sin nombre'}").`);
      const existentes = new Map(productos.map((p) => [`${p.nombre}|${p.presentacion}`.toLowerCase(), p]));
      setFilas(datos.map((d, i) => {
        const ex = existentes.get(`${d.producto}|${d.presentacion}`.toLowerCase());
        const precio = leerPrecio(d.precio_sin_iva);
        return { ...d, precio, orden: (i + 1) * 10, estado: !ex ? 'nuevo' : Number(ex.precio_sin_iva) !== precio ? 'precio' : 'igual', anterior: ex?.precio_sin_iva };
      }));
    } catch (err) { setError(err.message); setFilas(null); }
  }

  async function importar() {
    setTrabajando(true); setError('');
    try {
      const cats = [];
      filas.forEach((f) => { if (!cats.some((c) => c.seccion === f.seccion && c.nombre === f.categoria)) cats.push({ seccion: f.seccion, nombre: f.categoria }); });
      const { data: catsDb, error: e1 } = await supabase.from('categorias')
        .upsert(cats.map((c, i) => ({ ...c, orden: (i + 1) * 10 })), { onConflict: 'seccion,nombre' }).select();
      if (e1) throw e1;
      const idCat = (f) => catsDb.find((c) => c.seccion === f.seccion && c.nombre === f.categoria).id;
      const { error: e2 } = await supabase.from('productos').upsert(filas.map((f) => ({
        nombre: f.producto, presentacion: f.presentacion, precio_sin_iva: f.precio, categoria_id: idCat(f),
        permite_medios: f.presentacion.toLowerCase() === 'kg', orden: f.orden, activo: true,
      })), { onConflict: 'nombre,presentacion' });
      if (e2) throw e2;
      onListo(`Importación lista: ${filas.filter((f) => f.estado === 'nuevo').length} nuevos, ${filas.filter((f) => f.estado === 'precio').length} con precio actualizado.`);
    } catch (err) {
      setError(`No se pudo importar: ${err.message}`);
    }
    setTrabajando(false);
  }

  const cambios = filas?.filter((f) => f.estado !== 'igual') || [];
  return (
    <Modal titulo="Importar catálogo (CSV)" onCerrar={onCerrar}>
      <p className="suave" style={{ marginTop: 0 }}>Columnas: <code>seccion, categoria, producto, presentacion, precio_sin_iva</code>. Los productos que ya existen (mismo nombre y presentación) actualizan su precio y categoría; los nuevos se agregan. No se borra nada.</p>
      <input type="file" accept=".csv,text/csv" onChange={leer} />
      {error && <div className="aviso error">{error}</div>}
      {filas && (
        <>
          <p><b>{filas.length}</b> filas · <b>{filas.filter((f) => f.estado === 'nuevo').length}</b> nuevos · <b>{filas.filter((f) => f.estado === 'precio').length}</b> cambian de precio</p>
          {cambios.length > 0 && (
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
              <table className="tabla">
                <tbody>
                  {cambios.slice(0, 200).map((f, i) => (
                    <tr key={i}>
                      <td>{f.producto}<br /><small>{f.presentacion}</small></td>
                      <td className="derecha">{f.estado === 'nuevo' ? <span className="etiqueta activo">nuevo</span> : <small>{fmtMoneda(f.anterior)} →</small>}<br />{fmtMoneda(f.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button className="primario ancho" style={{ marginTop: 12 }} disabled={trabajando} onClick={importar}>{trabajando ? 'Importando…' : 'Importar'}</button>
        </>
      )}
    </Modal>
  );
}

export default function Productos() {
  const [productos, setProductos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [q, setQ] = useState('');
  const [verInactivos, setVerInactivos] = useState(true);
  const [editando, setEditando] = useState(null); // producto | 'nuevo'
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    supabase.from('categorias').select('*').order('orden').then(({ data }) => setCategorias(data || []));
    supabase.from('productos').select('*').order('orden').order('nombre').then(({ data }) => setProductos(data || []));
  }, [recarga]);

  async function guardarPrecio(p, texto) {
    const precio = leerPrecio(texto);
    if (precio === null || precio === Number(p.precio_sin_iva)) return;
    const { error } = await supabase.from('productos').update({ precio_sin_iva: precio }).eq('id', p.id);
    setMensaje(error ? { tipo: 'error', texto: 'No se pudo guardar el precio.' } : { tipo: 'ok', texto: `${p.nombre}: ${fmtMoneda(precio)}` });
    setRecarga((x) => x + 1);
  }

  async function alternarActivo(p) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id);
    setRecarga((x) => x + 1);
  }

  const grupos = useMemo(() => {
    const qq = sinAcentos(q);
    return categorias.map((c) => ({
      ...c,
      productos: (productos || []).filter((p) => p.categoria_id === c.id && (verInactivos || p.activo) && (!qq || sinAcentos(`${p.nombre} ${p.presentacion}`).includes(qq))),
    })).filter((c) => c.productos.length);
  }, [categorias, productos, q, verInactivos]);

  return (
    <>
      <div className="entre">
        <h1>Productos</h1>
        <div className="fila">
          <button className="chico" onClick={() => setImportando(true)}>Importar CSV</button>
          <button className="chico primario" onClick={() => setEditando('nuevo')}>+ Nuevo</button>
        </div>
      </div>
      <p className="suave" style={{ marginTop: 0 }}>Precios mayoristas <b>sin IVA</b>. Para cambiar un precio, editalo y tocá fuera del casillero.</p>
      <input type="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar producto" />
      <label className="check"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Mostrar inactivos</label>
      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
      {productos === null && <div className="cargando">Cargando…</div>}
      {productos && !productos.length && <div className="aviso info">No hay productos. Usá “Importar CSV” para cargar el catálogo.</div>}

      {grupos.map((c) => (
        <div className="tarjeta" key={c.id} style={{ padding: '6px 12px' }}>
          <h3 style={{ margin: '8px 0' }}>{c.nombre} <small>· {c.seccion}</small></h3>
          {c.productos.map((p) => (
            <div key={p.id} className="fila" style={{ padding: '8px 0', borderTop: '1px solid #f0ebe4', opacity: p.activo ? 1 : 0.55, flexWrap: 'nowrap' }}>
              <div className="crece">
                <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{p.nombre}</div>
                <small>{p.presentacion}{!p.activo ? ' · INACTIVO' : ''}</small>
              </div>
              <input key={`${p.id}-${p.precio_sin_iva}`} defaultValue={String(p.precio_sin_iva).replace('.', ',')} inputMode="decimal"
                style={{ width: 110, textAlign: 'right' }} aria-label={`Precio de ${p.nombre}`}
                onBlur={(e) => guardarPrecio(p, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
              <button className="chico" onClick={() => setEditando(p)} aria-label={`Editar ${p.nombre}`}>✎</button>
              <button className="chico" onClick={() => alternarActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'}>{p.activo ? 'Ocultar' : 'Activar'}</button>
            </div>
          ))}
        </div>
      ))}

      {editando && <EditarProducto producto={editando === 'nuevo' ? null : editando} categorias={categorias}
        onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); setRecarga((x) => x + 1); }} />}
      {importando && <Importar productos={productos || []} onCerrar={() => setImportando(false)}
        onListo={(t) => { setImportando(false); setMensaje({ tipo: 'ok', texto: t }); setRecarga((x) => x + 1); }} />}
    </>
  );
}
