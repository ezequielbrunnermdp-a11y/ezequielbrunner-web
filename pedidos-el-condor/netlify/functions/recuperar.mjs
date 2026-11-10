// POST /.netlify/functions/recuperar {email} — envía el link para definir una contraseña nueva
import { admin, cuerpo, json, manejar } from './_lib/supa.js';
import { enviarLinkClave } from './_lib/accesos.js';

export default manejar(async (req) => {
  const { email } = await cuerpo(req);
  const limpio = String(email || '').trim().toLowerCase();
  if (limpio) {
    // Solo usuarios activos. Siempre respondemos lo mismo para no revelar qué emails existen.
    const { data: perfil } = await admin.from('perfiles').select('id, activo').eq('email', limpio).maybeSingle();
    if (perfil?.activo) await enviarLinkClave(limpio, 'recuperar').catch((e) => console.error(e));
  }
  return json({ ok: true, mensaje: `Si el email está registrado, te llegará un link para definir tu contraseña. Revisá también la carpeta de spam.` });
});
