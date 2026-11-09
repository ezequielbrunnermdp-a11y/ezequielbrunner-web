"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, revokeSession, SESSION_COOKIE, changePassword } from "@/lib/auth";
import { clientIp, setSessionCookie, userAgent, requireActor } from "@/lib/session";
import { passwordProblems } from "@/lib/password";
import type { ActionState } from "@/components/action-form";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { message: "Completá correo y contraseña." };
  const r = await login(email, password, await clientIp(), await userAgent());
  if (!r.ok) return { message: r.message };
  await setSessionCookie(r.token);
  redirect("/");
}

export async function logoutAction() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await revokeSession(t);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireActor();
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { message: "Las contraseñas nuevas no coinciden." };
  const prob = passwordProblems(next);
  if (prob) return { message: prob };
  const err = await changePassword(a.id, String(fd.get("current") ?? ""), next);
  if (err) return { message: err };
  return { ok: true, message: "Contraseña actualizada." };
}
