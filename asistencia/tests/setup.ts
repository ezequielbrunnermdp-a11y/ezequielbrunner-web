import { beforeAll, afterAll } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://asis:asis@localhost:5432/asistencia_test";
process.env.QR_SIGNING_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.EMAIL_PROVIDER = "log";

let ready: Promise<void> | null = null;
export function resetDb() {
  ready ??= (async () => {
    const { pool } = await import("@/lib/db");
    await pool().query(`drop schema public cascade; create schema public;`);
    const { migrate } = await import("../scripts/migrate");
    await migrate(false);
  })();
  return ready;
}

beforeAll(async () => { await resetDb(); });
afterAll(async () => {
  const { pool } = await import("@/lib/db");
  await pool().end();
  globalThis.__pgPool = undefined;
});
