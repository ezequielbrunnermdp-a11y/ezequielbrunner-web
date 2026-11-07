import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CircleDashed, CircleDot, HelpCircle, Minus, XCircle } from "lucide-react";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type TaskStatus } from "@/lib/tasks/transitions";
import { FINDING_LABELS, type FindingType } from "@/lib/analysis/types";
import { Badge, type Tone } from "./ui";

const STATUS_TONE: Record<TaskStatus, Tone> = {
  pending: "info",
  in_progress: "accent",
  done: "ok",
  discarded: "neutral",
  insufficient_info: "warn",
};
const STATUS_ICON = { pending: CircleDashed, in_progress: CircleDot, done: CheckCircle2, discarded: XCircle, insufficient_info: HelpCircle };

export function StatusBadge({ status }: { status: TaskStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon className="size-3" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, [Tone, typeof ArrowUp]> = {
    urgent: ["danger", AlertTriangle],
    high: ["warn", ArrowUp],
    medium: ["neutral", Minus],
    low: ["neutral", ArrowDown],
  };
  const [tone, Icon] = map[priority];
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden />
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

const TYPE_TONE: Record<FindingType, Tone> = {
  task: "accent",
  request: "info",
  commitment: "violet",
  decision: "ok",
  incident: "danger",
  completion_signal: "ok",
};
export function FindingTypeBadge({ type }: { type: FindingType }) {
  return <Badge tone={TYPE_TONE[type]} dot>{FINDING_LABELS[type]}</Badge>;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2024-03-12" → "12 mar"; con hora si viene "AAAA-MM-DDTHH:MM". Sin conversión de zona. */
export function fmtLocal(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "—";
  const [d, t] = iso.split("T");
  const [y, m, day] = d.split("-");
  const base = `${Number(day)} ${MONTHS[Number(m) - 1]}${withYear ? ` ${y}` : ""}`;
  return t ? `${base}, ${t.slice(0, 5)}` : base;
}

/** Fecha/hora de eventos del sistema (timestamptz) en la zona de la plataforma. */
export function fmtInstant(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: process.env.NEXO_TIMEZONE || "America/Argentina/Buenos_Aires" });
}

export function DueLabel({ due, status, today }: { due: string | null; status: TaskStatus; today: string }) {
  if (!due) return <span className="text-faint">Sin fecha</span>;
  const open = status === "pending" || status === "in_progress";
  if (open && due < today) return <span className="font-medium text-danger">Vencida · {fmtLocal(due)}</span>;
  if (open && due === today) return <span className="font-medium text-warn">Hoy</span>;
  return <span className="text-muted">{fmtLocal(due)}</span>;
}

export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: process.env.NEXO_TIMEZONE || "America/Argentina/Buenos_Aires" });
}
