// GET  /.netlify/functions/resumen?fecha=YYYY-MM-DD&tipo=pedidos|reparto → PDF (admin y fábrica)
// POST /.netlify/functions/resumen {fecha} → reenvía el email "Pedidos del día" (admin)
import { admin, cuerpo, HttpError, json, manejar, usuarioActual } from './_lib/supa.js';
import { cargarDia, enviarResumen } from './_lib/dia.js';
import { pdfPedidosDelDia, pdfReparto } from './_lib/pdf.js';

const fechaValida = (f) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) throw new HttpError(400, 'Fecha inválida.'); return f; };

export default manejar(async (req) => {
  if (req.method === 'POST') {
    await usuarioActual(req, ['admin']);
    const fecha = fechaValida((await cuerpo(req)).fecha);
    const yaEnviado = (await admin.from('resumenes_enviados').select('fecha_entrega').eq('fecha_entrega', fecha).maybeSingle()).data;
    const r = await enviarResumen(fecha, { reenvio: !!yaEnviado });
    await admin.from('resumenes_enviados').upsert({ fecha_entrega: fecha, enviado_at: new Date().toISOString(), manual: true });
    return json({ ok: true, ...r });
  }
  await usuarioActual(req, ['admin', 'fabrica']);
  const url = new URL(req.url);
  const fecha = fechaValida(url.searchParams.get('fecha'));
  const tipo = url.searchParams.get('tipo') === 'reparto' ? 'reparto' : 'pedidos';
  const pedidos = await cargarDia(fecha);
  const pdf = tipo === 'reparto' ? await pdfReparto({ fecha, pedidos }) : await pdfPedidosDelDia({ fecha, pedidos });
  return new Response(pdf, {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${tipo === 'reparto' ? 'reparto' : 'pedidos-del-dia'}-${fecha}.pdf"` },
  });
});
