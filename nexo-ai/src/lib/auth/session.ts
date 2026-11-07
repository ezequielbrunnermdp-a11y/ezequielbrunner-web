import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { createSession, deleteSession, listMemberships, userForToken, type MembershipRow, type SessionUser } from "./accounts";
import { authorize, type Ctx, type Permission } from "./permissions";

export const SESSION_COOKIE = "nexo_session";
export const COMPANY_COOKIE = "nexo_company";

export async function startSession(userId: string) {
  const db = await getDb();
  const { token, expires } = await createSession(db, userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userForToken(await getDb(), token);
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export interface Workspace {
  user: SessionUser;
  memberships: MembershipRow[];
  active: MembershipRow | null;
}

/** Usuario + empresas a las que pertenece + empresa activa (validada contra sus membresías). */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  const memberships = await listMemberships(await getDb(), user.id);
  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  const active = memberships.find((m) => m.company_id === wanted) ?? memberships[0] ?? null;
  return { user, memberships, active };
});

/** Contexto autorizado para la empresa activa; redirige si no hay empresa. Lanza ForbiddenError si falta el permiso. */
export async function requireCtx(perm: Permission): Promise<Ctx> {
  const ws = await getWorkspace();
  if (!ws.active) redirect("/onboarding");
  return authorize(await getDb(), ws.user.id, ws.active.company_id, perm);
}
