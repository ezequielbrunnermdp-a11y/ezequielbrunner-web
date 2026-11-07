import { FINDING_TYPES, type AnalysisMessage, type CandidateFinding, type Engine } from "./types";

/**
 * Compuerta de trazabilidad: ningún hallazgo entra a la bandeja si no puede
 * demostrarse con los mensajes originales. Se aplica igual a la IA y a las heurísticas.
 */
export interface ValidationOutcome {
  accepted: CandidateFinding[];
  rejected: { finding: unknown; reason: string }[];
}

const MAX_CONFIDENCE: Record<Engine, number> = { claude: 0.95, heuristic: 0.6 };

// Evaluaciones de personas: el producto no genera juicios disciplinarios.
const EVALUATIVE = /\b(desempe[ñn]o (de|del)|sanci[oó]n(ar)?|amonestar|apercib|despedir|despido|evaluaci[oó]n (de|del) (empleado|personal)|es (un |una )?(vago|vaga|incompetente|irresponsable|inútil)|culpa de)\b/i;

export function normalizeForMatch(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[“”«»"]/g, '"').replace(/\s+/g, " ").trim();
}

export function quoteMatches(quote: string, body: string): boolean {
  const q = normalizeForMatch(quote).replace(/^\.{3}|\.{3}$|…/g, "").trim();
  return q.length >= 3 && normalizeForMatch(body).includes(q);
}

export function validateCandidates(
  candidates: unknown[],
  messages: AnalysisMessage[],
  engine: Engine,
): ValidationOutcome {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const accepted: CandidateFinding[] = [];
  const rejected: ValidationOutcome["rejected"] = [];

  for (const raw of candidates) {
    const c = raw as Partial<CandidateFinding>;
    const reject = (reason: string) => rejected.push({ finding: raw, reason });

    if (!c || typeof c !== "object") { reject("formato inválido"); continue; }
    if (!FINDING_TYPES.includes(c.type as never)) { reject("tipo inválido"); continue; }
    const title = (c.title ?? "").toString().trim();
    if (title.length < 3) { reject("sin título"); continue; }
    if (!Array.isArray(c.evidence) || c.evidence.length === 0) { reject("sin evidencia"); continue; }

    const evidence: CandidateFinding["evidence"] = [];
    let bad: string | null = null;
    for (const e of c.evidence) {
      const m = byId.get(e?.message_id);
      if (!m) { bad = "cita a un mensaje inexistente"; break; }
      const quote = (e.quote ?? "").toString();
      if (!quoteMatches(quote, m.body)) { bad = "la cita no coincide con el texto del mensaje"; break; }
      if (!evidence.some((x) => x.message_id === m.id)) evidence.push({ message_id: m.id, quote: quote.trim().slice(0, 500) });
    }
    if (bad) { reject(bad); continue; }

    const text = `${title} ${c.description ?? ""} ${c.rationale ?? ""}`;
    if (EVALUATIVE.test(text)) { reject("contiene una evaluación de personas"); continue; }

    const due = typeof c.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.due_date) && !Number.isNaN(Date.parse(c.due_date))
      ? c.due_date
      : null;
    const conf = Number(c.confidence);
    accepted.push({
      type: c.type!,
      title: title.slice(0, 200),
      description: c.description ? String(c.description).slice(0, 2000) : null,
      assignee_label: c.assignee_label ? String(c.assignee_label).slice(0, 120) : null,
      due_hint: c.due_hint ? String(c.due_hint).slice(0, 120) : null,
      due_date: due,
      branch_name: c.branch_name ? String(c.branch_name) : null,
      priority: ["low", "medium", "high", "urgent"].includes(c.priority as string) ? c.priority! : "medium",
      confidence: Math.max(0, Math.min(MAX_CONFIDENCE[engine], Number.isFinite(conf) ? conf : 0.3)),
      rationale: c.rationale ? String(c.rationale).slice(0, 1000) : null,
      evidence,
    });
  }
  return { accepted, rejected };
}
