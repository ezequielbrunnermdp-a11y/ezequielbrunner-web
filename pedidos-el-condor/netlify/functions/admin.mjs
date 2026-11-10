// POST /.netlify/functions/admin {accion, ...} — acciones del administrador que necesitan permisos especiales
import { admin, cuerpo, HttpError, json, manejar, usuarioActual } from './_lib/supa.js';
import { claveProvisoria, crearAcceso, enviarLinkClave, habilitarUsuario } from './_lib/accesos.js';

const CAMPOS_CLIENTE = ['razon_social', 'nombre_fantasia', 'cuit', 'email', 'telefono', 'direccion', 'horario_limite',
  'dias_cerrado', 'observaciones_fijas', 've_precios', 'restringir_catalogo'];

const usuariosDeCliente = async (clienteId) =>
  (await admin.from('perfiles').select('id, email, activo').eq('cliente_id', clienteId)).data || [];

const acciones = {
  // Alta de cliente + acceso en un paso
  async crear_cliente({ cliente, modo }) {
    const datos = Object.fromEntries(CAMPOS_CLIENTE.filter((k) => k in cliente).map((k) => [k, cliente[k]]));
    if (!datos.razon_social?.trim()) throw new HttpError(400, 'Falta la razón social o el nombre.');
    datos.email = datos.email?.trim().toLowerCase() || null;
    const { data: c, error } = await admin.from('clientes').insert(datos).select().single();
    if (error) throw error;
    if (!datos.email || modo === 'sin_acceso') return { cliente: c };
    try {
      const acceso = await crearAcceso({ email: datos.email, rol: 'cliente', clienteId: c.id, nombre: c.nombre_fantasia || c.razon_social, modo });
      return { cliente: c, ...acceso };
    } catch (e) {
      await admin.from('clientes').delete().eq('id', c.id);
      throw e;
    }
  },

  // Crear acceso para un cliente ya cargado (ej. los de prueba)
  async crear_acceso_cliente({ cliente_id, modo }) {
    const { data: c } = await admin.from('clientes').select('*').eq('id', cliente_id).single();
    if (!c?.email) throw new HttpError(400, 'Primero cargale un email al cliente.');
    if ((await usuariosDeCliente(c.id)).length) throw new HttpError(400, 'Este cliente ya tiene acceso. Usá "Reenviar acceso".');
    return crearAcceso({ email: c.email, rol: 'cliente', clienteId: c.id, nombre: c.nombre_fantasia || c.razon_social, modo });
  },

  // Reenviar link o generar nueva contraseña provisoria
  async reenviar_acceso({ usuario_id, cliente_id, modo }) {
    let u;
    if (usuario_id) u = (await admin.from('perfiles').select('id, email, nombre').eq('id', usuario_id).single()).data;
    else u = (await usuariosDeCliente(cliente_id))[0];
    if (!u) throw new HttpError(404, 'Ese usuario no tiene acceso creado.');
    if (modo === 'provisoria') {
      const clave = claveProvisoria();
      const { error } = await admin.auth.admin.updateUserById(u.id, { password: clave });
      if (error) throw error;
      return { clave_provisoria: clave };
    }
    await enviarLinkClave(u.email, 'invitacion', u.nombre);
    return { email_enviado: true };
  },

  // activo / suspendido / baja
  async estado_cliente({ cliente_id, estado }) {
    if (!['activo', 'suspendido', 'baja'].includes(estado)) throw new HttpError(400, 'Estado inválido.');
    const { error } = await admin.from('clientes').update({ estado }).eq('id', cliente_id);
    if (error) throw error;
    for (const u of await usuariosDeCliente(cliente_id)) await habilitarUsuario(u.id, estado === 'activo');
    return {};
  },

  // Cambia el email de contacto y de ingreso
  async cambiar_email_cliente({ cliente_id, email }) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'El email no es válido.');
    for (const u of await usuariosDeCliente(cliente_id)) {
      const { error } = await admin.auth.admin.updateUserById(u.id, { email, email_confirm: true });
      if (error) throw new HttpError(400, /already|exists|registered/i.test(error.message) ? 'Ese email ya lo usa otro usuario.' : error.message);
      await admin.from('perfiles').update({ email }).eq('id', u.id);
    }
    await admin.from('clientes').update({ email }).eq('id', cliente_id);
    return {};
  },

  // Usuarios internos: admin o fábrica
  async crear_usuario({ email, nombre, rol, modo }) {
    if (!['admin', 'fabrica'].includes(rol)) throw new HttpError(400, 'Rol inválido.');
    return crearAcceso({ email, rol, nombre, modo });
  },

  async estado_usuario({ usuario_id, activo }, yo) {
    if (usuario_id === yo.id) throw new HttpError(400, 'No podés desactivar tu propio usuario.');
    await habilitarUsuario(usuario_id, !!activo);
    return {};
  },
};

export default manejar(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido');
  const { user } = await usuarioActual(req, ['admin']);
  const b = await cuerpo(req);
  const fn = acciones[b.accion];
  if (!fn) throw new HttpError(400, 'Acción desconocida.');
  return json({ ok: true, ...(await fn(b, user)) });
});
