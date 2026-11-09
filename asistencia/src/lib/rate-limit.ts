import { one, type Db, pool } from "./db";

/** Ventana fija almacenada en Postgres (funciona con varias instancias del servidor). */
export async function hit(key: string, limit: number, windowSec: number, db: Db = pool()): Promise<{ allowed: boolean; count: number }> {
  const row = await one<{ count: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning count`,
    [key, windowSec],
    db,
  );
  const count = row?.count ?? 1;
  return { allowed: count <= limit, count };
}
