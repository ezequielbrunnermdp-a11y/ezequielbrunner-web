/** Uso: npm run admin:create -- correo@dominio.com "Nombre Apellido" 'ContraseñaSegura123' */
import "./env";
import { pool } from "../src/lib/db";
import { hashSecret, passwordProblems } from "../src/lib/password";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) throw new Error('Uso: npm run admin:create -- correo "Nombre" contraseña');
  const prob = passwordProblems(password);
  if (prob) throw new Error(prob);
  await pool().query(
    `insert into users (email, password_hash, role, full_name) values ($1,$2,'superadmin',$3)
     on conflict (email) do update set password_hash = excluded.password_hash, role = 'superadmin', active = true`,
    [email.toLowerCase(), await hashSecret(password), name],
  );
  console.log(`✔ Administrador general ${email} listo.`);
}
main().then(() => pool().end()).catch((e) => { console.error(e.message); process.exit(1); });
