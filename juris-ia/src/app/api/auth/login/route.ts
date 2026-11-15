import { audit, handle, login } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  const user = await login(email, password);
  await audit(user, user ? "login" : "login_fallido", null, { email });
  if (!user) return Response.json({ error: "Credenciales inválidas" }, { status: 401 });
  return Response.json({ user });
});
