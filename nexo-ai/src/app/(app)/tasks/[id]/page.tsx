import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Quote as QuoteIcon } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getTask, SENT_AT } from "@/lib/tasks/service";
import { allowedTargets, STATUS_LABELS } from "@/lib/tasks/transitions";
import { Card, CardHeader, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { TaskFields } from "@/components/task-fields";
import { DueLabel, fmtInstant, fmtLocal, PriorityBadge, StatusBadge, todayLocal } from "@/components/labels";
import { HighlightedQuote } from "@/components/quote";
import { changeStatusAction, updateTaskAction } from "../../../actions/work";

export const metadata: Metadata = { title: "Tarea" };

const EVENT_LABEL: Record<string, string> = {
  created: "Creada manualmente",
  created_from_finding: "Creada al validar un hallazgo",
  edited: "Editada",
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireCtx("data.read");
  const data = await getTask(ctx, id);
  if (!data) notFound();
  const { task: t, events, evidence } = data;
  const canWrite = can(ctx.role, "tasks.write");
  const [branches, recent] = await Promise.all([
    ctx.db.query<{ id: string; name: string }>(`select id, name from branches where company_id = $1 order by name`, [ctx.companyId]),
    t.conversation_id
      ? ctx.db.query<{ id: string; sent_at: string; author_label: string | null; body: string }>(
          `select m.id, ${SENT_AT} as sent_at, m.author_label, left(m.body, 90) as body from messages m
           where m.conversation_id = $1 and m.company_id = $2 and m.kind = 'text' order by m.sent_at desc limit 40`,
          [t.conversation_id, ctx.companyId],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  const targets = allowedTargets(t.status);

  return (
    <>
      <Link href="/tasks" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3" />Tareas</Link>
      <PageHeader
        title={t.title}
        description={t.description ?? undefined}
        actions={<><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /></>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          <Card>
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted">Vence</dt><dd className="mt-1"><DueLabel due={t.due_date} status={t.status} today={todayLocal()} /></dd></div>
              <div><dt className="text-xs text-muted">Responsable</dt><dd className="mt-1 truncate">{t.assignee_label ?? <span className="text-faint">Sin asignar</span>}</dd></div>
              <div><dt className="text-xs text-muted">Sucursal</dt><dd className="mt-1 truncate">{t.branch_name ?? <span className="text-faint">—</span>}</dd></div>
              <div><dt className="text-xs text-muted">Origen</dt><dd className="mt-1">{t.source === "finding" ? "Hallazgo validado" : "Manual"}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Evidencia" description="Mensajes originales que respaldan esta tarea y su cumplimiento" />
            {evidence.length ? (
              <div className="grid gap-2 p-5">
                {evidence.map((e) => (
                  <blockquote key={e.message_id} className="rounded-xl border-l-2 border-accent/60 bg-bg/50 px-4 py-3">
                    <p className="text-xs"><span className="font-semibold">{e.author_label ?? "—"}</span> <span className="text-faint tabular">{fmtLocal(e.sent_at, true)}</span></p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg/85"><HighlightedQuote body={e.body} quote={e.quote} /></p>
                    <p className="mt-2 flex gap-3 text-[11px] text-faint">
                      <Link href={`/conversations/${e.conversation_id}?m=${e.message_id}#m-${e.message_id}`} className="text-accent/90 hover:underline">Ver en contexto</Link>
                      <span className="font-mono">{e.file_name}:{e.source_line}</span>
                    </p>
                  </blockquote>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 p-5 text-sm text-muted"><QuoteIcon className="size-4 text-faint" />Tarea manual, sin mensajes vinculados.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Historial" description="Registro inalterable de cambios" />
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
              {events.map((e) => (
                <li key={e.id} className="relative flex gap-3 py-2.5">
                  <span className="relative z-10 mt-0.5 grid size-[15px] shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line-strong">
                    <span className={`size-[5px] rounded-full ${e.to_status === "done" ? "bg-ok" : e.to_status === "discarded" ? "bg-faint" : "bg-accent"}`} />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="text-fg">
                      {e.type === "status" && e.from_status && e.to_status
                        ? <>{STATUS_LABELS[e.from_status]} → <strong className="font-medium">{STATUS_LABELS[e.to_status]}</strong></>
                        : EVENT_LABEL[e.type] ?? e.type}
                    </p>
                    {e.note && <p className="mt-0.5 text-muted">{e.note}</p>}
                    {e.evidence_message_id && <p className="mt-0.5 text-xs text-accent/90">Con mensaje de evidencia</p>}
                    <p className="mt-0.5 text-xs text-faint">{e.actor_name ?? "Usuario eliminado"} · {fmtInstant(e.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {canWrite && (
          <div className="grid content-start gap-4">
            <Card>
              <CardHeader title="Cambiar estado" />
              <ActionForm action={changeStatusAction} className="grid gap-3 p-5">
                <input type="hidden" name="task_id" value={t.id} />
                <div>
                  <Label htmlFor="to">Nuevo estado</Label>
                  <Select id="to" name="to" required defaultValue="">
                    <option value="" disabled>Elegir…</option>
                    {targets.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </Select>
                </div>
                {recent.rows.length > 0 && (
                  <div>
                    <Label htmlFor="ev" hint="opcional">Mensaje de evidencia</Label>
                    <Select id="ev" name="evidence_message_id" defaultValue="">
                      <option value="">Ninguno</option>
                      {recent.rows.map((m) => <option key={m.id} value={m.id}>{fmtLocal(m.sent_at)} · {m.author_label}: {m.body}</option>)}
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="note" hint="requerida para cerrar sin evidencia, descartar o reabrir">Nota</Label>
                  <Textarea id="note" name="note" rows={3} />
                </div>
                <SubmitButton>Actualizar estado</SubmitButton>
              </ActionForm>
            </Card>
            <Card>
              <CardHeader title="Editar" />
              <ActionForm action={updateTaskAction} className="grid gap-4 p-5">
                <input type="hidden" name="task_id" value={t.id} />
                <TaskFields branches={branches.rows} d={t} idp="edit" />
                <SubmitButton variant="secondary">Guardar cambios</SubmitButton>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
