import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { abrirPdf, api } from '../../lib/api.js';
import { useAuth } from '../../auth.jsx';
import BarraFecha, { useFecha } from '../../components/BarraFecha.jsx';
import { SELECT_DIA, totalesProduccion } from '../../lib/resumen.js';
import { fmtCantidad, fmtFechaHora } from '../../lib/formato.js';

export default function Produccion() {
  const { perfil } = useAuth();
  const [fecha, setFecha, hoy] = useFecha();
  const [pedidos, setPedidos] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    setPedidos(null);
    supabase.from('pedidos').select(SELECT_DIA).eq('fecha_entrega', fecha).neq('estado', 'cancelado').then(({ data }) => setPedidos(data || []));
    supabase.from('resumenes_enviados').select('*').eq('fecha_entrega', fecha).maybeSingle().then(({ data }) => setResumen(data));
  }, [fecha, recarga]);

  async function enviar() {
    if (resumen && !window.confirm('El resumen de este día ya se envió. ¿Reenviarlo con los datos actuales?')) return;
    setEnviando(true); setMensaje(null);
    try {
      const r = await api('resumen', { fecha });
      setMensaje({ tipo: 'ok', texto: `Resumen enviado (${r.pedidos} pedidos).` });
      setRecarga((x) => x + 1);
    } catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
    setEnviando(false);
  }

  const totales = totalesProduccion(pedidos || []);
  const porCategoria = [];
  totales.forEach((t) => {
    let g = porCategoria.find((x) => x.nombre === t.categoria);
    if (!g) porCategoria.push((g = { nombre: t.categoria, items: [] }));
    g.items.push(t);
  });

  return (
    <>
      <h1>Totales para producción</h1>
      <BarraFecha fecha={fecha} setFecha={setFecha} hoy={hoy}>
        <p style={{ margin: '8px 0 0' }}>{pedidos ? `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}` : '…'}
          {resumen && <span className="suave"> · resumen enviado {fmtFechaHora(resumen.enviado_at)}{resumen.manual ? ' (manual)' : ''}</span>}
        </p>
        <div className="fila" style={{ marginTop: 8 }}>
          <button className="chico" onClick={() => abrirPdf(`resumen?fecha=${fecha}`)}>PDF Pedidos del día</button>
          {perfil.rol === 'admin' && <button className="chico" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : resumen ? 'Reenviar por email' : 'Enviar por email ahora'}</button>}
        </div>
      </BarraFecha>
      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
      {pedidos === null && <div className="cargando">Cargando…</div>}
      {pedidos && !totales.length && <p className="suave">No hay pedidos para esta fecha.</p>}
      {porCategoria.map((g) => (
        <div className="tarjeta" key={g.nombre}>
          <h3 style={{ marginBottom: 6 }}>{g.nombre}</h3>
          <table className="tabla">
            <tbody>
              {g.items.map((t) => (
                <tr key={t.producto_id}>
                  <td>{t.producto_nombre}{!['kg', 'unidad'].includes(t.presentacion.toLowerCase()) && <small> · {t.presentacion}</small>}</td>
                  <td className="derecha" style={{ whiteSpace: 'nowrap' }}><b>{fmtCantidad(t.cantidad, t.presentacion).replace(` × ${t.presentacion}`, '')}</b><br /><small>{t.clientes} {t.clientes === 1 ? 'cliente' : 'clientes'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
