import { one, query } from "./db";
import { env } from "./env";
import { sendChat } from "./chat";
import { generateReport, type ReportKind } from "./reports";
import { enrichDocument } from "./ingest";
import { buscarJurisprudencia, type JurisQuery } from "./jurisprudencia";
import type { Perspectiva } from "./taxonomy";

export type JobPayload =
  | { kind: "chat"; caseId: string; threadId: string; pregunta: string; perspectiva: Perspectiva }
  | { kind: "report"; caseId: string; userId: string; reportKind: ReportKind; perspectiva: Perspectiva }
  | { kind: "enrich"; documentIds: string[] }
  | { kind: "juris"; query: JurisQuery };

export async function createJob(userId: string, caseId: string | null, payload: JobPayload): Promise<string> {
  const row = await one<{ id: string }>("INSERT INTO jobs (user_id, case_id, kind, payload) VALUES ($1,$2,$3,$4) RETURNING id", [
    userId,
    caseId,
    payload.kind,
    JSON.stringify(payload),
  ]);
  return row!.id;
}

/**
 * Lanza la tarea. En Netlify invoca la función de segundo plano (responde 202 al instante);
 * en otros entornos la ejecuta en este mismo proceso.
 */
export async function startJob(jobId: string, origin: string): Promise<void> {
  if (env.onNetlify) {
    const res = await fetch(`${origin}/.netlify/functions/juris-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-worker-secret": env.workerSecret },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok && res.status !== 202) {
      await query("UPDATE jobs SET status='error', error=$2, updated_at=now() WHERE id=$1", [jobId, `No se pudo iniciar la tarea (${res.status})`]);
    }
    return;
  }
  void runJob(jobId).catch((e) => console.error("job", jobId, e));
}

/** Ejecuta una tarea. Idempotente: si ya fue tomada (p. ej. un reintento), no hace nada. */
export async function runJob(jobId: string): Promise<void> {
  const job = await one<{ payload: JobPayload; user_id: string }>(
    "UPDATE jobs SET status='en_curso', updated_at=now() WHERE id=$1 AND status='pendiente' RETURNING payload, user_id",
    [jobId],
  );
  if (!job) return;
  let pendingText = "";
  let progreso: string | null = null;
  let resetText = false;
  let timer: NodeJS.Timeout | null = null;
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const t = pendingText;
    const reset = resetText;
    pendingText = "";
    resetText = false;
    await query(
      `UPDATE jobs SET texto = CASE WHEN $3 THEN $2 ELSE texto || $2 END, progreso = coalesce($4, progreso), updated_at = now() WHERE id = $1`,
      [jobId, t, reset, progreso],
    );
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(() => void flush().catch(() => {}), 700);
  };
  const onEvent = async (e: { type: string; text?: string; markdown?: string; citas?: unknown }) => {
    if (e.type === "delta" && e.text) {
      pendingText += e.text;
      schedule();
    } else if (e.type === "status" && e.text) {
      progreso = e.text;
      pendingText = "";
      resetText = true;
      await flush();
    } else if (e.type === "message") {
      pendingText = "";
      resetText = true;
      await flush();
      await query("UPDATE jobs SET mensajes = mensajes || $2::jsonb, updated_at = now() WHERE id = $1", [
        jobId,
        JSON.stringify([{ markdown: e.markdown, citas: e.citas }]),
      ]);
    }
  };

  try {
    const p = job.payload;
    let result: unknown = null;
    if (p.kind === "chat") {
      const r = await sendChat({ caseId: p.caseId, threadId: p.threadId, question: p.pregunta, perspectiva: p.perspectiva, onEvent: (e) => void onEvent(e) });
      result = { stop: r.stop };
    } else if (p.kind === "report") {
      result = await generateReport({ caseId: p.caseId, userId: p.userId, kind: p.reportKind, perspectiva: p.perspectiva, onEvent: (e) => void onEvent(e) });
    } else if (p.kind === "enrich") {
      for (const [i, id] of p.documentIds.entries()) {
        progreso = `Procesando documento ${i + 1} de ${p.documentIds.length} (OCR y clasificación)…`;
        await flush();
        await enrichDocument(id);
      }
    } else if (p.kind === "juris") {
      progreso = "Buscando en fuentes oficiales…";
      await flush();
      result = await buscarJurisprudencia(p.query);
    }
    await flush();
    await query("UPDATE jobs SET status='listo', result=$2, updated_at=now() WHERE id=$1", [jobId, JSON.stringify(result)]);
  } catch (e) {
    console.error(e);
    await flush().catch(() => {});
    await query("UPDATE jobs SET status='error', error=$2, updated_at=now() WHERE id=$1", [jobId, e instanceof Error ? e.message : String(e)]);
  }
}
