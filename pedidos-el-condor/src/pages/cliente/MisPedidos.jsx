import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../auth.jsx';
import PedidoItems from '../../components/PedidoItems.jsx';
import { ESTADOS, fmtCantidad, fmtFechaHora, fmtFechaLarga, fmtMoneda, pedidoAbierto } from '../../lib/formato.js';

export default function MisPedidos() {
  const { cliente } = useAuth();
  const [pedidos, setPedidos] = useState(null);
  const [horaCorte, setHoraCorte] = useState('20:00:00');
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    supabase.from('config').select('hora_corte').eq('id', 1).single().then(({ data }) => data && setHoraCorte(data.hora_corte));
    supabase.from('pedidos').select('*, pedido_items(*), faltantes!faltantes_pedido_id_fkey(*)').order('fecha_entrega', { ascending: false }).order('id', { referencedTable: 'pedido_items' }).limit(60)
      .then(({ data }) => setPedidos(data || []));
  }, []);

  if (!pedidos) return <div className="cargando">Cargando…</div>;
  return (
    <>
      <h1>Mis pedidos</h1>
      {!pedidos.length && <div className="tarjeta">Todavía no hiciste pedidos. <Link to="/pedido">Hacer el primero</Link></div>}
      {pedidos.map((p) => {
        const editable = p.estado === 'recibido' && pedidoAbierto(p.fecha_entrega, horaCorte);
        return (
          <div className="tarjeta" key={p.id}>
            <button className="ancho" style={{ border: 0, padding: 0, minHeight: 0, justifyContent: 'space-between', textAlign: 'left' }}
              onClick={() => setAbierto(abierto === p.id ? null : p.id)} aria-expanded={abierto === p.id}>
              <span>
                <b>{fmtFechaLarga(p.fecha_entrega)}</b><br />
                <small>Pedido #{p.id} · {p.pedido_items.length} productos</small>
              </span>
              <span className={`etiqueta ${p.estado}`}>{ESTADOS[p.estado]}</span>
            </button>
            {abierto === p.id && (
              <>
                <PedidoItems items={p.pedido_items} />
                {p.observacion && <p><b>Observación:</b> {p.observacion}</p>}
                {p.faltantes?.length > 0 && (
                  <div className="aviso alerta">
                    <b>No se entregó:</b> {p.faltantes.map((f) => {
                      const it = p.pedido_items.find((i) => i.producto_id === f.producto_id);
                      return `${fmtCantidad(f.cantidad, it?.presentacion || '')} ${it?.producto_nombre || ''}${f.estado === 'reprogramado' ? ' (se agregó a un próximo pedido)' : ''}`;
                    }).join(' · ')}
                  </div>
                )}
                {cliente?.ve_precios && <p style={{ textAlign: 'right' }}>Total: <b>{fmtMoneda(p.total_sin_iva)}</b> <small>+ IVA</small></p>}
                <p className="suave" style={{ fontSize: '.85rem' }}>Última actualización: {fmtFechaHora(p.updated_at)}</p>
              </>
            )}
            {editable && <Link className="boton chico" style={{ marginTop: 8 }} to={`/pedido?fecha=${p.fecha_entrega}`}>Modificar o agregar</Link>}
          </div>
        );
      })}
    </>
  );
}
