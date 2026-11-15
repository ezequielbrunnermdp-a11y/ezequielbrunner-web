import { z } from "zod";
import { audit, handle, login } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { one, query } from "@/lib/db";
import { env } from "@/lib/env";

const Body = z.object({ token: z.string(), email: z.string().email(), name: z.string().min(2), password: z.string().min(12) });

/** Alta del PRIMER administrador. Solo funciona mientras no exista ningún usuario y con SETUP_TOKEN. */
export const GET = handle(async () => {
  const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM users");
  return Response.json({ disponible: n!.n === 0 && Boolean(env.setupToken) });
});

export const POST = handle(async (req: Request) => {
  const b = Body.safeParse(await req.json());
  if (!b.success) return Response.json({ error: "Datos inválidos (la contraseña debe tener al menos 12 caracteres)." }, { status: 400 });
  if (!env.setupToken || b.data.token !== env.setupToken) return Response.json({ error: "Código de configuración inválido." }, { status: 403 });
  const created = await query(
    `INSERT INTO users (email, name, password_hash, role)
     SELECT $1, $2, $3, 'admin' WHERE NOT EXISTS (SELECT 1 FROM users) RETURNING id`,
    [b.data.email.toLowerCase(), b.data.name, hashPassword(b.data.password)],
  );
  if (!created.length) return Response.json({ error: "La configuración inicial ya fue realizada." }, { status: 409 });
  const user = await login(b.data.email, b.data.password);
  await audit(user, "configuracion_inicial", null);
  return Response.json({ ok: true });
});
