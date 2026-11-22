import Link from "next/link";
import type { Metadata } from "next";
import { AlertOctagon, ArrowRight, CalendarClock, CheckCheck, Inbox, ListChecks, MessagesSquare, Upload, Zap } from "lucide-react";
import { requireCtx, getWorkspace } from "@/lib/auth/session";
import { getDashboard } from "@/lib/dashboard";
import { STATUS_LABELS, type TaskStatus } from "@/lib/tasks/transitions";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat } from "@/components/ui";
import { ActivityBars, SERIES, StackedBars } from "@/components/charts";
import { DueLabel, fmtInstant, PriorityBadge, todayLocal } from "@/components/labels";

export const metadata: Metadata = { title: "Panel" };

const FEED_LABEL: Record<string, string> = {
  created: "Tarea creada",
  validated: "Validada desde un hallazgo",
  pending: "Reabierta / pendiente",
  in_progress: "En curso",
  done: "Cumplida",
  discarded: "Descartada",
  insufficient_info: "Sin información suficiente",
};

export default async function Dashboard() {
  const ctx = await requireCtx("data.read");
  const ws = await getWorkspace();
  const { kpi, activity, byBranch, attention, feed } = await getDashboard(ctx);
  const today = todayLocal();
  const hello = new Date().getHours() < 13 ? "Buen día" : new Date().getHours() < 20 ? "Buenas tardes" : "Buenas noches";

  if (kpi.conversations === 0) {
    return (
      <>
        <PageHeader eyebrow={ws.active?.name} title={`${hello}, ${ws.user.name.split(" ")[0]}`} />
        <Card>
          <EmptyState
            icon={<Upload className="size-5" />}
            title="Todavía no hay conversaciones"
            action={<LinkButton href="/imports" variant="primary">Importar un chat de WhatsApp</LinkButton>}
          >
            Exportá un chat desde WhatsApp (Más opciones → Exportar chat) e importalo. NEXO lo procesa y propone tareas, decisiones e incidencias para que las valides.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={ws.active?.name}
        title={`${hello}, ${ws.user.name.split(" ")[0]}`}
        description="Estado operativo actual. Sólo se cuentan tareas validadas por personas."
        actions={
          kpi.inbox > 0 ? (
            <LinkButton href="/inbox" variant="primary"><Inbox className="size-4" />Validar {kpi.inbox} hallazgo{kpi.inbox === 1 ? "" : "s"}</LinkButton>
          ) : (
            <LinkButton href="/imports"><Upload className="size-4" />Importar chat</LinkButton>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:animate-fade-up">
        <Stat label="Tareas abiertas" value={kpi.open} icon={<ListChecks className="size-4" />} hint={`${kpi.urgent} urgente${kpi.urgent === 1 ? "" : "s"}`} />
        <Stat label="Vencidas" value={kpi.overdue} tone={kpi.overdue ? "danger" : "neutral"} icon={<AlertOctagon className="size-4" />} hint={`${kpi.today} vencen hoy`} />
        <Stat label="Cumplidas (7 días)" value={kpi.done7} tone="ok" icon={<CheckCheck className="size-4" />} hint="con evidencia o validación" />
        <Stat label="Por validar" value={kpi.inbox} tone={kpi.inbox ? "accent" : "neutral"} icon={<Inbox className="size-4" />} hint="hallazgos propuestos" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 animate-fade-up">
          <CardHeader title="Mensajes por día" description={`Últimos 30 días · ${kpi.messages} mensajes en ${kpi.conversations} conversaciones`} />
          <div className="px-5 pb-5 pt-8">
            <ActivityBars data={activity.map((a) => ({ day: a.day, value: a.messages }))} label="Mensajes por día, últimos 30 días" />
          </div>
        </Card>

        <Card className="min-w-0 animate-fade-up">
          <CardHeader title="Tareas abiertas por sucursal" action={<Link href="/tasks" className="text-xs text-muted hover:text-accent">Ver todas</Link>} />
          <div className="p-5">
            {byBranch.length ? (
              <StackedBars
                caption="Tareas abiertas por sucursal y estado"
                rows={byBranch.map((b) => ({
                  label: b.branch,
                  note: b.overdue ? `${b.overdue} vencida${b.overdue === 1 ? "" : "s"}` : undefined,
                  segments: [
                    { key: "pending", label: STATUS_LABELS.pending, value: b.pending, color: SERIES.blue },
                    { key: "in_progress", label: STATUS_LABELS.in_progress, value: b.in_progress, color: SERIES.orange },
                    { key: "insufficient_info", label: STATUS_LABELS.insufficient_info, value: b.insufficient_info, color: SERIES.aqua },
                  ],
                }))}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted">No hay tareas abiertas.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 animate-fade-up">
          <CardHeader title="Requiere atención" description="Vencidas, urgentes o que vencen en las próximas 48 h" />
          {attention.length ? (
            <ul className="divide-y divide-line">
              {attention.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.025]">
                    <Zap className="size-4 shrink-0 text-faint" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{t.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[t.branch, t.assignee_label].filter(Boolean).join(" · ") || "Sin sucursal ni responsable"}
                      </p>
                    </div>
                    <div className="hidden shrink-0 sm:block"><PriorityBadge priority={t.priority as never} /></div>
                    <div className="w-24 shrink-0 text-right text-xs"><DueLabel due={t.due_date} status={t.status as TaskStatus} today={today} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<CalendarClock className="size-5" />} title="Nada urgente">No hay tareas vencidas ni urgentes.</EmptyState>
          )}
        </Card>

        <Card className="min-w-0 animate-fade-up">
          <CardHeader title="Novedades" description="Actividad reciente" />
          {feed.length ? (
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
              {feed.map((f, i) => (
                <li key={i} className="relative flex gap-3 py-2">
                  <span className="relative z-10 mt-1 grid size-[15px] shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line-strong">
                    <span className={`size-[5px] rounded-full ${f.kind === "import" ? "bg-info" : f.kind === "decision" ? "bg-ok" : f.detail === "done" ? "bg-ok" : "bg-accent"}`} />
                  </span>
                  <Link href={f.href} className="min-w-0 flex-1 hover:text-accent">
                    <p className="truncate text-[13px] text-fg">{f.title}</p>
                    <p className="text-xs text-muted">
                      {f.kind === "import" ? (
                        <><MessagesSquare className="mr-1 inline size-3" aria-hidden />Importación · {f.detail} mensajes nuevos</>
                      ) : f.kind === "decision" ? "Decisión validada" : FEED_LABEL[f.detail ?? ""] ?? f.detail}
                      <span className="text-faint"> · {fmtInstant(f.at)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-8 text-center text-sm text-muted">Sin actividad todavía.</p>
          )}
          <div className="border-t border-line px-5 py-3">
            <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent">Ver reportes <ArrowRight className="size-3" /></Link>
          </div>
        </Card>
      </div>
    </>
  );
}
