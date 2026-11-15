import "server-only";
import pg from "pg";
import { env } from "./env";

const globalForPg = globalThis as unknown as { __jurisPool?: pg.Pool };

/** Pool creado al primer uso (permite importar módulos sin base configurada, p. ej. en tests). */
export function getPool(): pg.Pool {
  if (!globalForPg.__jurisPool) globalForPg.__jurisPool = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });
  return globalForPg.__jurisPool;
}

// Las fechas (tipo date) se devuelven como texto ISO, sin conversión de zona horaria.
pg.types.setTypeParser(1082, (v: string) => v);

export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
