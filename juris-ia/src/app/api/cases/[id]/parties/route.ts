import { z } from "zod";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
const Party = z.object({ nombre: z.string().min(2), rol: z.string().default("otro"), identificador: z.string().optional() });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id, "edicion");
  const p = Party.parse(await req.json());
  const row = await one("INSERT INTO case_parties (case_id, nombre, rol, identificador) VALUES ($1,$2,$3,$4) RETURNING *", [id, p.nombre.trim(), p.rol, p.identificador?.trim() || null]);
  await audit(user, "agregar_parte", id, { nombre: p.nombre });
  return Response.json(row, { status: 201 });
});

/** Confirmar (origen=usuario) o eliminar una parte. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id, "edicion");
  const { partyId, action, rol, identificador } = (await req.json()) as { partyId: string; action: "confirmar" | "eliminar"; rol?: string; identificador?: string };
  if (action === "eliminar") await query("DELETE FROM case_parties WHERE id = $1 AND case_id = $2", [partyId, id]);
  else
    await query("UPDATE case_parties SET origen = 'usuario', rol = coalesce($3, rol), identificador = coalesce($4, identificador) WHERE id = $1 AND case_id = $2", [partyId, id, rol ?? null, identificador ?? null]);
  await audit(user, `parte_${action}`, id, { partyId });
  return Response.json({ ok: true });
});
