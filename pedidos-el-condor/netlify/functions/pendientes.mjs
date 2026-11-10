// POST /.netlify/functions/pendientes {faltante_id, fecha} — pasa un faltante al pedido de otro día (admin)
import { admin, cuerpo, HttpError, json, manejar, usuarioActual } from './_lib/supa.js';
import { notificarPedido } from './_lib/notificar.js';

export default manejar(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido');
  const { user } = await usuarioActual(req, ['admin']);
  const { faltante_id, fecha } = await cuerpo(req);
  if (!faltante_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) throw new HttpError(400, 'Datos incompletos.');
  const { data, error } = await admin.rpc('reprogramar_faltante', { p_faltante: faltante_id, p_fecha: fecha, p_usuario: user.id });
  if (error) {
    if (error.message?.startsWith('PED: ')) throw new HttpError(400, error.message.slice(5));
    throw error;
  }
  const envio = await notificarPedido(data.pedido_id, data).catch((e) => { console.error(e); return {}; });
  return json({ ok: true, pedido_id: data.pedido_id, emails: envio });
});
