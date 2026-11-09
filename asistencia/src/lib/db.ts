import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está configurada");
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

export function pool(): Pool {
  if (!globalThis.__pgPool) globalThis.__pgPool = createPool();
  return globalThis.__pgPool;
}

export type Db = Pick<PoolClient, "query">;

export async function q<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], db: Db = pool()): Promise<T[]> {
  const r = await db.query<T>(sql, params as any[]);
  return r.rows;
}

export async function one<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], db: Db = pool()): Promise<T | null> {
  const rows = await q<T>(sql, params, db);
  return rows[0] ?? null;
}

/** Ejecuta fn dentro de una transacción serializable a nivel de fila (READ COMMITTED + locks explícitos). */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
