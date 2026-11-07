export const TASK_STATUSES = ["pending", "in_progress", "done", "discarded", "insufficient_info"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Cumplida",
  discarded: "Descartada",
  insufficient_info: "Sin información suficiente",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "done", "discarded", "insufficient_info"],
  in_progress: ["pending", "done", "discarded", "insufficient_info"],
  insufficient_info: ["pending", "in_progress", "done", "discarded"],
  done: ["pending"],
  discarded: ["pending"],
};

export interface TransitionInput {
  from: TaskStatus;
  to: TaskStatus;
  note?: string | null;
  evidenceMessageId?: string | null;
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/**
 * Reglas de seguimiento:
 *  - Sólo transiciones permitidas.
 *  - "Cumplida" exige evidencia (mensaje citado) o una nota de quien valida.
 *  - Descartar o reabrir exige un motivo.
 */
export function checkTransition(t: TransitionInput): TransitionCheck {
  if (t.from === t.to) return { ok: false, reason: "La tarea ya está en ese estado." };
  if (!ALLOWED[t.from].includes(t.to)) {
    return { ok: false, reason: `No se puede pasar de "${STATUS_LABELS[t.from]}" a "${STATUS_LABELS[t.to]}".` };
  }
  const note = t.note?.trim();
  if (t.to === "done" && !note && !t.evidenceMessageId) {
    return { ok: false, reason: "Para marcarla cumplida indicá la evidencia o una nota de validación." };
  }
  if (t.to === "discarded" && !note) return { ok: false, reason: "Indicá el motivo del descarte." };
  if ((t.from === "done" || t.from === "discarded") && !note) return { ok: false, reason: "Indicá por qué se reabre." };
  return { ok: true };
}

export function allowedTargets(from: TaskStatus): TaskStatus[] {
  return ALLOWED[from];
}

/** Vencida = no cerrada y con fecha límite anterior a hoy. */
export function isOverdue(status: TaskStatus, dueDate: string | null, today: string): boolean {
  return !!dueDate && (status === "pending" || status === "in_progress") && dueDate < today;
}
