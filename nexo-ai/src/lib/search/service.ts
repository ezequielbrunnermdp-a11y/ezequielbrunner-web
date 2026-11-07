import { assertCan, type Ctx } from "../auth/permissions";
import { audit } from "../audit";
import { readPrivacy } from "../privacy";
import { SENT_AT } from "../tasks/service";
import { quoteMatches } from "../analysis/validate";

export interface SearchHit {
  id: string;
  conversation_id: string;
  conversation_title: string;
  sent_at: string;
  author_label: string | null;
  body: string;
  source_line: number;
  file_name: string;
  rank: number;
}

const STOP = new Set("que qué cual cuál cuales como cómo cuando cuándo donde dónde quien quién quienes por para con sin los las del de la el en un una unos unas hay es son fue y o se lo le les al mi me te su sus ya no si sí".split(" "));

/** Búsqueda de texto completo en español (Postgres FTS), con alternativa por coincidencia parcial. */
export async function searchMessages(
  ctx: Ctx,
  query: string,
  opts: { conversationId?: string; from?: string; to?: string; limit?: number } = {},
): Promise<SearchHit[]> {
  assertCan(ctx, "data.read");
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  const terms = q
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  // OR entre términos significativos: mejor recall para preguntas en lenguaje natural.
  const tsq = terms.length ? terms.map((t) => t.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean).join(" or ") : q;
  const params: unknown[] = [ctx.companyId, tsq, `%${q}%`];
  const where: string[] = [];
  if (opts.conversationId) { params.push(opts.conversationId); where.push(`m.conversation_id = $${params.length}`); }
  if (opts.from) { params.push(opts.from); where.push(`m.sent_at >= $${params.length}::date`); }
  if (opts.to) { params.push(opts.to); where.push(`m.sent_at < ($${params.length}::date + 1)`); }
  params.push(Math.min(opts.limit ?? 30, 100));
  const r = await ctx.db.query<SearchHit>(
    `select m.id, m.conversation_id, c.title as conversation_title, ${SENT_AT} as sent_at, m.author_label, m.body,
       m.source_line, i.file_name, ts_rank(m.search, websearch_to_tsquery('spanish', $2)) as rank
     from messages m join conversations c on c.id = m.conversation_id join imports i on i.id = m.import_id
     where m.company_id = $1 and m.kind = 'text'
       and (m.search @@ websearch_to_tsquery('spanish', $2) or m.body ilike $3)
       ${where.length ? "and " + where.join(" and ") : ""}
     order by rank desc, m.sent_at desc limit $${params.length}`,
    params,
  );
  return r.rows;
}

export interface AskResult {
  mode: "ai" | "retrieval_only";
  answer: string | null;
  insufficient: boolean;
  citations: (SearchHit & { quote: string })[];
  sources: SearchHit[];
  notice: string | null;
}

/**
 * Consulta en lenguaje natural. Recupera mensajes relevantes y, si la IA está disponible,
 * pide una respuesta con citas. Las citas que no coinciden con un mensaje real se descartan.
 */
export async function askQuestion(ctx: Ctx, question: string): Promise<AskResult> {
  assertCan(ctx, "data.read");
  const sources = await searchMessages(ctx, question, { limit: 40 });
  const company = await ctx.db.query<{ settings: unknown }>(`select settings from companies where id = $1`, [ctx.companyId]);
  const privacy = readPrivacy(company.rows[0]?.settings);
  const { claudeAvailable, askClaude } = await import("../analysis/claude");

  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "search.ask", metadata: { sources: sources.length } });

  if (!sources.length) {
    return { mode: "retrieval_only", answer: null, insufficient: true, citations: [], sources, notice: "No hay mensajes que coincidan con la consulta." };
  }
  if (!claudeAvailable() || !privacy.ai_enabled) {
    return {
      mode: "retrieval_only", answer: null, insufficient: false, citations: [], sources,
      notice: !privacy.ai_enabled
        ? "La IA está desactivada para esta empresa. Se muestran los mensajes más relevantes."
        : "La IA no está configurada en el servidor. Se muestran los mensajes más relevantes, sin respuesta generada.",
    };
  }
  const result = await askClaude(question, sources.map((s) => ({ ...s, conversation: s.conversation_title })));
  const byId = new Map(sources.map((s) => [s.id, s]));
  const citations = result.citations
    .filter((c) => byId.has(c.message_id) && quoteMatches(c.quote, byId.get(c.message_id)!.body))
    .map((c) => ({ ...byId.get(c.message_id)!, quote: c.quote }));
  const dropped = result.citations.length - citations.length;
  const unsupported = !result.insufficient && citations.length === 0;
  return {
    mode: "ai",
    answer: unsupported ? null : result.answer,
    insufficient: result.insufficient || unsupported,
    citations,
    sources,
    notice: unsupported
      ? "La respuesta generada no pudo respaldarse con citas verificables y se ocultó."
      : dropped > 0 ? `${dropped} cita(s) no verificables fueron descartadas.` : null,
  };
}
