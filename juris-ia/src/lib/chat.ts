import "server-only";
import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { one, query } from "./db";
import { runAgent, type AgentEvent } from "./agent";
import { SYSTEM_PROMPT, perspectivaInstruction } from "./prompts";
import { caseInventory } from "./caseContext";
import { renderWithCitations, type Cita } from "./citations";
import type { Block, MessageParam } from "./claude";
import type { Perspectiva } from "./taxonomy";

type Row = {
  id: number;
  role: "user" | "assistant" | "system";
  content: Anthropic.Beta.BetaContentBlockParam[] | string;
  visible: boolean;
  perspectiva: string | null;
  citas: { markdown: string; citas: Cita[] } | null;
  created_at: string;
};

export async function getOrCreateThread(caseId: string, userId: string, threadId?: string | null) {
  if (threadId) {
    const t = await one<{ id: string }>("SELECT id FROM chat_threads WHERE id = $1 AND case_id = $2 AND user_id = $3", [
      threadId,
      caseId,
      userId,
    ]);
    if (t) return t.id;
  }
  const last = await one<{ id: string }>(
    "SELECT id FROM chat_threads WHERE case_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1",
    [caseId, userId],
  );
  if (last && !threadId) return last.id;
  const t = await one<{ id: string }>("INSERT INTO chat_threads (case_id, user_id) VALUES ($1,$2) RETURNING id", [caseId, userId]);
  return t!.id;
}

export async function newThread(caseId: string, userId: string) {
  const t = await one<{ id: string }>("INSERT INTO chat_threads (case_id, user_id) VALUES ($1,$2) RETURNING id", [caseId, userId]);
  return t!.id;
}

async function rows(threadId: string) {
  return query<Row>("SELECT * FROM chat_messages WHERE thread_id = $1 ORDER BY id", [threadId]);
}

async function append(threadId: string, role: Row["role"], content: unknown, extra: Partial<Pick<Row, "visible" | "perspectiva" | "citas">> = {}) {
  await query("INSERT INTO chat_messages (thread_id, role, content, visible, perspectiva, citas) VALUES ($1,$2,$3,$4,$5,$6)", [
    threadId,
    role,
    JSON.stringify(content),
    extra.visible ?? true,
    extra.perspectiva ?? null,
    extra.citas ? JSON.stringify(extra.citas) : null,
  ]);
}

/** Mensajes visibles para la interfaz. */
export async function visibleMessages(threadId: string) {
  const all = await rows(threadId);
  return all
    .filter((r) => r.visible)
    .map((r) => ({
      id: r.id,
      role: r.role,
      perspectiva: r.perspectiva,
      created_at: r.created_at,
      markdown:
        r.role === "assistant"
          ? r.citas?.markdown ?? ""
          : typeof r.content === "string"
            ? r.content
            : r.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
      citas: r.citas?.citas ?? [],
    }))
    .filter((m) => m.markdown.trim());
}

const MARK = "[[inventario:";

export async function sendChat(opts: {
  caseId: string;
  threadId: string;
  question: string;
  perspectiva: Perspectiva;
  onEvent: (e: AgentEvent | { type: "message"; markdown: string; citas: Cita[] }) => void;
  signal?: AbortSignal;
}) {
  const history = await rows(opts.threadId);
  // Historial tal como se envió (append-only).
  const messages: MessageParam[] = history.map((r) => ({ role: r.role, content: r.content }) as MessageParam);

  await append(opts.threadId, "user", [{ type: "text", text: opts.question }], { perspectiva: opts.perspectiva });
  messages.push({ role: "user", content: [{ type: "text", text: opts.question }] });

  // Mensaje de sistema intermedio solo si cambió el inventario o la perspectiva.
  const inventory = await caseInventory(opts.caseId);
  const invHash = createHash("sha256").update(inventory).digest("hex").slice(0, 16);
  const lastPerspectiva = [...history].reverse().find((r) => r.role === "system")?.perspectiva;
  const parts: string[] = [];
  if (!historyHasInventory(history, invHash)) {
    parts.push(`${MARK}${invHash}]]\n${inventory}`);
  }
  if (lastPerspectiva !== opts.perspectiva) parts.push(perspectivaInstruction(opts.perspectiva));
  if (parts.length) {
    const text = parts.join("\n\n");
    await append(opts.threadId, "system", text, { visible: false, perspectiva: opts.perspectiva });
    messages.push({ role: "system", content: text } as MessageParam);
  }

  const result = await runAgent({
    caseId: opts.caseId,
    system: SYSTEM_PROMPT,
    messages,
    effort: "high",
    signal: opts.signal,
    onEvent: async (e) => {
      if (e.type === "assistant") {
        const rendered = await renderWithCitations(e.content);
        await append(opts.threadId, "assistant", e.content, { citas: rendered, perspectiva: opts.perspectiva });
        if (rendered.markdown.trim()) opts.onEvent({ type: "message", ...rendered });
      } else if (e.type === "tool_results") {
        await append(opts.threadId, "user", e.content, { visible: false });
      } else {
        opts.onEvent(e);
      }
    },
  });
  return result;
}

function historyHasInventory(history: Row[], hash: string) {
  // El inventario vigente es el último enviado.
  const last = [...history].reverse().find((r) => r.role === "system" && typeof r.content === "string" && r.content.includes(MARK));
  return typeof last?.content === "string" && last.content.includes(`${MARK}${hash}]]`);
}

export type { Block };
