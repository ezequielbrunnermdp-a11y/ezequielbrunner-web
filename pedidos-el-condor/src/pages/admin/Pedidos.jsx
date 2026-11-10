import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { abrirPdf, api } from '../../lib/api.js';
import { useAuth } from '../../auth.jsx';
import BarraFecha, { useFecha } from '../../components/BarraFecha.jsx';
import Modal from '../../components/Modal.jsx';
import PedidoItems from '../../components/PedidoItems.jsx';
import { ordenarItems, SELECT_DIA } from '../../lib/resumen.js';
import { cantidadCorta, descripcion, ESTADOS, fmtCantidad, fmtFechaHora, nombreCliente } from '../../lib/formato.js';

const errorPed = (e) => (e?.message?.startsWith('PED: ') ? e.message.slice(5) : 'No se pudo guardar. Probá de nuevo.');

// Elegir qué faltó y cuánto
function MarcarFaltantes({ pedido, onCerrar, onListo }) {
  const items = ordenarItems(pedido.pedido_items);
  const previos = Object.fromEntries((pedido.faltantes || []).filter((f) => f.estado === 'abierto').map((f) => [f.producto_id, Number(f.cantidad)]));
  const [falta, setFalta] = useState(previos);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const lista = Object.entries(falta).filter(([, c]) => c > 0).map(([producto_id, cantidad]) => ({ producto_id: Number(producto_id), cantidad }));
    if (!lista.length) return setError('Marcá al menos un producto que faltó.');
    setGuardando(true);
    const { error } = await supabase.rpc('marcar_estado', { p_pedido: pedido.id, p_estado: 'entregado_faltantes', p_faltantes: lista });
    setGuardando(false);
    if (error) return setError(errorPed(error));
    onListo();
  }

  return (
    <Modal titulo={`Faltantes · ${nombreCliente(pedido.cliente)}`} onCerrar={onCerrar}>
      <p className="suave" style={{ marginTop: 0 }}>Tildá lo que no se entregó y ajustá la cantidad que faltó.</p>
      {items.map((i) => {
        const tildado = falta[i.producto_id] > 0;
        const medios = i.presentacion.toLowerCase() === 'kg';
        return (
          <div key={i.id} className="fila" style={{ padding: '8px 0', borderBottom: '1px solid var(--borde)', flexWrap: 'nowrap' }}>
            <input type="checkbox" checked={tildado} aria-label={`Faltó ${i.producto_nombre}`}
              onChange={(e) => setFalta((f) => ({ ...f, [i.producto_id]: e.target.checked ? Number(i.cantidad) : 0 }))} />
            <span className="crece">{descripcion(i.producto_nombre, i.presentacion)}<br /><small>Pedido: {cantidadCorta(i.cantidad, i.presentacion)}</small></span>
            {tildado && (
              <input type="number" min={medios ? 0.5 : 1} max={Number(i.cantidad)} step={medios ? 0.5 : 1} value={falta[i.producto_id]}
                style={{ width: 80, textAlign: 'center' }} aria-label={`Cantidad que faltó de ${i.producto_nombre}`}
                onChange={(e) => setFalta((f) => ({ ...f, [i.producto_id]: Math.min(Number(e.target.value) || 0, Number(i.cantidad)) }))} />
            )}
          </div>
        );
      })}
      {error && <div className="aviso error">{error}</div>}
      <button className="primario ancho" style={{ marginTop: 12 }} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Marcar entregado con faltantes'}</button>
    </Modal>
  );
}

export default function Pedidos() {
  const { perfil } = useAuth();
  const esAdmin = perfil.rol === 'admin';
  const [fecha, setFecha, hoy] = useFecha();
  const [pedidos, setPedidos] = useState(null);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloModificados, setSoloModificados] = useState(false);
  const [verCancelados, setVerCancelados] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [faltantesDe, setFaltantesDe] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    setPedidos(null);
    supabase.from('pedidos').select(`${SELECT_DIA}, faltantes!faltantes_pedido_id_fkey(*)`).eq('fecha_entrega', fecha)
      .then(({ data, error }) => {
        if (error) console.error(error);
        setPedidos((data || []).sort((a, b) => nombreCliente(a.cliente).localeCompare(nombreCliente(b.cliente))));
      });
  }, [fecha, recarga]);

  const filtrados = useMemo(() => (pedidos || []).filter((p) =>
    (!filtroCliente || p.cliente_id === filtroCliente)
    && (filtroEstado ? p.estado === filtroEstado : verCancelados || p.estado !== 'cancelado')
    && (!soloModificados || p.modificado)), [pedidos, filtroCliente, filtroEstado, soloModificados, verCancelados]);

  const clientesDelDia = useMemo(() => {
    const m = new Map((pedidos || []).map((p) => [p.cliente_id, p.cliente]));
    return [...m.values()].sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b)));
  }, [pedidos]);

  async function cambiarEstado(p, estado) {
    if (estado === 'entregado_faltantes') return setFaltantesDe(p);
    if (estado === 'cancelado') {
      if (!window.confirm(`¿Cancelar el pedido #${p.id} de ${nombreCliente(p.cliente)}? Se avisa por email.`)) return;
      try {
        await api('pedido', { accion: 'cancelar', cliente_id: p.cliente_id, fecha_entrega: p.fecha_entrega });
        setRecarga((x) => x + 1);
      } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
      return;
    }
    const { error } = await supabase.rpc('marcar_estado', { p_pedido: p.id, p_estado: estado, p_faltantes: [] });
    if (error) setMensaje({ tipo: 'error', texto: errorPed(error) });
    else setRecarga((x) => x + 1);
  }

  async function reenviar(p) {
    setMensaje({ tipo: 'info', texto: `Reenviando pedido #${p.id}…` });
    try {
      const r = await api('reenviar-pedido', { id: p.id });
      setMensaje(r.emails.fabrica ? { tipo: 'ok', texto: `Pedido #${p.id} reenviado.` } : { tipo: 'error', texto: 'No se pudo enviar el email. Revisá la configuración.' });
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
  }

  const activos = (pedidos || []).filter((p) => p.estado !== 'cancelado');
  const entregados = activos.filter((p) => p.estado.startsWith('entregado')).length;
  const estadosPosibles = Object.entries(ESTADOS).filter(([k]) => esAdmin || k !== 'cancelado');

  return (
    <>
      <div className="entre">
        <h1>Pedidos</h1>
        {esAdmin && <Link className="boton primario chico" to={`/admin/cargar-pedido?fecha=${fecha}`}>+ Cargar pedido</Link>}
      </div>

      <BarraFecha fecha={fecha} setFecha={setFecha} hoy={hoy}>
        <p style={{ margin: '8px 0 0' }}>
          {activos.length} {activos.length === 1 ? 'pedido' : 'pedidos'} · {entregados} entregados
        </p>
        <div className="fila" style={{ marginTop: 8 }}>
          <button className="chico" onClick={() => abrirPdf(`resumen?fecha=${fecha}`)}>PDF Pedidos del día</button>
          <button className="chico" onClick={() => abrirPdf(`resumen?fecha=${fecha}&tipo=reparto`)}>PDF Reparto</button>
        </div>
        <div className="grilla">
          <div>
            <label htmlFor="fc">Cliente</label>
            <select id="fc" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
              <option value="">Todos</option>
              {clientesDelDia.map((c) => <option key={c.id} value={c.id}>{nombreCliente(c)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fe">Estado</label>
            <select id="fe" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={soloModificados} onChange={(e) => setSoloModificados(e.target.checked)} /> Solo los modificados después de enviados</label>
        <label className="check"><input type="checkbox" checked={verCancelados} onChange={(e) => setVerCancelados(e.target.checked)} /> Mostrar cancelados</label>
      </BarraFecha>

      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
      {pedidos === null && <div className="cargando">Cargando…</div>}
      {pedidos && !filtrados.length && <p className="suave">No hay pedidos para mostrar.</p>}

      {filtrados.map((p) => {
        const faltan = (p.faltantes || []);
        const itemsPorId = new Map(p.pedido_items.map((i) => [i.producto_id, i]));
        return (
          <div className="tarjeta" key={p.id} style={p.estado === 'cancelado' ? { opacity: 0.6 } : undefined}>
            <div className="entre">
              <div>
                <h3>{nombreCliente(p.cliente)}</h3>
                <small>#{p.id} · {fmtFechaHora(p.updated_at)}{p.cargado_por_admin ? ' · cargado por admin' : ''}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`etiqueta ${p.estado}`}>{ESTADOS[p.estado]}</span>
                {p.modificado && <div><span className="etiqueta modificado">MODIFICADO v{p.version}</span></div>}
              </div>
            </div>
            {(p.cliente.direccion || p.cliente.horario_limite) && (
              <div className="suave" style={{ fontSize: '.9rem' }}>{[p.cliente.direccion, p.cliente.horario_limite].filter(Boolean).join(' · ')}</div>
            )}
            {p.cliente.observaciones_fijas && <div className="aviso alerta" style={{ margin: '6px 0' }}>{p.cliente.observaciones_fijas}</div>}
            <PedidoItems items={ordenarItems(p.pedido_items)} />
            {p.observacion && <p style={{ marginBottom: 0 }}><b>Obs.:</b> {p.observacion}</p>}
            {faltan.length > 0 && (
              <div className="aviso alerta" style={{ marginBottom: 0 }}>
                <b>Faltó:</b> {faltan.map((f) => {
                  const it = itemsPorId.get(f.producto_id);
                  return `${fmtCantidad(f.cantidad, it?.presentacion || '')} ${it?.producto_nombre || ''}${f.estado !== 'abierto' ? ` (${f.estado})` : ''}`;
                }).join(' · ')}
              </div>
            )}
            {p.estado !== 'cancelado' || esAdmin ? (
              <label className="fila" style={{ marginTop: 10, fontWeight: 500 }}>
                Estado:
                <select className="crece" style={{ minHeight: 40, padding: '4px 8px' }} value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value)}>
                  {estadosPosibles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            ) : null}
            <div className="fila" style={{ marginTop: 8 }}>
              <button className="chico" onClick={() => abrirPdf(`pedido-pdf?id=${p.id}`)}>PDF</button>
              {p.estado === 'entregado_faltantes' && <button className="chico" onClick={() => setFaltantesDe(p)}>Editar faltantes</button>}
              {esAdmin && (
                <>
                  <Link className="boton chico" to={`/admin/cargar-pedido?cliente=${p.cliente_id}&fecha=${p.fecha_entrega}`}>Editar</Link>
                  <button className="chico" onClick={() => reenviar(p)}>Reenviar email</button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {faltantesDe && <MarcarFaltantes pedido={faltantesDe} onCerrar={() => setFaltantesDe(null)} onListo={() => { setFaltantesDe(null); setRecarga((x) => x + 1); }} />}
    </>
  );
}
