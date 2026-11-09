import { createHash, randomBytes } from "node:crypto";
import { one, q, type Db, pool } from "./db";
import { hashSecret, verifySecret } from "./password";
import { hit } from "./rate-limit";
import { audit } from "./audit";
import type { Actor } from "./permissions";

export const SESSION_COOKIE = "asis_session";
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const sessionTtlHours = () => Math.min(72, Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 12)));

export type LoginResult = { ok: true; token: string; actor: Actor } | { ok: false; message: string };

const GENERIC = "Correo o contraseña incorrectos.";

export async function login(emailRaw: string, password: string, ip: string | null, userAgent: string | null): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const byIp = await hit(`login:ip:${ip ?? "?"}`, 30, 15 * 60);
  const byEmail = await hit(`login:email:${email}`, 10, 15 * 60);
  if (!byIp.allowed || !byEmail.allowed) {
    await audit({ actorId: null, action: "login.rate_limited", entity: "user", entityId: email, ip });
    return { ok: false, message: "Demasiados intentos. Esperá unos minutos e intentá nuevamente." };
  }
  const u = await one(`select id, password_hash, active, locked_until from users where email = $1`, [email]);
  const valid = await verifySecret(password, u?.password_hash);
  if (!u || !u.active) return { ok: false, message: GENERIC };
  if (u.locked_until && new Date(u.locked_until) > new Date())
    return { ok: false, message: "La cuenta está bloqueada temporalmente por intentos fallidos. Probá más tarde." };
  if (!valid) {
    const r = await one<{ failed_logins: number }>(
      `update users set failed_logins = failed_logins + 1,
         locked_until = case when failed_logins + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end
       where id = $1 returning failed_logins`,
      [u.id, MAX_FAILED, LOCK_MINUTES],
    );
    await audit({ actorId: u.id, action: "login.failed", entity: "user", entityId: u.id, ip });
    if ((r?.failed_logins ?? 0) >= MAX_FAILED) {
      await q(
        `insert into alerts (type, severity, message, data, dedupe_key, company_id, employee_id)
         select 'login_lockout', 'warning', 'Cuenta bloqueada por intentos fallidos: ' || u.full_name, jsonb_build_object('ip', $2::text),
                'lockout:' || u.id || ':' || to_char(now(), 'YYYYMMDDHH24'), e.company_id, e.id
         from users u left join employees e on e.user_id = u.id where u.id = $1
         on conflict (dedupe_key) do nothing`,
        [u.id, ip],
      );
    }
    return { ok: false, message: GENERIC };
  }
  await q(`update users set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1`, [u.id]);
  const token = await createSession(u.id, ip, userAgent);
  const actor = (await actorFromUserId(u.id))!;
  await audit({ actorId: u.id, action: "login.success", entity: "user", entityId: u.id, ip });
  return { ok: true, token, actor };
}

export async function createSession(userId: string, ip: string | null, userAgent: string | null, db: Db = pool()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await q(
    `insert into sessions (token_hash, user_id, expires_at, ip, user_agent) values ($1, $2, now() + make_interval(hours => $3), $4, $5)`,
    [sha256(token), userId, sessionTtlHours(), ip, userAgent?.slice(0, 300) ?? null],
    db,
  );
  return token;
}

export async function actorFromUserId(userId: string, db: Db = pool()): Promise<Actor | null> {
  const u = await one(
    `select u.id, u.role, u.full_name, u.email, u.must_change_password, e.id as employee_id
     from users u left join employees e on e.user_id = u.id and e.active
     where u.id = $1 and u.active`,
    [userId],
    db,
  );
  if (!u) return null;
  // Sólo empresas activas cuentan para el alcance.
  const scopes = await q(
    `select s.company_id, s.branch_id from user_scopes s join companies c on c.id = s.company_id and c.active where s.user_id = $1`,
    [userId],
    db,
  );
  return { id: u.id, role: u.role, full_name: u.full_name, email: u.email, must_change_password: u.must_change_password, employee_id: u.employee_id ?? null, scopes };
}

export async function actorFromSessionToken(token: string | undefined | null): Promise<Actor | null> {
  if (!token || token.length > 100) return null;
  const s = await one(
    `update sessions set last_seen_at = now(),
        expires_at = greatest(expires_at, now() + make_interval(hours => $2))
     where token_hash = $1 and revoked_at is null and expires_at > now()
     returning user_id`,
    [sha256(token), sessionTtlHours()],
  );
  if (!s) return null;
  return actorFromUserId(s.user_id);
}

export async function revokeSession(token: string) {
  await q(`update sessions set revoked_at = now() where token_hash = $1`, [sha256(token)]);
}

export async function changePassword(userId: string, current: string, next: string) {
  const u = await one(`select password_hash from users where id = $1`, [userId]);
  if (!(await verifySecret(current, u?.password_hash))) return "La contraseña actual no es correcta.";
  await q(`update users set password_hash = $2, must_change_password = false, updated_at = now() where id = $1`, [userId, await hashSecret(next)]);
  await audit({ actorId: userId, action: "user.password_changed", entity: "user", entityId: userId });
  return null;
}
