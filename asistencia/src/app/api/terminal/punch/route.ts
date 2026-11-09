import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { terminalFromToken, TERMINAL_COOKIE } from "@/lib/terminals";
import { kioskPunch } from "@/lib/punch";
import { sameOrigin } from "@/lib/session";
import { one } from "@/lib/db";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, message: "Origen no permitido." }, { status: 403 });
  const t = await terminalFromToken((await cookies()).get(TERMINAL_COOKIE)?.value);
  if (!t) return NextResponse.json({ ok: false, message: "Terminal no vinculada." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const r = await kioskPunch(t.id, { fileNumber: b.fileNumber, pin: b.pin, type: b.type, idempotencyKey: b.idempotencyKey },
    { ip: ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null, userAgent: req.headers.get("user-agent") });
  let name: string | null = null;
  if (r.ok) name = (await one(`select e.first_name from punches p join employees e on e.id = p.employee_id where p.id = $1`, [r.punchId]))?.first_name ?? null;
  return NextResponse.json({ ...r, name }, { status: r.ok ? 200 : 422 });
}
