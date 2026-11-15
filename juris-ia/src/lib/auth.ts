import "server-only";
import { cookies, headers } from "next/headers";
import { one, query } from "./db";
import { randomToken, sha256, verifyPassword } from "./crypto";
import { env } from "./env";

export const SESSION_COOKIE = "juris_session";
const SESSION_DAYS = 7;

export type User = { id: string; email: string; name: string; role: "admin" | "abogado" };

import { HttpError } from "./errors";
export { HttpError };

export async function login(email: string, password: string): Promise<User | null> {
  const row = await one<User & { password_hash: string }>(
    "SELECT id, email, name, role, password_hash FROM users WHERE lower(email) = lower($1)",
    [email],
  );
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  const token = randomToken();
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [sha256(token), row.id],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<User>(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "No autenticado");
  return u;
}

/** Verifica acceso a una causa. Las causas reservadas solo son visibles para propietario y miembros. */
export async function requireCaseAccess(
  user: User,
  caseId: string,
  need: "lectura" | "edicion" = "lectura",
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) throw new HttpError(404, "Causa inexistente");
  const row = await one<{ owner_id: string; permiso: string | null }>(
    `SELECT c.owner_id, m.permiso FROM cases c
     LEFT JOIN case_members m ON m.case_id = c.id AND m.user_id = $2
     WHERE c.id = $1`,
    [caseId, user.id],
  );
  if (!row) throw new HttpError(404, "Causa inexistente");
  if (row.owner_id === user.id) return;
  if (row.permiso === "edicion" || (need === "lectura" && row.permiso === "lectura")) return;
  throw new HttpError(403, "Sin permiso sobre esta causa");
}

export async function audit(
  user: User | null,
  action: string,
  caseId: string | null,
  detail: Record<string, unknown> = {},
) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await query("INSERT INTO audit_log (user_id, action, case_id, detail, ip) VALUES ($1,$2,$3,$4,$5)", [
    user?.id ?? null,
    action,
    caseId,
    JSON.stringify(detail),
    ip,
  ]);
}

/** Envuelve un handler de API con manejo uniforme de errores. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
    }
  };
}
