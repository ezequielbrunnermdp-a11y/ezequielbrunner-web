import { assertCan, ForbiddenError, type Ctx } from "../auth/permissions";
import { audit } from "../audit";
import { sha256 } from "../crypto";
import { readPrivacy } from "../privacy";
import { SENT_AT } from "../tasks/service";
import { analyzeHeuristic } from "./heuristics";
import type { AnalysisContext, AnalysisMessage, CandidateFinding, Engine } from "./types";
import { validateCandidates } from "./validate";

export type EngineFn = (messages: AnalysisMessage[], ctx: AnalysisContext) => Promise<CandidateFinding[]>;

export interface RunOptions {
  engine: Engine;
  /** Reanaliza también mensajes ya procesados (los hallazgos repetidos no se duplican). */
  reanalyze?: boolean;
  /** Inyectable para pruebas; por defecto el motor real. */
  engineFn?: EngineFn;
}

export interface RunSummary {
  runId: string;
  engine: Engine;
  messagesAnalyzed: number;
  findingsCreated: number;
  outputsRejected: number;
  suspiciousMessages: number;
  error: string | null;
}

const BATCH = 250;
const MAX_MESSAGES_PER_RUN = 3000;

export function findingDedupeKey(f: Pick<CandidateFinding, "type" | "evidence">): string {
  return sha256(`${f.type}|${f.evidence.map((e) => e.message_id).sort().join(",")}`);
}

export async function runAnalysis(ctx: Ctx, conversationId: string, opts: RunOptions): Promise<RunSummary> {
  assertCan(ctx, "analysis.run");
  const conv = await ctx.db.query<{ title: string; settings: unknown }>(
    `select c.title, co.settings from conversations c join companies co on co.id = c.company_id
     where c.id = $1 and c.company_id = $2`,
    [conversationId, ctx.companyId],
  );
  if (!conv.rows[0]) throw new ForbiddenError("Conversación inexistente.");
  const privacy = readPrivacy(conv.rows[0].settings);

  let engine = opts.engine;
  let engineFn = opts.engineFn;
  if (!engineFn) {
    if (engine === "claude") {
      const { analyzeWithClaude, claudeAvailable } = await import("./claude");
      if (!claudeAvailable()) throw new ForbiddenError("La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).");
      if (!privacy.ai_enabled) throw new ForbiddenError("El análisis con IA está desactivado en la configuración de privacidad.");
      engineFn = analyzeWithClaude;
    } else {
      engine = "heuristic";
      engineFn = async (m, c) => analyzeHeuristic(m, c);
    }
  }

  const run = await ctx.db.query<{ id: string }>(
    `insert into analysis_runs (company_id, conversation_id, engine, model, created_by) values ($1, $2, $3, $4, $5) returning id`,
    [ctx.companyId, conversationId, engine, engine === "claude" ? process.env.NEXO_CLAUDE_MODEL || "claude-opus-5-5" : null, ctx.userId],
  );
  const runId = run.rows[0].id;

  const msgs = await ctx.db.query<AnalysisMessage & { suspicious: boolean }>(
    `select m.id, ${SENT_AT} as sent_at, m.author_label, m.body, m.suspicious from messages m
     where m.conversation_id = $1 and m.company_id = $2 and m.kind = 'text' ${opts.reanalyze ? "" : "and m.analyzed_at is null"}
     order by m.sent_at, m.source_line limit ${MAX_MESSAGES_PER_RUN}`,
    [conversationId, ctx.companyId],
  );
  const [branches, participants] = await Promise.all([
    ctx.db.query<{ id: string; name: string }>(`select id, name from branches where company_id = $1 order by name`, [ctx.companyId]),
    ctx.db.query<{ display_name: string }>(`select display_name from participants where conversation_id = $1 and company_id = $2`, [conversationId, ctx.companyId]),
  ]);
  const actx: AnalysisContext = {
    conversationTitle: conv.rows[0].title,
    branches: branches.rows,
    participants: participants.rows.map((p) => p.display_name),
  };

  let created = 0;
  let rejected = 0;
  let error: string | null = null;
  const suspicious = msgs.rows.filter((m) => m.suspicious).length;

  try {
    for (let i = 0; i < msgs.rows.length; i += BATCH) {
      const batch = msgs.rows.slice(i, i + BATCH).map(({ suspicious: _s, ...m }) => m);
      const candidates = await engineFn(batch, actx);
      const { accepted, rejected: rej } = validateCandidates(candidates, batch, engine);
      rejected += rej.length;
      await ctx.db.tx(async (q) => {
        for (const f of accepted) {
          const branchId = f.branch_name ? actx.branches.find((b) => b.name.toLowerCase() === f.branch_name!.toLowerCase())?.id ?? null : null;
          const ins = await q.query<{ id: string }>(
            `insert into findings (company_id, conversation_id, run_id, type, title, description, assignee_label, due_hint, due_date,
               branch_id, priority, confidence, rationale, engine, dedupe_key)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             on conflict (company_id, dedupe_key) do nothing returning id`,
            [ctx.companyId, conversationId, runId, f.type, f.title, f.description, f.assignee_label, f.due_hint, f.due_date,
              branchId, f.priority, f.confidence.toFixed(2), f.rationale, engine, findingDedupeKey(f)],
          );
          if (!ins.rows[0]) continue;
          created++;
          for (const e of f.evidence) {
            await q.query(`insert into finding_evidence (finding_id, message_id, quote) values ($1, $2, $3)`, [ins.rows[0].id, e.message_id, e.quote]);
          }
        }
        const ids = batch.map((m) => m.id);
        await q.query(`update messages set analyzed_at = now() where company_id = $1 and id = any($2::uuid[])`, [ctx.companyId, ids]);
      });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido";
  }

  await ctx.db.query(
    `update analysis_runs set status = $2, messages_analyzed = $3, findings_created = $4, outputs_rejected = $5,
       suspicious_messages = $6, error = $7, finished_at = now() where id = $1`,
    [runId, error ? "failed" : "completed", msgs.rows.length, created, rejected, suspicious, error],
  );
  await audit(ctx.db, {
    companyId: ctx.companyId, actorId: ctx.userId, action: "analysis.run", targetType: "conversation", targetId: conversationId,
    metadata: { engine, run_id: runId, messages: msgs.rows.length, created, rejected, failed: Boolean(error) },
  });
  return { runId, engine, messagesAnalyzed: msgs.rows.length, findingsCreated: created, outputsRejected: rejected, suspiciousMessages: suspicious, error };
}
