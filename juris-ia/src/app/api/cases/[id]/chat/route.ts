import { z } from "zod";
import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { getOrCreateThread, sendChat, visibleMessages } from "@/lib/chat";
import { isConfigured } from "@/lib/claude";
import { query } from "@/lib/db";
import { sse } from "@/lib/sse";
import { PERSPECTIVAS } from "@/lib/taxonomy";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 800;

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  const threadId = await getOrCreateThread(id, user.id, new URL(req.url).searchParams.get("thread"));
  const threads = await query("SELECT id, title, created_at FROM chat_threads WHERE case_id = $1 AND user_id = $2 ORDER BY created_at DESC", [id, user.id]);
  return Response.json({ threadId, threads, messages: await visibleMessages(threadId) });
});

const Body = z.object({
  threadId: z.string().optional(),
  pregunta: z.string().min(1).max(8000),
  perspectiva: z.enum(Object.keys(PERSPECTIVAS) as [keyof typeof PERSPECTIVAS]).default("neutral"),
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  if (!isConfigured()) return Response.json({ error: "Claude no está configurado (ANTHROPIC_API_KEY)." }, { status: 503 });
  const b = Body.parse(await req.json());
  const threadId = await getOrCreateThread(id, user.id, b.threadId);
  await audit(user, "consulta_chat", id, { threadId, perspectiva: b.perspectiva, pregunta: b.pregunta.slice(0, 500) });
  if (b.pregunta.length > 0) {
    const t = await query<{ n: number }>("SELECT count(*)::int AS n FROM chat_messages WHERE thread_id = $1", [threadId]);
    if (t[0].n === 0) await query("UPDATE chat_threads SET title = $2 WHERE id = $1", [threadId, b.pregunta.slice(0, 80)]);
  }
  return sse(async (send, signal) => {
    send("thread", { threadId });
    const r = await sendChat({ caseId: id, threadId, question: b.pregunta, perspectiva: b.perspectiva, signal, onEvent: (e) => send(e.type, e) });
    send("stop", { reason: r.stop });
  }, req.signal);
});
