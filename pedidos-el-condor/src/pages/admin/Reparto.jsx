import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { abrirPdf } from '../../lib/api.js';
import BarraFecha, { useFecha } from '../../components/BarraFecha.jsx';
import { ordenReparto, SELECT_DIA } from '../../lib/resumen.js';
import { ESTADOS, nombreCliente } from '../../lib/formato.js';

export default function Reparto() {
  const [fecha, setFecha, hoy] = useFecha();
  const [pedidos, setPedidos] = useState(null);

  useEffect(() => {
    setPedidos(null);
    supabase.from('pedidos').select(SELECT_DIA).eq('fecha_entrega', fecha).then(({ data }) => setPedidos(ordenReparto(data || [])));
  }, [fecha]);

  return (
    <>
      <h1>Hoja de reparto</h1>
      <BarraFecha fecha={fecha} setFecha={setFecha} hoy={hoy}>
        <div className="fila" style={{ marginTop: 8 }}>
          <button className="chico" onClick={() => abrirPdf(`resumen?fecha=${fecha}&tipo=reparto`)}>PDF para imprimir</button>
          <span className="suave">Ordenada por horario límite</span>
        </div>
      </BarraFecha>
      {pedidos === null && <div className="cargando">Cargando…</div>}
      {pedidos && !pedidos.length && <p className="suave">No hay entregas para esta fecha.</p>}
      {pedidos?.map((p, n) => (
        <div className="tarjeta" key={p.id}>
          <div className="entre">
            <div>
              <h3>{n + 1}. {nombreCliente(p.cliente)}</h3>
              <div>{p.cliente.direccion || <span className="suave">sin dirección</span>}</div>
              {p.cliente.telefono && <a href={`tel:${p.cliente.telefono.replace(/[^\d+]/g, '')}`}>{p.cliente.telefono}</a>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <b>{p.cliente.horario_limite || '—'}</b><br />
              <span className={`etiqueta ${p.estado}`}>{ESTADOS[p.estado]}</span>
            </div>
          </div>
          {(p.cliente.observaciones_fijas || p.observacion) && (
            <div className="aviso alerta" style={{ margin: '8px 0 0' }}>{[p.cliente.observaciones_fijas, p.observacion].filter(Boolean).join(' · ')}</div>
          )}
          <small>Pedido #{p.id} · {p.pedido_items.length} ítems</small>
        </div>
      ))}
    </>
  );
}
