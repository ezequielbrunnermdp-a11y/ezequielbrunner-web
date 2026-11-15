import { handle, logout } from "@/lib/auth";

export const POST = handle(async () => {
  await logout();
  return Response.json({ ok: true });
});
