import fs from "node:fs";
import path from "node:path";

/**
 * Capa mínima de acceso a Postgres.
 * - Con DATABASE_URL usa `pg` (Postgres / Supabase).
 * - Sin DATABASE_URL usa PGlite (Postgres embebido) en ./.data para desarrollo.
 * Ambas implementan el mismo SQL, así las pruebas corren contra Postgres real.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

async function createPgDb(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    max: 10,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
  });
  return {
    query: async (sql, params) => {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn({
          query: async (sql, params) => ({ rows: (await client.query(sql, params as unknown[])).rows }),
        });
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
    close: () => pool.end(),
  };
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  // PGlite es de una sola conexión: serializamos transacciones para evitar intercalado.
  let chain: Promise<unknown> = Promise.resolve();
  const wrap = (q: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    query: async <T,>(sql: string, params?: unknown[]) => ({ rows: (await q.query(sql, params)).rows as T[] }),
  });
  return {
    query: async (sql, params) => {
      await chain.catch(() => undefined);
      return wrap(pg).query(sql, params);
    },
    tx: (fn) => {
      const run = chain.catch(() => undefined).then(() => pg.transaction((t) => fn(wrap(t))));
      chain = run;
      return run;
    },
    exec: async (sql) => {
      await pg.exec(sql);
    },
    close: () => pg.close(),
  };
}

export async function migrate(db: Db): Promise<void> {
  // Misma carpeta que Netlify Database aplica automáticamente al publicar.
  const dir = path.join(process.cwd(), "netlify/database/migrations");
  await db.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const done = await db.query(`select 1 from schema_migrations where name = $1`, [f]);
    if (done.rows.length) continue;
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    await db.query(`insert into schema_migrations (name) values ($1)`, [f]);
  }
}

const g = globalThis as unknown as { __nexoDb?: Promise<Db> };

/** Conexión compartida del proceso (migraciones aplicadas al iniciar). */
export function getDb(): Promise<Db> {
  if (!g.__nexoDb) {
    g.__nexoDb = (async () => {
      // 1) DATABASE_URL explícita (Postgres/Supabase): migraciones al iniciar.
      if (process.env.DATABASE_URL) {
        const db = await createPgDb(process.env.DATABASE_URL);
        await migrate(db);
        return db;
      }
      // 2) Netlify Database: Netlify aplica las migraciones en cada deploy.
      if (process.env.NETLIFY_DB_URL || process.env.NETLIFY) {
        const { getConnectionString } = await import("@netlify/database");
        return createPgDb(process.env.NETLIFY_DB_URL || getConnectionString());
      }
      // 3) Desarrollo local: Postgres embebido en ./.data.
      if (process.env.NODE_ENV === "production" && !process.env.NEXO_ALLOW_EMBEDDED_DB) {
        throw new Error("Falta DATABASE_URL: en producción se requiere una base Postgres persistente.");
      }
      const db = await createPgliteDb(path.join(process.cwd(), ".data/pglite"));
      await migrate(db);
      return db;
    })();
  }
  return g.__nexoDb;
}
