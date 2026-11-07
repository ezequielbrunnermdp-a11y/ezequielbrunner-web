export const FINDING_TYPES = ["task", "request", "commitment", "decision", "incident", "completion_signal"] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const FINDING_LABELS: Record<FindingType, string> = {
  task: "Orden / tarea",
  request: "Solicitud",
  commitment: "Compromiso",
  decision: "Decisión",
  incident: "Incidencia",
  completion_signal: "Posible cumplimiento",
};

export type Engine = "claude" | "heuristic";

/** Mensaje tal como lo ve un motor de análisis. */
export interface AnalysisMessage {
  id: string;
  sent_at: string; // AAAA-MM-DDTHH:MM:SS
  author_label: string | null;
  body: string;
}

export interface AnalysisContext {
  conversationTitle: string;
  branches: { id: string; name: string }[];
  participants: string[];
}

export interface CandidateFinding {
  type: FindingType;
  title: string;
  description: string | null;
  assignee_label: string | null;
  due_hint: string | null;
  due_date: string | null;
  branch_name: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  confidence: number;
  rationale: string | null;
  evidence: { message_id: string; quote: string }[];
}
