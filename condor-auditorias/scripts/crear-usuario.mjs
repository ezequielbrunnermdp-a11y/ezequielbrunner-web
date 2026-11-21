// Crea un usuario (por defecto, el ADMINISTRADOR INICIAL) usando la clave de servicio.
// Ejecutar SOLO en una computadora de confianza; la clave de servicio nunca va al navegador ni al repositorio.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/crear-usuario.mjs --email admin@empresa.com --nombre "Nombre Apellido" [--rol admin] [--password "..."] [--sucursales "San Luis,Colón"]
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Defina SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
if (!args.email || !args.nombre) { console.error('Uso: --email correo --nombre "Nombre" [--rol admin|auditor|franquiciado] [--password ...] [--sucursales "A,B"]'); process.exit(1); }
const role = args.rol ?? 'admin';
if (!['admin', 'auditor', 'franquiciado'].includes(role)) { console.error('Rol inválido'); process.exit(1); }
const password = args.password ?? randomBytes(9).toString('base64url') + 'A1';

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({
  email: args.email, password, email_confirm: true,
  app_metadata: { role, active: true, full_name: args.nombre }, user_metadata: { full_name: args.nombre },
});
if (error) { console.error('Error:', error.message); process.exit(1); }
const id = data.user.id;
const { error: pe } = await sb.from('profiles').upsert({ id, email: args.email, full_name: args.nombre, role, active: true });
if (pe) { console.error('Error al crear el perfil:', pe.message); process.exit(1); }
if (args.sucursales) {
  const names = args.sucursales.split(',').map((s) => s.trim());
  const { data: bs } = await sb.from('branches').select('id, name').in('name', names);
  if (bs?.length) await sb.from('user_branches').insert(bs.map((b) => ({ user_id: id, branch_id: b.id })));
  console.log('Sucursales asignadas:', (bs ?? []).map((b) => b.name).join(', ') || 'ninguna encontrada');
}
console.log(`Usuario creado: ${args.email} (${role})`);
if (!args.password) console.log(`Contraseña inicial generada: ${password}\nCámbiela al ingresar con "¿Olvidó su contraseña?".`);
