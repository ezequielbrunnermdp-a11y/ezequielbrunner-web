import { handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  const eventos = await query(
    `SELECT a.id, a.fecha, a.tipo, a.categoria, a.parte, a.descripcion, a.origen, a.document_id, d.filename, d.titulo, d.mime_type
     FROM actuaciones a LEFT JOIN documents d ON d.id = a.document_id
     WHERE a.case_id = $1 ORDER BY a.fecha NULLS LAST, a.created_at`,
    [id],
  );
  return Response.json({ eventos });
});
