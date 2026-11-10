// POST /.netlify/functions/pedido  — alta o modificación de un pedido
import { admin, cuerpo, HttpError, json, manejar, usuarioActual } from './_lib/supa.js';
import { notificarPedido } from './_lib/notificar.js';

export default manejar(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido');
  const { user, perfil } = await usuarioActual(req, ['cliente', 'admin']);
  const b = await cuerpo(req);
  const esAdmin = perfil.rol === 'admin';
  const clienteId = esAdmin ? b.cliente_id : perfil.cliente_id;
  if (!clienteId) throw new HttpError(400, 'Falta el cliente.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha_entrega || '')) throw new HttpError(400, 'Fecha de entrega inválida.');
  const items = (b.items || []).map((i) => ({ producto_id: Number(i.producto_id), cantidad: Number(i.cantidad) }));

  const { data, error } = await admin.rpc('guardar_pedido', {
    p_cliente: clienteId, p_fecha: b.fecha_entrega, p_observacion: b.observacion || '',
    p_items: items, p_usuario: user.id, p_es_admin: esAdmin,
  });
  if (error) {
    if (error.message?.startsWith('PED: ')) throw new HttpError(400, error.message.slice(5));
    throw error;
  }

  const envio = await notificarPedido(data.pedido_id, data).catch((e) => { console.error(e); return { fabrica: false, cliente: false }; });
  return json({ ok: true, pedido_id: data.pedido_id, version: data.version, nuevo: data.nuevo, emails: envio });
});
