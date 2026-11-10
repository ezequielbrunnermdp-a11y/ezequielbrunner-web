import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { ahoraAR, fmtCantidad, fmtFechaCorta, nombreCliente, sumarDias } from '../../lib/formato.js';

export default function Pendientes() {
  const [faltantes, setFaltantes] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [fechas, setFechas] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [trabajando, setTrabajando] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const manana = sumarDias(ahoraAR().fecha, 1);
  const SEL = '*, producto:productos(nombre, presentacion), pedido:pedidos!faltantes_pedido_id_fkey(id, fecha_entrega, cliente:clientes(*)), destino:pedidos!faltantes_pedido_destino_id_fkey(id, fecha_entrega)';

  useEffect(() => {
    supabase.from('faltantes').select(SEL).eq('estado', 'abierto').order('created_at').then(({ data }) => setFaltantes(data || []));
    supabase.from('faltantes').select(SEL).neq('estado', 'abierto').order('created_at', { ascending: false }).limit(15).then(({ data }) => setRecientes(data || []));
  }, [recarga]);

  const destino = (f) => fechas[f.id] || (f.pedido.fecha_entrega >= manana ? sumarDias(f.pedido.fecha_entrega, 1) : manana);

  async function pasar(f) {
    setTrabajando(f.id); setMensaje(null);
    try {
      const r = await api('pendientes', { faltante_id: f.id, fecha: destino(f) });
      setMensaje({ tipo: 'ok', texto: `Agregado al pedido #${r.pedido_id} del ${fmtFechaCorta(destino(f))} de ${nombreCliente(f.pedido.cliente)}.` });
      setRecarga((x) => x + 1);
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
    setTrabajando(null);
  }

  async function cerrar(f) {
    const nota = window.prompt('¿Por qué se cierra sin reponer? (opcional)', '');
    if (nota === null) return;
    await supabase.from('faltantes').update({ estado: 'cerrado', nota: nota || null }).eq('id', f.id);
    setRecarga((x) => x + 1);
  }

  return (
    <>
      <h1>Pendientes (faltantes)</h1>
      <p className="suave" style={{ marginTop: 0 }}>Lo que la fábrica marcó como no entregado. Pasalo a otro día con un clic o cerralo si no se repone.</p>
      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
      {faltantes === null && <div className="cargando">Cargando…</div>}
      {faltantes && !faltantes.length && <div className="aviso ok">No hay faltantes pendientes.</div>}
      {faltantes?.map((f) => (
        <div className="tarjeta" key={f.id}>
          <div className="entre">
            <div>
              <h3>{nombreCliente(f.pedido.cliente)}</h3>
              <div><b>{fmtCantidad(f.cantidad, f.producto.presentacion)}</b> {f.producto.nombre}</div>
              <small>Faltó en el pedido #{f.pedido.id} del {fmtFechaCorta(f.pedido.fecha_entrega)}</small>
            </div>
          </div>
          <div className="fila" style={{ marginTop: 8 }}>
            <input type="date" value={destino(f)} min={ahoraAR().fecha} onChange={(e) => setFechas((x) => ({ ...x, [f.id]: e.target.value }))} style={{ width: 170 }} aria-label="Pasar a la fecha" />
            <button className="primario chico" disabled={trabajando === f.id} onClick={() => pasar(f)}>
              {trabajando === f.id ? 'Pasando…' : `Pasar al ${fmtFechaCorta(destino(f))}`}
            </button>
            <button className="chico" onClick={() => cerrar(f)}>Cerrar</button>
          </div>
        </div>
      ))}
      {recientes.length > 0 && (
        <>
          <h2>Resueltos recientemente</h2>
          {recientes.map((f) => (
            <div className="tarjeta" key={f.id} style={{ opacity: 0.8 }}>
              <b>{nombreCliente(f.pedido.cliente)}</b> · {fmtCantidad(f.cantidad, f.producto.presentacion)} {f.producto.nombre}<br />
              <small>
                Del pedido #{f.pedido.id} ({fmtFechaCorta(f.pedido.fecha_entrega)}) →{' '}
                {f.estado === 'reprogramado' ? <>pasado al <Link to={`/admin/pedidos?fecha=${f.destino?.fecha_entrega}`}>pedido #{f.pedido_destino_id} ({fmtFechaCorta(f.destino?.fecha_entrega)})</Link></> : `cerrado${f.nota ? `: ${f.nota}` : ''}`}
              </small>
            </div>
          ))}
        </>
      )}
    </>
  );
}
