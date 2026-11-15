import { z } from "zod";
import { audit, handle, requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { buscarJurisprudencia } from "@/lib/jurisprudencia";
import { createJob, startJob } from "@/lib/jobs";

const Body = z.object({
  hechos: z.string().min(5),
  materia: z.string().optional(),
  tribunal: z.string().optional(),
  normativa: z.string().optional(),
  argumentos: z.string().optional(),
  caseId: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { caseId, ...q } = Body.parse(await req.json());
  await audit(user, "buscar_jurisprudencia", null, { materia: q.materia, tribunal: q.tribunal, caseId });
  // Sin búsqueda web habilitada la respuesta es inmediata (enlaces oficiales).
  if (!env.webSearchEnabled) return Response.json(await buscarJurisprudencia(q));
  const jobId = await createJob(user.id, null, { kind: "juris", query: q });
  await startJob(jobId, new URL(req.url).origin);
  return Response.json({ jobId }, { status: 202 });
});
