import { ZodError } from "zod";
import { ForbiddenError } from "./auth/permissions";
import { ValidationError } from "./tasks/service";
import { ImportFileError } from "./whatsapp/archive";
import { ConfigError } from "./crypto";

export type ActionState = { ok: boolean; message?: string; error?: string; at: number } | null;

/** Errores esperables → mensaje para la persona; errores inesperados → mensaje genérico y log en servidor. */
export function errorMessage(e: unknown): string {
  if (e instanceof ForbiddenError || e instanceof ValidationError || e instanceof ImportFileError || e instanceof ConfigError) return e.message;
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" ");
  // redirect()/notFound() de Next deben propagarse.
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  console.error("[nexo] error inesperado", e);
  return "Ocurrió un error inesperado. Intentá nuevamente.";
}

export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message || undefined, at: Date.now() };
  } catch (e) {
    return { ok: false, error: errorMessage(e), at: Date.now() };
  }
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
