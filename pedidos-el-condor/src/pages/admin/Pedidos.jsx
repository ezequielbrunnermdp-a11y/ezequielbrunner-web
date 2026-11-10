import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { abrirPdf, api } from '../../lib/api.js';
import PedidoItems from '../../components/PedidoItems.jsx';
import { ahoraAR, ESTADOS, fmtFechaHora, fmtFechaLarga, nombreCliente, sumarDias } from '../../lib/formato.js';

export default function Pedidos({ soloLectura = false }) {
  const [params, setParams] = useSearchParams();
  const fecha = params.get('fecha') || sumarDias(ahoraAR().fecha, 1);
  const [pedidos, setPedidos] = useState(null);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [soloModificados, setSoloModificados] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    setPedidos(null);
    supabase.from('pedidos').select('*, cliente:clientes(*), pedido_items(*)').eq('fecha_entrega', fecha)
      .order('id', { referencedTable: 'pedido_items' })
      .then(({ data }) => setPedidos((data || []).sort((a, b) => nombreCliente(a.cliente).localeCompare(nombreCliente(b.cliente)))));
  }, [fecha, recarga]);

  const filtrados = useMemo(() => (pedidos || []).filter((p) =>
    (!filtroCliente || p.cliente_id === filtroCliente)
    && (!filtroEstado || p.estado === filtroEstado)
    && (!soloModificados || p.modificado)), [pedidos, filtroCliente, filtroEstado, soloModificados]);

  const clientesDelDia = useMemo(() => {
    const m = new Map((pedidos || []).map((p) => [p.cliente_id, p.cliente]));
    return [...m.values()].sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b)));
  }, [pedidos]);

  async function cambiarEstado(p, estado) {
    const { error } = await supabase.from('pedidos').update({ estado, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) setMensaje({ tipo: 'error', texto: 'No se pudo cambiar el estado.' });
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
  return (
    <>
      <div className="entre">
        <h1>Pedidos</h1>
        {!soloLectura && <Link className="boton primario chico" to={`/admin/cargar-pedido?fecha=${fecha}`}>+ Cargar pedido</Link>}
      </div>

      <div className="tarjeta">
        <div className="fila">
          <button className="chico" onClick={() => setParams({ fecha: sumarDias(fecha, -1) })} aria-label="Día anterior">‹</button>
          <input className="crece" type="date" value={fecha} onChange={(e) => e.target.value && setParams({ fecha: e.target.value })} aria-label="Fecha de entrega" />
          <button className="chico" onClick={() => setParams({ fecha: sumarDias(fecha, 1) })} aria-label="Día siguiente">›</button>
        </div>
        <p style={{ margin: '8px 0 0' }}>Entrega <b>{fmtFechaLarga(fecha)}</b> · {activos.length} {activos.length === 1 ? 'pedido' : 'pedidos'}</p>
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
      </div>

      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
      {pedidos === null && <div className="cargando">Cargando…</div>}
      {pedidos && !filtrados.length && <p className="suave">No hay pedidos para mostrar.</p>}

      {filtrados.map((p) => (
        <div className="tarjeta" key={p.id}>
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
          <PedidoItems items={p.pedido_items} />
          {p.observacion && <p style={{ marginBottom: 0 }}><b>Obs.:</b> {p.observacion}</p>}
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="chico" onClick={() => abrirPdf(`pedido-pdf?id=${p.id}`)}>PDF</button>
            {!soloLectura && (
              <>
                <Link className="boton chico" to={`/admin/cargar-pedido?cliente=${p.cliente_id}&fecha=${p.fecha_entrega}`}>Editar</Link>
                <button className="chico" onClick={() => reenviar(p)}>Reenviar email</button>
              </>
            )}
          </div>
          {!soloLectura && (
            <label className="fila" style={{ marginTop: 8, fontWeight: 500 }}>
              Estado:
              <select className="crece" style={{ minHeight: 36, padding: '4px 8px' }} value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value)}>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
        </div>
      ))}
    </>
  );
}
