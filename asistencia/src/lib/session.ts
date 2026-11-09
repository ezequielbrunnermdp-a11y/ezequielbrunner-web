import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { actorFromSessionToken, SESSION_COOKIE } from "./auth";
import { can, type Actor, type Cap, type Role } from "./permissions";

export const getActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  return actorFromSessionToken(jar.get(SESSION_COOKIE)?.value);
});

export async function requireActor(opts: { cap?: Cap; roles?: Role[] } = {}): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect("/login");
  if (opts.cap && !can(a, opts.cap)) redirect("/");
  if (opts.roles && !opts.roles.includes(a.role)) redirect("/");
  return a;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}
export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 72,
  });
}

/** Para Route Handlers: rechaza solicitudes con Origin de otro sitio (CSRF). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET";
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
