import { handle, requireUser } from "@/lib/auth";
import { one } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Estado de una tarea en segundo plano (la interfaz lo consulta cada segundo). */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Tarea inexistente" }, { status: 404 });
  const job = await one(
    `SELECT id, kind, status, progreso, texto, mensajes, result, error, created_at, updated_at,
       (status IN ('pendiente','en_curso') AND updated_at < now() - interval '16 minutes') AS vencida
     FROM jobs WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!job) return Response.json({ error: "Tarea inexistente" }, { status: 404 });
  return Response.json(job);
});
