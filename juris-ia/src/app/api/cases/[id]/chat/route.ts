import { z } from "zod";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { getOrCreateThread, visibleMessages } from "@/lib/chat";
import { isConfigured } from "@/lib/claude";
import { query } from "@/lib/db";
import { createJob, startJob } from "@/lib/jobs";
import { PERSPECTIVAS } from "@/lib/taxonomy";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  const threadId = await getOrCreateThread(id, user.id, new URL(req.url).searchParams.get("thread"));
  const threads = await query("SELECT id, title, created_at FROM chat_threads WHERE case_id = $1 AND user_id = $2 ORDER BY created_at DESC", [id, user.id]);
  const activo = await query<{ id: string }>(
    "SELECT id FROM jobs WHERE case_id = $1 AND user_id = $2 AND kind = 'chat' AND status IN ('pendiente','en_curso') AND payload->>'threadId' = $3 AND updated_at > now() - interval '16 minutes' ORDER BY created_at DESC LIMIT 1",
    [id, user.id, threadId],
  );
  return Response.json({ threadId, threads, messages: await visibleMessages(threadId), jobActivo: activo[0]?.id ?? null });
});

const Body = z.object({
  threadId: z.string().optional(),
  pregunta: z.string().min(1).max(8000),
  perspectiva: z.enum(Object.keys(PERSPECTIVAS) as [keyof typeof PERSPECTIVAS]).default("neutral"),
});

/** Inicia la respuesta de Claude como tarea en segundo plano y devuelve su id. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  if (!isConfigured()) return Response.json({ error: "Claude no está configurado (falta ANTHROPIC_API_KEY en el servidor)." }, { status: 503 });
  const b = Body.parse(await req.json());
  const threadId = await getOrCreateThread(id, user.id, b.threadId);
  const ocupado = await query(
    "SELECT 1 FROM jobs WHERE kind='chat' AND payload->>'threadId' = $1 AND status IN ('pendiente','en_curso') AND updated_at > now() - interval '16 minutes'",
    [threadId],
  );
  if (ocupado.length) return Response.json({ error: "Claude todavía está respondiendo en esta conversación." }, { status: 409 });
  const t = await query<{ n: number }>("SELECT count(*)::int AS n FROM chat_messages WHERE thread_id = $1", [threadId]);
  if (t[0].n === 0) await query("UPDATE chat_threads SET title = $2 WHERE id = $1", [threadId, b.pregunta.slice(0, 80)]);
  await audit(user, "consulta_chat", id, { threadId, perspectiva: b.perspectiva, pregunta: b.pregunta.slice(0, 500) });
  const jobId = await createJob(user.id, id, { kind: "chat", caseId: id, threadId, pregunta: b.pregunta, perspectiva: b.perspectiva });
  await startJob(jobId, new URL(req.url).origin);
  return Response.json({ jobId, threadId }, { status: 202 });
});
