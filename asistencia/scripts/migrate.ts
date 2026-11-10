import "./env";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";

export async function migrate(log = true) {
  const p = pool();
  await p.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  // Mismo directorio y formato que aplica Netlify en cada deploy: <número>_<nombre>.sql o <número>_<nombre>/migration.sql
  const dir = path.join(__dirname, "..", "netlify", "database", "migrations");
  const files = fs.readdirSync(dir).sort().filter((f) => f.endsWith(".sql") || fs.existsSync(path.join(dir, f, "migration.sql")));
  const done = new Set((await p.query(`select name from schema_migrations`)).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const client = await p.connect();
    try {
      await client.query("begin");
      await client.query(fs.readFileSync(f.endsWith(".sql") ? path.join(dir, f) : path.join(dir, f, "migration.sql"), "utf8"));
      await client.query(`insert into schema_migrations (name) values ($1)`, [f]);
      await client.query("commit");
      if (log) console.log(`✔ ${f}`);
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  migrate().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
}
