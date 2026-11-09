import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAllJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disparador externo de tareas (Vercel Cron, cron del sistema, etc.). Protegido con CRON_SECRET. */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok = secret.length >= 16 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, result: await runAllJobs() });
}
export const GET = handle;
export const POST = handle;
