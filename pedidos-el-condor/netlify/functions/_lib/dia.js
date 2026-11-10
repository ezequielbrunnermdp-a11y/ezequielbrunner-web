import { admin } from './supa.js';
import { enviarEmail, emailsPedidos, esc, plantilla } from './email.js';
import { pdfPedidosDelDia } from './pdf.js';
import { SELECT_DIA, totalesProduccion } from '../../../src/lib/resumen.js';
import { fmtCantidad, fmtFechaCorta, fmtFechaLarga, descripcion } from '../../../src/lib/formato.js';

export async function cargarDia(fecha) {
  const { data, error } = await admin.from('pedidos').select(SELECT_DIA).eq('fecha_entrega', fecha);
  if (error) throw error;
  return data || [];
}

// Destino del resumen: EMAILS_FABRICA si está cargada; si no, EMAILS_PEDIDOS
export const emailsResumen = () => {
  const f = (process.env.EMAILS_FABRICA || '').split(',').map((s) => s.trim()).filter(Boolean);
  return f.length ? f : emailsPedidos();
};

export async function enviarResumen(fecha, { reenvio = false } = {}) {
  const pedidos = await cargarDia(fecha);
  const activos = pedidos.filter((p) => p.estado !== 'cancelado');
  const pdf = await pdfPedidosDelDia({ fecha, pedidos });
  const totales = totalesProduccion(activos);
  const html = plantilla(`Pedidos del día · ${fmtFechaLarga(fecha)}`, `
    ${reenvio ? '<div style="background:#fff4d6;padding:8px;border-radius:6px;margin-bottom:10px"><b>REENVÍO</b> — reemplaza al resumen anterior.</div>' : ''}
    <p><b>${activos.length}</b> pedidos. El PDF para imprimir va adjunto.</p>
    ${totales.length ? `<h2 style="font-size:16px;margin:16px 0 6px">Totales para producción</h2>
    <table style="border-collapse:collapse;width:100%;font-size:15px">${totales.map((t) => `<tr>
      <td style="padding:5px 6px;border-bottom:1px solid #eee">${esc(descripcion(t.producto_nombre, t.presentacion))}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap"><b>${esc(fmtCantidad(t.cantidad, t.presentacion).replace(` × ${t.presentacion}`, ''))}</b></td></tr>`).join('')}
    </table>` : ''}`);
  await enviarEmail({
    to: emailsResumen(),
    subject: `${reenvio ? 'REENVÍO – ' : ''}Pedidos del día – entrega ${fmtFechaCorta(fecha)} – ${activos.length} pedidos`,
    html,
    attachments: [{ filename: `pedidos-del-dia-${fecha}.pdf`, content: pdf }],
  });
  return { pedidos: activos.length };
}
