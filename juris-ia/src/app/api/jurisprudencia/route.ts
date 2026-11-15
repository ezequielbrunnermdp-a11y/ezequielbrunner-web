import { z } from "zod";
import { audit, handle, requireUser } from "@/lib/auth";
import { buscarJurisprudencia } from "@/lib/jurisprudencia";

export const maxDuration = 300;
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
  const b = Body.parse(await req.json());
  await audit(user, "buscar_jurisprudencia", b.caseId ?? null, { materia: b.materia, tribunal: b.tribunal });
  return Response.json(await buscarJurisprudencia(b));
});
