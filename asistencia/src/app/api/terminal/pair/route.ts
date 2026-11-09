import { NextResponse } from "next/server";
import { pairTerminal, TERMINAL_COOKIE } from "@/lib/terminals";
import { sameOrigin } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const { code } = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const r = await pairTerminal(String(code ?? "").trim(), ip);
  if (!r) return NextResponse.json({ ok: false, message: "Código inválido o vencido." }, { status: 400 });
  await audit({ actorId: null, action: "terminal.paired", entity: "terminal", entityId: r.terminalId, ip });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TERMINAL_COOKIE, r.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
