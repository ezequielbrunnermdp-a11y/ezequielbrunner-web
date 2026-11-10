// GET /.netlify/functions/pedido-pdf?id=123 — descarga el PDF de un pedido
import { HttpError, manejar, usuarioActual } from './_lib/supa.js';
import { cargarPedido } from './_lib/notificar.js';
import { pdfPedido } from './_lib/pdf.js';

export default manejar(async (req) => {
  const { perfil } = await usuarioActual(req);
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) throw new HttpError(400, 'Falta el número de pedido.');
  const datos = await cargarPedido(id).catch(() => { throw new HttpError(404, 'Pedido inexistente.'); });
  if (perfil.rol === 'cliente' && datos.pedido.cliente_id !== perfil.cliente_id) throw new HttpError(403, 'No tenés permiso.');
  const pdf = await pdfPedido(datos);
  return new Response(pdf, {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="pedido-${id}.pdf"` },
  });
});
