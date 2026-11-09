import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { terminalFromToken, TERMINAL_COOKIE } from "@/lib/terminals";
import { issueQrToken } from "@/lib/qr";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = await terminalFromToken((await cookies()).get(TERMINAL_COOKIE)?.value);
  if (!t) return NextResponse.json({ ok: false }, { status: 401 });
  const { token, expiresAt } = issueQrToken(t.branch_id, t.id);
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  return NextResponse.json(
    { ok: true, url: `${base}/fichar?qr=${encodeURIComponent(token)}`, expiresAt, serverTime: Date.now(), branch: t.branch_name, company: t.company_name },
    { headers: { "Cache-Control": "no-store" } },
  );
}
