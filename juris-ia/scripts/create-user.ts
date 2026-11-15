import pg from "pg";
import { hashPassword } from "../src/lib/crypto";

/** Uso: npm run user:create -- email@dominio "Nombre" [admin|abogado]  (la contraseña se lee de JURIS_PASSWORD o stdin) */
const [email, name, role = "abogado"] = process.argv.slice(2);
if (!email || !name) {
  console.error('Uso: npm run user:create -- email@dominio "Nombre Apellido" [admin|abogado]');
  process.exit(1);
}
let password = process.env.JURIS_PASSWORD ?? "";
if (!password) {
  process.stdout.write("Contraseña (mín. 12 caracteres): ");
  password = await new Promise<string>((res) => process.stdin.once("data", (d) => res(d.toString().trim())));
}
if (password.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(
  `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
  [email.toLowerCase(), name, hashPassword(password), role],
);
await client.end();
console.log(`Usuario ${email} listo (${role}).`);
process.exit(0);
