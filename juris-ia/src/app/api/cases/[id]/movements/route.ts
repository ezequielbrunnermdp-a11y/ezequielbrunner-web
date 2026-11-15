import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { tx } from "@/lib/db";
import { categorizarMovimiento, parseMovimientos } from "@/lib/movements";

type Ctx = { params: Promise<{ id: string }> };

/** Importa un listado de movimientos pegado como texto (p. ej. copiado por el usuario desde la MEV). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id, "edicion");
  const { texto, preview } = (await req.json()) as { texto: string; preview?: boolean };
  const { movimientos, descartadas } = parseMovimientos(texto ?? "");
  const items = movimientos.map((m) => ({ ...m, ...categorizarMovimiento(m.descripcion) }));
  if (preview) return Response.json({ items, descartadas });
  await tx(async (c) => {
    for (const m of items)
      await c.query(
        "INSERT INTO actuaciones (case_id, fecha, tipo, categoria, descripcion, origen) VALUES ($1,$2,$3,$4,$5,'listado_movimientos')",
        [id, m.fecha, m.tipo, m.categoria, m.descripcion],
      );
  });
  await audit(user, "importar_movimientos", id, { cantidad: items.length });
  return Response.json({ importados: items.length, descartadas });
});
