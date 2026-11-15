import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { ingestDocument, type IngestResult } from "@/lib/ingest";
import { createJob, startJob } from "@/lib/jobs";
import { listDocuments } from "@/lib/caseContext";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 300;

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  return Response.json(await listDocuments(id));
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id, "edicion");
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No se recibieron archivos" }, { status: 400 });
  const results: (IngestResult & { filename: string; error?: string })[] = [];
  for (const f of files) {
    try {
      const r = await ingestDocument(id, user.id, { name: f.name, type: f.type, buf: Buffer.from(await f.arrayBuffer()) });
      results.push({ ...r, filename: f.name });
    } catch (e) {
      results.push({ filename: f.name, documentId: "", duplicate: false, pages: 0, warnings: [], error: (e as Error).message });
    }
  }
  const nuevos = results.filter((r) => r.documentId && !r.duplicate).map((r) => r.documentId);
  if (nuevos.length) await startJob(await createJob(user.id, id, { kind: "enrich", documentIds: nuevos }), new URL(req.url).origin);
  await audit(user, "incorporar_documentos", id, { archivos: results.map((r) => ({ nombre: r.filename, id: r.documentId, error: r.error })) });
  return Response.json({ results });
});
