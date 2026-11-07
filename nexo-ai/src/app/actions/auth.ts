"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { authenticate, countUsers, createCompany, createUser, emailSchema, passwordSchema } from "@/lib/auth/accounts";
import { COMPANY_COOKIE, endSession, getWorkspace, requireUser, startSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { errorMessage, str, type ActionState } from "@/lib/action";
import { seedDemoCompany } from "@/lib/demo/seed";
import { ForbiddenError } from "@/lib/auth/permissions";
import { assertEncryptionReady } from "@/lib/crypto";

// Límite simple de intentos por IP+email (en memoria del proceso).
const attempts = new Map<string, { n: number; until: number }>();

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}|${email}`;
  const a = attempts.get(key);
  if (a && a.n >= 5 && a.until > Date.now()) {
    return { ok: false, error: "Demasiados intentos. Esperá unos minutos.", at: Date.now() };
  }
  const user = await authenticate(await getDb(), email, str(fd, "password"));
  if (!user) {
    attempts.set(key, { n: (a?.until ?? 0) > Date.now() ? (a?.n ?? 0) + 1 : 1, until: Date.now() + 10 * 60_000 });
    return { ok: false, error: "Email o contraseña incorrectos.", at: Date.now() };
  }
  attempts.delete(key);
  await startSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  const u = await requireUser();
  await audit(await getDb(), { companyId: null, actorId: u.id, action: "auth.logout" });
  await endSession();
  redirect("/login");
}

/** Configuración inicial: sólo funciona si todavía no existe ningún usuario. */
export async function setupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    assertEncryptionReady();
    const db = await getDb();
    const email = emailSchema.parse(str(fd, "email"));
    passwordSchema.parse(str(fd, "password"));
    if (str(fd, "password") !== str(fd, "password2")) return { ok: false, error: "Las contraseñas no coinciden.", at: Date.now() };
    const companyName = str(fd, "company");
    if (companyName.length < 2) return { ok: false, error: "Indicá el nombre de tu empresa.", at: Date.now() };
    const userId = await db.tx(async (q) => {
      if ((await countUsers(q)) > 0) throw new ForbiddenError("La plataforma ya fue configurada. Iniciá sesión.");
      const u = await createUser(q, { email, name: str(fd, "name") || email, password: str(fd, "password"), isPlatformAdmin: true });
      await createCompany(q, { name: companyName, ownerId: u.id });
      await audit(q, { companyId: null, actorId: u.id, action: "auth.setup" });
      return u.id;
    });
    if (fd.get("demo") === "on") await seedDemoCompany(db, userId);
    await startSession(userId);
  } catch (e) {
    return { ok: false, error: errorMessage(e), at: Date.now() };
  }
  redirect("/dashboard");
}

export async function switchCompanyAction(fd: FormData) {
  const ws = await getWorkspace();
  const id = str(fd, "company_id");
  if (ws.memberships.some((m) => m.company_id === id)) {
    (await cookies()).set(COMPANY_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  }
  redirect("/dashboard");
}

/** Sólo administradores de plataforma crean empresas nuevas. */
export async function createCompanyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const ws = await getWorkspace();
    if (!ws.user.is_platform_admin) throw new ForbiddenError("Sólo un administrador de la plataforma puede crear empresas.");
    const db = await getDb();
    if (fd.get("demo") === "on") id = await seedDemoCompany(db, ws.user.id);
    else {
      const name = str(fd, "name");
      if (name.length < 2) return { ok: false, error: "Nombre muy corto.", at: Date.now() };
      id = (await createCompany(db, { name, ownerId: ws.user.id })).id;
    }
  } catch (e) {
    return { ok: false, error: errorMessage(e), at: Date.now() };
  }
  (await cookies()).set(COMPANY_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/dashboard");
}
