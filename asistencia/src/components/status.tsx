import { Badge, type Tone } from "./ui";
import { STATUS_LABEL, type DayStatus } from "@/lib/attendance";

const TONE: Record<DayStatus, Tone> = {
  present: "green", finished: "blue", scheduled: "gray", missing: "amber", absent: "red", incomplete: "amber",
  on_leave: "violet", not_scheduled: "gray", unscheduled: "blue",
};
export function StatusBadge({ status, leaveType }: { status: DayStatus; leaveType?: string }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}{status === "on_leave" && leaveType ? ` · ${leaveType.replace("_", " ")}` : ""}</Badge>;
}

export const SOURCE_LABEL: Record<string, string> = { mobile: "Celular (GPS + QR)", terminal: "Terminal del local", correction: "Corrección administrativa" };
export function SourceBadge({ source, voided }: { source: string; voided?: boolean }) {
  if (voided) return <Badge tone="red">Anulada</Badge>;
  return <Badge tone={source === "correction" ? "amber" : source === "terminal" ? "violet" : "gray"}>{SOURCE_LABEL[source] ?? source}</Badge>;
}
