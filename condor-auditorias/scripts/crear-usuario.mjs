// Crea un usuario directamente en la base de datos (uso local o de mantenimiento).
// En producción el administrador inicial se crea con la variable INITIAL_ADMIN (ver DESPLIEGUE.md)
// y el resto de los usuarios desde Administración → Usuarios.
//
//   DATABASE_URL=postgres://... node scripts/crear-usuario.mjs --email admin@empresa.com --nombre "Nombre" \
//     [--rol admin|auditor|franquiciado] [--password "..."] [--sucursales "San Luis,Colón"]
import pg from 'pg';
import { randomBytes } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL.'); process.exit(1); }
if (!args.email || !args.nombre) { console.error('Uso: --email correo --nombre "Nombre" [--rol ...] [--password ...] [--sucursales "A,B"]'); process.exit(1); }
const role = args.rol ?? 'admin';
if (!['admin', 'auditor', 'franquiciado'].includes(role)) { console.error('Rol inválido'); process.exit(1); }
const password = args.password ?? randomBytes(9).toString('base64url') + 'A1';
if (password.length < 10) { console.error('La contraseña debe tener al menos 10 caracteres'); process.exit(1); }

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const email = args.email.trim().toLowerCase();
  const meta = { role, active: true, full_name: args.nombre };
  const { rows } = await db.query(
    `insert into auth.users (email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
     values ($1, crypt($2, gen_salt('bf', 10)), $3, $4) returning id`,
    [email, password, JSON.stringify(meta), JSON.stringify({ full_name: args.nombre })]);
  const id = rows[0].id;
  await db.query(`insert into public.profiles (id, email, full_name, role, active) values ($1, $2, $3, $4, true)
    on conflict (id) do update set role = excluded.role, active = true, full_name = excluded.full_name`, [id, email, args.nombre, role]);
  if (args.sucursales) {
    const names = args.sucursales.split(',').map((s) => s.trim());
    const r = await db.query('insert into public.user_branches (user_id, branch_id) select $1, id from public.branches where name = any($2) returning branch_id', [id, names]);
    console.log(`Sucursales asignadas: ${r.rowCount}`);
  }
  console.log(`Usuario creado: ${email} (${role})`);
  if (!args.password) console.log(`Contraseña inicial: ${password}`);
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
