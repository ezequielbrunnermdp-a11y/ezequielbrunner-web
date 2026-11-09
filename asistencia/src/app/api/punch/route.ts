import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { actorFromSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { mobilePunch } from "@/lib/punch";
import { sameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, code: "csrf", message: "Origen no permitido." }, { status: 403 });
  const actor = await actorFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!actor) return NextResponse.json({ ok: false, code: "unauthenticated", message: "Tu sesión venció. Ingresá nuevamente." }, { status: 401 });
  if (!actor.employee_id) return NextResponse.json({ ok: false, code: "no_employee", message: "Tu usuario no tiene legajo para fichar." }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "bad_request", message: "Solicitud inválida." }, { status: 400 }); }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const result = await mobilePunch(actor.id, {
    type: body?.type, latitude: body?.latitude, longitude: body?.longitude, accuracy: body?.accuracy, qr: body?.qr, idempotencyKey: body?.idempotencyKey,
  }, { ip: ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null, userAgent: req.headers.get("user-agent") });
  return NextResponse.json(result, { status: result.ok ? 200 : 422, headers: { "Cache-Control": "no-store" } });
}
