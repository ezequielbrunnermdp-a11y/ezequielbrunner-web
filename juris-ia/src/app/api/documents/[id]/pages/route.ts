import { z } from "zod";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

async function docCase(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one<{ case_id: string }>("SELECT case_id FROM documents WHERE id = $1", [id]);
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  const doc = await docCase(id);
  if (!doc) return Response.json({ error: "Documento inexistente" }, { status: 404 });
  await requireCaseAccess(user, doc.case_id);
  const pages = await query("SELECT page_number, text, text_source FROM document_pages WHERE document_id = $1 ORDER BY page_number", [id]);
  return Response.json({ pages });
});

const Reclass = z.object({
  tipo: z.string().optional(),
  titulo: z.string().nullable().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  parte: z.string().nullable().optional(),
  fojas: z.string().nullable().optional(),
});

/** Corrección manual de la clasificación (prevalece sobre la de IA). */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  const doc = await docCase(id);
  if (!doc) return Response.json({ error: "Documento inexistente" }, { status: 404 });
  await requireCaseAccess(user, doc.case_id, "edicion");
  const d = Reclass.parse(await req.json());
  const keys = Object.keys(d) as (keyof typeof d)[];
  if (keys.length)
    await query(`UPDATE documents SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, clasificacion_origen = 'usuario' WHERE id = $1`, [id, ...keys.map((k) => d[k])]);
  await audit(user, "reclasificar_documento", doc.case_id, { documentId: id, campos: keys });
  return Response.json({ ok: true });
});
