import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../auth.jsx';
import Modal from '../../components/Modal.jsx';
import {
  ahoraAR, diaSemana, fmtCantidad, fmtFechaCorta, fmtFechaLarga, fmtMoneda, limitePedido,
  nombreCliente, pedidoAbierto, sumarDias,
} from '../../lib/formato.js';

const WHATSAPP = import.meta.env.VITE_WHATSAPP;
const sinAcentos = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function Cantidad({ valor, medios, onChange, disabled, nombre }) {
  const paso = medios ? 0.5 : 1;
  const mostrar = (v) => (v ? String(v).replace('.', ',') : '');
  const [texto, setTexto] = useState(mostrar(valor));
  useEffect(() => setTexto(mostrar(valor)), [valor]);
  const normalizar = (n) => (!Number.isFinite(n) || n <= 0 ? 0 : medios ? Math.round(n * 2) / 2 : Math.round(n));
  const confirmar = () => onChange(normalizar(parseFloat(texto.replace(',', '.'))));
  return (
    <div className="cantidad">
      <button type="button" disabled={disabled || !valor} onClick={() => onChange(normalizar((valor || 0) - paso))} aria-label={`Restar ${nombre}`}>−</button>
      <input
        value={texto} disabled={disabled} inputMode="decimal" aria-label={`Cantidad de ${nombre}`} placeholder="0"
        onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={confirmar} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <button type="button" disabled={disabled} onClick={() => onChange(normalizar((valor || 0) + paso))} aria-label={`Sumar ${nombre}`}>+</button>
    </div>
  );
}

export default function HacerPedido({ modoAdmin = false }) {
  const { cliente: miCliente } = useAuth();
  const [params, setParams] = useSearchParams();
  const [clientes, setClientes] = useState([]);
  const clienteId = modoAdmin ? params.get('cliente') || '' : miCliente?.id;
  const cliente = modoAdmin ? clientes.find((c) => c.id === clienteId) : miCliente;

  const [horaCorte, setHoraCorte] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [fecha, setFecha] = useState(params.get('fecha') || '');
  const [existente, setExistente] = useState(null);
  const [cant, setCant] = useState({});
  const [obs, setObs] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abiertas, setAbiertas] = useState({});
  const [revisar, setRevisar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // Datos iniciales
  useEffect(() => {
    supabase.from('config').select('hora_corte').eq('id', 1).single().then(({ data }) => setHoraCorte(data?.hora_corte || '20:00:00'));
    supabase.rpc('catalogo').then(({ data, error }) => setCatalogo(error ? [] : data));
    if (modoAdmin) supabase.from('clientes').select('*').neq('estado', 'baja').order('razon_social').then(({ data }) => setClientes(data || []));
  }, [modoAdmin]);

  // Fechas que se pueden elegir (próximos 14 días)
  const fechas = useMemo(() => {
    if (!horaCorte || !cliente) return [];
    const hoy = ahoraAR().fecha;
    return Array.from({ length: modoAdmin ? 15 : 14 }, (_, i) => sumarDias(hoy, modoAdmin ? i : i + 1)).map((f) => ({
      fecha: f,
      cerrado: (cliente.dias_cerrado || []).includes(diaSemana(f)),
      abierto: modoAdmin || pedidoAbierto(f, horaCorte),
    }));
  }, [horaCorte, cliente, modoAdmin]);

  // Fecha por defecto: la primera disponible (normalmente mañana)
  useEffect(() => {
    if (!fechas.length) return;
    if (!fecha || !fechas.some((f) => f.fecha === fecha)) {
      const primera = fechas.find((f) => f.abierto && !f.cerrado && (!modoAdmin || f.fecha !== ahoraAR().fecha)) || fechas[0];
      setFecha(primera.fecha);
    }
  }, [fechas, fecha, modoAdmin]);

  // Pedido ya cargado para esa fecha
  useEffect(() => {
    if (!clienteId || !fecha) return;
    let vigente = true;
    setExistente(undefined);
    supabase.from('pedidos').select('*, pedido_items(*)').eq('cliente_id', clienteId).eq('fecha_entrega', fecha).maybeSingle()
      .then(({ data }) => {
        if (!vigente) return;
        setExistente(data || null);
        const activo = data && data.estado !== 'cancelado';
        setCant(activo ? Object.fromEntries(data.pedido_items.map((i) => [i.producto_id, Number(i.cantidad)])) : {});
        setObs(activo ? data.observacion || '' : '');
      });
    return () => { vigente = false; };
  }, [clienteId, fecha, recarga]);

  const infoFecha = fechas.find((f) => f.fecha === fecha);
  const bloqueado = !modoAdmin && (
    (infoFecha && !infoFecha.abierto) || (existente && !['recibido', 'cancelado'].includes(existente.estado)));
  const modificando = existente && existente.estado !== 'cancelado';
  const verPrecios = modoAdmin || cliente?.ve_precios;

  const elegidos = useMemo(() => (catalogo || []).filter((p) => cant[p.id] > 0), [catalogo, cant]);
  const total = elegidos.reduce((s, p) => s + (p.precio != null ? cant[p.id] * p.precio : 0), 0);

  // Catálogo agrupado: sección → categoría → productos
  const grupos = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    const out = [];
    for (const p of catalogo || []) {
      if (q && !sinAcentos(`${p.nombre} ${p.presentacion} ${p.categoria}`).includes(q)) continue;
      let s = out.find((x) => x.seccion === p.seccion);
      if (!s) out.push((s = { seccion: p.seccion, categorias: [] }));
      let c = s.categorias.find((x) => x.nombre === p.categoria);
      if (!c) s.categorias.push((c = { nombre: p.categoria, productos: [] }));
      c.productos.push(p);
    }
    return out;
  }, [catalogo, busqueda]);

  const cambiar = (id, v) => setCant((c) => ({ ...c, [id]: v }));

  async function confirmar() {
    setEnviando(true); setError('');
    try {
      const r = await api('pedido', {
        cliente_id: clienteId, fecha_entrega: fecha, observacion: obs,
        items: elegidos.map((p) => ({ producto_id: p.id, cantidad: cant[p.id] })),
      });
      setListo(r); setRevisar(false); setRecarga((x) => x + 1);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e.message);
    }
    setEnviando(false);
  }

  // ---------- Pantallas ----------
  if (listo) {
    return (
      <div className="tarjeta" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <h1>Pedido #{listo.pedido_id} {listo.nuevo ? 'enviado' : 'modificado'}</h1>
        <p>Entrega: <b>{fmtFechaLarga(fecha)}</b>{modoAdmin && cliente ? <> · {nombreCliente(cliente)}</> : null}</p>
        {listo.emails?.fabrica === false && (
          <div className="aviso alerta">El pedido quedó guardado, pero no se pudo enviar el email de aviso. {modoAdmin ? 'Revisá la configuración de emails.' : 'El Cóndor igual lo ve en el sistema.'}</div>
        )}
        {!modoAdmin && listo.emails?.cliente && <p className="suave">Te mandamos la confirmación por email.</p>}
        {!modoAdmin && horaCorte && (
          <p className="suave">Podés modificarlo hasta las {horaCorte.slice(0, 5)} hs del {fmtFechaCorta(limitePedido(fecha, horaCorte).fecha)}.</p>
        )}
        <div className="fila" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button onClick={() => setListo(null)}>{modoAdmin ? 'Seguir editando' : 'Ver / modificar'}</button>
          {modoAdmin ? <Link className="boton primario" to={`/admin/pedidos?fecha=${fecha}`}>Ir a pedidos</Link>
            : <Link className="boton primario" to="/mis-pedidos">Mis pedidos</Link>}
        </div>
      </div>
    );
  }

  if (catalogo === null || horaCorte === null || (!modoAdmin && !cliente)) return <div className="cargando">Cargando catálogo…</div>;

  return (
    <>
      {modoAdmin && (
        <div className="tarjeta">
          <h1>Cargar pedido para un cliente</h1>
          <label htmlFor="cli">Cliente</label>
          <select id="cli" value={clienteId} onChange={(e) => setParams({ cliente: e.target.value, ...(fecha ? { fecha } : {}) })}>
            <option value="">Elegí un cliente…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}{c.estado !== 'activo' ? ` (${c.estado})` : ''}</option>)}
          </select>
          <div className="ayuda">Como administrador podés cargar o modificar pedidos después de la hora de corte.</div>
        </div>
      )}

      {cliente && (
        <>
          <h2 style={{ marginTop: modoAdmin ? 0 : 4 }}>Fecha de entrega</h2>
          <div className="fechas" role="radiogroup" aria-label="Fecha de entrega">
            {fechas.map((f) => {
              const deshabilitado = !modoAdmin && (!f.abierto || f.cerrado);
              return (
                <button key={f.fecha} type="button" role="radio" aria-checked={f.fecha === fecha}
                  className={f.fecha === fecha ? 'activa' : ''} disabled={deshabilitado && f.fecha !== fecha}
                  onClick={() => { setFecha(f.fecha); if (modoAdmin) setParams({ cliente: clienteId, fecha: f.fecha }); }}>
                  <span>{DIAS[diaSemana(f.fecha)]}</span>
                  <span className="dia">{f.fecha.slice(8)}/{f.fecha.slice(5, 7)}</span>
                  {f.cerrado && <small>cerrado</small>}
                </button>
              );
            })}
          </div>

          {!fecha || existente === undefined ? <div className="cargando">…</div> : (
            <>
              {modificando && !bloqueado && (
                <div className="aviso info">
                  Ya {modoAdmin ? 'hay' : 'tenés'} un pedido para el {fmtFechaCorta(fecha)} (#{existente.id}). Lo que cambies se envía como <b>modificación</b>.
                </div>
              )}
              {bloqueado && (
                <div className="aviso alerta">
                  {existente && !['recibido', 'cancelado'].includes(existente.estado)
                    ? 'Este pedido ya está en preparación y no se puede modificar.'
                    : `Ya pasó la hora de corte (${horaCorte.slice(0, 5)} hs del ${fmtFechaCorta(limitePedido(fecha, horaCorte).fecha)}).`}
                  {' '}Para cambios, comunicate por WhatsApp
                  {WHATSAPP && <> — <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, soy ${nombreCliente(cliente)}. Quiero hacer un cambio en mi pedido para el ${fmtFechaCorta(fecha)}.`)}`} target="_blank" rel="noreferrer">escribinos acá</a></>}.
                </div>
              )}
              {!bloqueado && !modoAdmin && (
                <p className="ayuda" style={{ marginTop: 8 }}>
                  Podés cargar y modificar este pedido hasta las <b>{horaCorte.slice(0, 5)} hs del {fmtFechaCorta(limitePedido(fecha, horaCorte).fecha)}</b>.
                </p>
              )}
              {cliente.observaciones_fijas && modoAdmin && <div className="aviso alerta">Obs. fijas: {cliente.observaciones_fijas}</div>}

              <div className="buscador">
                <input type="search" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar producto" />
              </div>

              {grupos.length === 0 && <p className="suave">No hay productos que coincidan con “{busqueda}”.</p>}
              {grupos.map((s) => (
                <section key={s.seccion}>
                  <div className="seccion-titulo">{s.seccion}</div>
                  {s.categorias.map((c) => {
                    const abierta = busqueda.trim() || abiertas[c.nombre];
                    const nElegidos = c.productos.filter((p) => cant[p.id] > 0).length;
                    return (
                      <div className="categoria" key={c.nombre}>
                        <button type="button" aria-expanded={!!abierta} onClick={() => setAbiertas((a) => ({ ...a, [c.nombre]: !a[c.nombre] }))}>
                          <span>{c.nombre}{nElegidos > 0 && <span className="contador">{nElegidos}</span>}</span>
                          <span aria-hidden>{abierta ? '▴' : '▾'}</span>
                        </button>
                        {abierta && c.productos.map((p) => (
                          <div className={`producto${cant[p.id] > 0 ? ' elegido' : ''}`} key={p.id}>
                            <div className="info">
                              <div className="nombre">{p.nombre}</div>
                              <div className="pres">
                                {p.presentacion}{p.permite_medios ? ' · acepta ½' : ''}
                                {verPrecios && p.precio != null && <> · {fmtMoneda(p.precio)}</>}
                              </div>
                            </div>
                            <Cantidad valor={cant[p.id] || 0} medios={p.permite_medios} disabled={bloqueado} nombre={p.nombre} onChange={(v) => cambiar(p.id, v)} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </section>
              ))}

              {!bloqueado && (
                <div className="pie-fijo">
                  <div className="interno">
                    <div className="crece">
                      <b>{elegidos.length} {elegidos.length === 1 ? 'producto' : 'productos'}</b>
                      {verPrecios && total > 0 && <div className="suave" style={{ fontSize: '.85rem' }}>{fmtMoneda(total)} + IVA</div>}
                    </div>
                    <button className="primario" disabled={!elegidos.length} onClick={() => { setError(''); setRevisar(true); }}>
                      Revisar {modificando ? 'cambios' : 'pedido'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {revisar && (
        <Modal titulo={modificando ? `Modificar pedido #${existente.id}` : 'Revisar pedido'} onCerrar={() => !enviando && setRevisar(false)}>
          <p style={{ marginTop: 0 }}>
            {modoAdmin && <><b>{nombreCliente(cliente)}</b><br /></>}
            Entrega: <b>{fmtFechaLarga(fecha)}</b>
            {cliente.direccion && <><br /><span className="suave">{cliente.direccion}{cliente.horario_limite ? ` · ${cliente.horario_limite}` : ''}</span></>}
          </p>
          <ul className="lista-items">
            {elegidos.map((p) => (
              <li key={p.id}>
                <span className="cant">{fmtCantidad(cant[p.id], p.presentacion).replace(` × ${p.presentacion}`, ' ×')}</span>
                <span className="crece">{p.nombre}{!['kg', 'unidad'].includes(p.presentacion.toLowerCase()) && <span className="suave"> · {p.presentacion}</span>}</span>
                {verPrecios && p.precio != null && <span className="suave">{fmtMoneda(cant[p.id] * p.precio)}</span>}
              </li>
            ))}
          </ul>
          {verPrecios && total > 0 && <p className="derecha" style={{ textAlign: 'right' }}><b>Total {fmtMoneda(total)}</b> <span className="suave">+ IVA</span></p>}
          <label htmlFor="obs">Observación (opcional)</label>
          <textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej.: entregar por la puerta de atrás" maxLength={500} />
          {error && <div className="aviso error">{error}</div>}
          <div className="fila" style={{ marginTop: 14 }}>
            <button className="crece" onClick={() => setRevisar(false)} disabled={enviando}>Seguir eligiendo</button>
            <button className="primario crece" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Enviando…' : modificando ? 'Confirmar cambios' : 'Confirmar pedido'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
