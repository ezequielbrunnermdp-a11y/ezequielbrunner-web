import "./env";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";

export async function migrate(log = true) {
  const p = pool();
  await p.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(__dirname, "..", "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await p.query(`select name from schema_migrations`)).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const client = await p.connect();
    try {
      await client.query("begin");
      await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
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
