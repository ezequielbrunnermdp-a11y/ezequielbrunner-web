import type { Queryable } from "../db";
import { hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import { audit } from "../audit";
import { z } from "zod";

export const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  is_platform_admin: boolean;
}

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(200);
export const emailSchema = z.string().trim().toLowerCase().email("Email inválido.");

export async function countUsers(db: Queryable): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from users`);
  return r.rows[0].n;
}

export async function createUser(
  db: Queryable,
  input: { email: string; name: string; password: string; isPlatformAdmin?: boolean },
): Promise<SessionUser> {
  const email = emailSchema.parse(input.email);
  passwordSchema.parse(input.password);
  const r = await db.query<SessionUser>(
    `insert into users (email, name, password_hash, is_platform_admin) values ($1, $2, $3, $4)
     returning id, email, name, is_platform_admin`,
    [email, input.name.trim(), hashPassword(input.password), input.isPlatformAdmin ?? false],
  );
  return r.rows[0];
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "empresa"
  );
}

export async function createCompany(
  db: Queryable,
  input: { name: string; ownerId: string; isDemo?: boolean },
): Promise<{ id: string; slug: string }> {
  const base = slugify(input.name);
  let slug = base;
  for (let i = 2; (await db.query(`select 1 from companies where slug = $1`, [slug])).rows.length; i++) slug = `${base}-${i}`;
  const r = await db.query<{ id: string; slug: string }>(
    `insert into companies (name, slug, is_demo) values ($1, $2, $3) returning id, slug`,
    [input.name.trim(), slug, input.isDemo ?? false],
  );
  const company = r.rows[0];
  await db.query(`insert into memberships (user_id, company_id, role) values ($1, $2, 'owner')`, [input.ownerId, company.id]);
  await audit(db, { companyId: company.id, actorId: input.ownerId, action: "company.create", targetType: "company", targetId: company.id });
  return company;
}

export async function authenticate(db: Queryable, emailRaw: string, password: string): Promise<SessionUser | null> {
  const email = emailRaw.trim().toLowerCase();
  const r = await db.query<SessionUser & { password_hash: string; disabled_at: string | null }>(
    `select id, email, name, is_platform_admin, password_hash, disabled_at from users where email = $1`,
    [email],
  );
  const u = r.rows[0];
  // Verificación con costo constante aunque el usuario no exista.
  const ok = verifyPassword(password, u?.password_hash ?? "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!u || !ok || u.disabled_at) {
    await audit(db, { companyId: null, actorId: u?.id ?? null, action: "auth.login_failed", metadata: { email_hash: sha256(email).slice(0, 16) } });
    return null;
  }
  await audit(db, { companyId: null, actorId: u.id, action: "auth.login" });
  return { id: u.id, email: u.email, name: u.name, is_platform_admin: u.is_platform_admin };
}

export async function createSession(db: Queryable, userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.query(`insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)`, [userId, sha256(token), expires.toISOString()]);
  await db.query(`delete from sessions where expires_at < now()`);
  return { token, expires };
}

export async function userForToken(db: Queryable, token: string): Promise<SessionUser | null> {
  const r = await db.query<SessionUser>(
    `select u.id, u.email, u.name, u.is_platform_admin from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.disabled_at is null`,
    [sha256(token)],
  );
  return r.rows[0] ?? null;
}

export async function deleteSession(db: Queryable, token: string) {
  await db.query(`delete from sessions where token_hash = $1`, [sha256(token)]);
}

export interface MembershipRow {
  company_id: string;
  name: string;
  slug: string;
  is_demo: boolean;
  role: import("./permissions").Role;
}

export async function listMemberships(db: Queryable, userId: string): Promise<MembershipRow[]> {
  const r = await db.query<MembershipRow>(
    `select c.id as company_id, c.name, c.slug, c.is_demo, m.role
     from memberships m join companies c on c.id = m.company_id
     where m.user_id = $1 order by c.is_demo asc, c.name asc`,
    [userId],
  );
  return r.rows;
}
