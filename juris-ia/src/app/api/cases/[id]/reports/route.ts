import { z } from "zod";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { isConfigured } from "@/lib/claude";
import { query } from "@/lib/db";
import { createJob, startJob } from "@/lib/jobs";
import { REPORT_KINDS } from "@/lib/reports";
import { PERSPECTIVAS } from "@/lib/taxonomy";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  const reports = await query("SELECT id, kind, perspectiva, markdown, citas, meta, created_at FROM reports WHERE case_id = $1 ORDER BY created_at DESC", [id]);
  return Response.json({ reports, kinds: Object.fromEntries(Object.entries(REPORT_KINDS).map(([k, v]) => [k, v.label])) });
});

const Body = z.object({
  kind: z.enum(Object.keys(REPORT_KINDS) as [keyof typeof REPORT_KINDS]),
  perspectiva: z.enum(Object.keys(PERSPECTIVAS) as [keyof typeof PERSPECTIVAS]).default("neutral"),
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  if (!isConfigured()) return Response.json({ error: "Claude no está configurado (falta ANTHROPIC_API_KEY en el servidor)." }, { status: 503 });
  const b = Body.parse(await req.json());
  await audit(user, "generar_informe", id, b);
  const jobId = await createJob(user.id, id, { kind: "report", caseId: id, userId: user.id, reportKind: b.kind, perspectiva: b.perspectiva });
  await startJob(jobId, new URL(req.url).origin);
  return Response.json({ jobId }, { status: 202 });
});
