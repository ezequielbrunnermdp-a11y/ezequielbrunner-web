import { randomUUID } from "node:crypto";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { assembleUpload, storeUploadPart } from "@/lib/storage";
import { ingestDocument, MAX_FILE_BYTES } from "@/lib/ingest";
import { isConfigured } from "@/lib/claude";
import { createJob, startJob } from "@/lib/jobs";

type Ctx = { params: Promise<{ id: string }> };
const PART_MAX = 4 * 1024 * 1024;

/**
 * Carga por partes (Netlify limita cada petición a ~6 MB):
 *  POST ?accion=iniciar                       → { uploadId }
 *  POST ?accion=parte&uploadId=..&n=..  (cuerpo binario ≤ 4 MB)
 *  POST ?accion=finalizar&uploadId=..&partes=..&nombre=..&tipo=..  → ingesta
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id, "edicion");
  const u = new URL(req.url);
  const accion = u.searchParams.get("accion");
  if (accion === "iniciar") return Response.json({ uploadId: randomUUID(), partMax: PART_MAX });
  const uploadId = u.searchParams.get("uploadId") ?? "";
  if (accion === "parte") {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > PART_MAX) return Response.json({ error: "Parte demasiado grande" }, { status: 413 });
    await storeUploadPart(uploadId, Number(u.searchParams.get("n")), buf);
    return Response.json({ ok: true });
  }
  if (accion === "finalizar") {
    const partes = Number(u.searchParams.get("partes"));
    if (!(partes > 0) || partes * PART_MAX > MAX_FILE_BYTES + PART_MAX) return Response.json({ error: "Cantidad de partes inválida" }, { status: 400 });
    const nombre = u.searchParams.get("nombre") ?? "documento";
    const buf = await assembleUpload(uploadId, partes);
    const r = await ingestDocument(id, user.id, { name: nombre, type: u.searchParams.get("tipo") ?? "", buf });
    await audit(user, "incorporar_documentos", id, { archivos: [{ nombre, id: r.documentId, duplicado: r.duplicate }] });
    let jobId: string | null = null;
    if (!r.duplicate) {
      jobId = await createJob(user.id, id, { kind: "enrich", documentIds: [r.documentId] });
      await startJob(jobId, u.origin);
    }
    return Response.json({ ...r, filename: nombre, jobId, ia: isConfigured() });
  }
  return Response.json({ error: "Acción inválida" }, { status: 400 });
});
