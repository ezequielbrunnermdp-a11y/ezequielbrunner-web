import { z } from "zod";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getCase, listDocuments, piezasFaltantes } from "@/lib/caseContext";
import { relatedCases } from "@/lib/search";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  const [causa, documentos, partes, relacionadas] = await Promise.all([
    getCase(id),
    listDocuments(id),
    query("SELECT * FROM case_parties WHERE case_id = $1 ORDER BY rol, nombre", [id]),
    relatedCases(user, id),
  ]);
  await audit(user, "ver_causa", id);
  return Response.json({ causa, documentos, partes, relacionadas, faltantes: piezasFaltantes(documentos) });
});

const Patch = z.object({
  caratula: z.string().min(3).optional(),
  numero: z.string().nullable().optional(),
  receptoria: z.string().nullable().optional(),
  departamento: z.string().nullable().optional(),
  organismo: z.string().nullable().optional(),
  fuero: z.string().nullable().optional(),
  objeto: z.string().nullable().optional(),
  estado_procesal: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id, "edicion");
  const d = Patch.parse(await req.json());
  const keys = Object.keys(d) as (keyof typeof d)[];
  if (keys.length) {
    await query(
      `UPDATE cases SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
      [id, ...keys.map((k) => d[k])],
    );
  }
  await audit(user, "editar_causa", id, { campos: keys });
  return Response.json(await getCase(id));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  const own = await query("SELECT 1 FROM cases WHERE id = $1 AND owner_id = $2", [id, user.id]);
  if (!own.length) return Response.json({ error: "Solo el propietario puede eliminar la causa" }, { status: 403 });
  await query("DELETE FROM cases WHERE id = $1", [id]);
  await audit(user, "eliminar_causa", id);
  return Response.json({ ok: true });
});
