import crypto from 'node:crypto';
import { admin, appUrl, HttpError } from './supa.js';
import { enviarEmail, esc, plantilla } from './email.js';

export function claveProvisoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const nums = '23456789';
  const r = (s, n) => Array.from(crypto.randomBytes(n), (b) => s[b % s.length]).join('');
  return `Condor-${r(letras, 4)}${r(nums, 4)}`;
}

// Envía un link de Supabase para que el usuario defina su contraseña.
// tipo: 'invitacion' (usuario nuevo) o 'recuperar'
export async function enviarLinkClave(email, tipo, nombre = '') {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery', email, options: { redirectTo: `${appUrl()}/definir-clave` },
  });
  if (error) throw error;
  const link = data.properties.action_link;
  const esInv = tipo === 'invitacion';
  const html = plantilla(esInv ? 'Te damos la bienvenida a los pedidos online' : 'Definí tu contraseña', `
    ${nombre ? `<p>Hola ${esc(nombre)}:</p>` : ''}
    <p>${esInv ? 'Ya tenés tu cuenta para hacer los pedidos mayoristas de El Cóndor desde el celular.' : 'Pediste cambiar tu contraseña.'}
    Tocá el botón para definir tu contraseña:</p>
    <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#5a2e1a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Definir mi contraseña</a></p>
    <p>Tu usuario es: <b>${esc(email)}</b></p>
    <p style="color:#777;font-size:13px">El link vence en 24 horas. Si venció, pedí uno nuevo desde "Olvidé mi contraseña" en ${esc(appUrl())}.</p>`);
  await enviarEmail({ to: email, subject: esInv ? 'Tu acceso a los pedidos de El Cóndor' : 'Cambiá tu contraseña – El Cóndor', html });
}

/**
 * Crea un usuario de acceso con su perfil.
 * modo: 'invitacion' (manda link por email) o 'provisoria' (devuelve una contraseña para pasarle al usuario)
 */
export async function crearAcceso({ email, rol, clienteId = null, nombre = '', modo = 'invitacion' }) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'El email no es válido.');
  const clave = modo === 'provisoria' ? claveProvisoria() : crypto.randomBytes(24).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true, user_metadata: { nombre } });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new HttpError(400, 'Ya existe un usuario con ese email.');
    throw error;
  }
  const { error: e2 } = await admin.from('perfiles').insert({ id: data.user.id, rol, cliente_id: clienteId, nombre, email });
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); throw e2; }

  let emailEnviado = false;
  if (modo === 'invitacion') {
    try { await enviarLinkClave(email, 'invitacion', nombre); emailEnviado = true; } catch (e) { console.error(e); }
  }
  return { usuario_id: data.user.id, clave_provisoria: modo === 'provisoria' ? clave : null, email_enviado: emailEnviado };
}

// Bloquea o habilita el ingreso de un usuario
export async function habilitarUsuario(usuarioId, activo) {
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { ban_duration: activo ? 'none' : '876000h' });
  if (error) throw error;
  await admin.from('perfiles').update({ activo }).eq('id', usuarioId);
}
