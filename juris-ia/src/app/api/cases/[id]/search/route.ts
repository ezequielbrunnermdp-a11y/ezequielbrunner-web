import { handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { searchChunks, unitLabel } from "@/lib/retrieval";

type Ctx = { params: Promise<{ id: string }> };

/** Búsqueda dentro del expediente (visor documental). */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ hits: [] });
  const hits = await searchChunks(id, q, { limit: 30 });
  return Response.json({
    hits: hits.map((h) => ({ document_id: h.document_id, filename: h.filename, titulo: h.titulo, page: h.page_number, unidad: unitLabel(h.mime_type), text: h.text.slice(0, 500) })),
  });
});
