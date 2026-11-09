import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { actorFromSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { q } from "@/lib/db";
import { validateGeo } from "@/lib/geo";
import { hit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/session";

/** Verificación previa y voluntaria: no registra nada ni guarda la ubicación. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const actor = await actorFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!actor?.employee_id) return NextResponse.json({ ok: false }, { status: 401 });
  if (!(await hit(`loccheck:${actor.id}`, 20, 600)).allowed) return NextResponse.json({ ok: false, message: "Demasiadas consultas." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.latitude !== "number" || typeof b.longitude !== "number" || typeof b.accuracy !== "number")
    return NextResponse.json({ ok: false, message: "Ubicación inválida." }, { status: 400 });
  const branches = await q(
    `select b.name, b.latitude, b.longitude, b.radius_m, b.max_accuracy_m from employee_branches eb join branches b on b.id = eb.branch_id
     where eb.employee_id = $1 and b.active`, [actor.employee_id],
  );
  const results = branches.map((br) => ({ name: br.name, r: validateGeo(br, b) }));
  const inside = results.find((x) => x.r.ok);
  if (inside) return NextResponse.json({ ok: true, status: "inside", branch: inside.name });
  if (results.some((x) => !x.r.ok && x.r.reason === "low_accuracy" && (x.r.distance ?? 1e9) < 1000))
    return NextResponse.json({ ok: true, status: "low_accuracy" });
  const configured = results.filter((x) => x.r.ok || x.r.reason !== "branch_not_configured");
  if (!configured.length) return NextResponse.json({ ok: true, status: "not_configured" });
  return NextResponse.json({ ok: true, status: "outside" });
}
