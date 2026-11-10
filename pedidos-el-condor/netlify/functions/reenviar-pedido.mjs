// POST /.netlify/functions/reenviar-pedido {id} — el admin reenvía los emails de un pedido
import { cuerpo, HttpError, json, manejar, usuarioActual } from './_lib/supa.js';
import { notificarPedido } from './_lib/notificar.js';

export default manejar(async (req) => {
  await usuarioActual(req, ['admin']);
  const { id } = await cuerpo(req);
  if (!id) throw new HttpError(400, 'Falta el pedido.');
  const envio = await notificarPedido(Number(id), { reactivado: true });
  return json({ ok: true, emails: envio });
});
