"use server";
import { randomInt, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { one, tx } from "@/lib/db";
import { hashSecret, passwordProblems } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { seedDemo } from "@/lib/demo";
import { clientIp, setSessionCookie, userAgent } from "@/lib/session";
import type { ActionState } from "@/components/action-form";

export async function needsSetup() {
  const r = await one(`select count(*)::int as n from users where role = 'superadmin'`);
  return (r?.n ?? 0) === 0;
}

function tokenOk(given: string) {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function setupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!(await hit(`setup:${ip ?? "?"}`, 10, 3600)).allowed) return { message: "Demasiados intentos. Probá más tarde." };
  if (!tokenOk(String(fd.get("token") ?? "").trim())) return { message: "El código de configuración no es válido." };
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const pw = String(fd.get("password") ?? "");
  if (name.length < 3) return { message: "Completá tu nombre." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { message: "Correo inválido." };
  if (pw !== String(fd.get("confirm") ?? "")) return { message: "Las contraseñas no coinciden." };
  const prob = passwordProblems(pw);
  if (prob) return { message: prob };
  const withDemo = fd.get("demo") === "on";

  const demoPassword = `demo-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
  const demoPin = String(randomInt(1000, 9999));
  const created = await tx(async (c) => {
    // Bloqueo para que dos personas no configuren a la vez.
    await c.query(`select pg_advisory_xact_lock(4242)`);
    const r = await c.query(`select count(*)::int as n from users where role = 'superadmin'`);
    if (r.rows[0].n > 0) return null;
    const u = await c.query(`insert into users (email, password_hash, role, full_name) values ($1,$2,'superadmin',$3) returning id`,
      [email, await hashSecret(pw), name]);
    if (withDemo) await seedDemo(c, { password: demoPassword, pin: demoPin });
    await audit({ actorId: u.rows[0].id, action: "setup.completed", entity: "system", after: { email, withDemo }, ip }, c);
    return u.rows[0].id as string;
  });
  if (!created) return { message: "El sistema ya fue configurado. Ingresá desde /login." };
  await setSessionCookie(await createSession(created, ip, await userAgent()));
  redirect(withDemo ? `/setup/listo?demo=${encodeURIComponent(demoPassword)}&pin=${demoPin}` : "/admin");
}
