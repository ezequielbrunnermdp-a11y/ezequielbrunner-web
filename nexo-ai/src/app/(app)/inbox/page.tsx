import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Cpu, Inbox, ShieldAlert, Sparkles, Quote as QuoteIcon } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listFindings, type FindingRow } from "@/lib/analysis/review";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/tasks/transitions";
import { Badge, Card, cx, EmptyState, Input, Label, LinkButton, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { FindingTypeBadge, fmtInstant, fmtLocal } from "@/components/labels";
import { HighlightedQuote } from "@/components/quote";
import { reviewFindingAction } from "../../actions/work";

export const metadata: Metadata = { title: "Validación" };

const TABS = [
  { key: "proposed", label: "Por validar" },
  { key: "approved", label: "Validados" },
  { key: "insufficient_info", label: "Sin info suficiente" },
  { key: "rejected", label: "Descartados" },
] as const;

function Confidence({ value, engine }: { value: number; engine: string }) {
  const pct = Math.round(value * 100);
  const label = pct >= 75 ? "Alta" : pct >= 50 ? "Media" : "Baja";
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted" title={`Confianza estimada ${pct}% (${engine === "claude" ? "IA" : "reglas"}). No es una certeza.`}>
      {engine === "claude" ? <Sparkles className="size-3 text-accent" aria-hidden /> : <Cpu className="size-3" aria-hidden />}
      <span>{engine === "claude" ? "IA" : "Reglas"}</span>
      <span className="relative h-1 w-14 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <span className={cx("absolute inset-y-0 left-0 rounded-full", pct >= 75 ? "bg-accent" : pct >= 50 ? "bg-info" : "bg-warn")} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular">Confianza {label.toLowerCase()} · {pct}%</span>
    </div>
  );
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "proposed") as FindingRow["status"];
  const ctx = await requireCtx("data.read");
  const canReview = can(ctx.role, "findings.review");
  const [findings, branches, openTasks, counts] = await Promise.all([
    listFindings(ctx, status, 60),
    ctx.db.query<{ id: string; name: string }>(`select id, name from branches where company_id = $1 order by name`, [ctx.companyId]),
    ctx.db.query<{ id: string; title: string; conversation_id: string | null }>(
      `select id, title, conversation_id from tasks where company_id = $1 and status in ('pending','in_progress','insufficient_info') order by created_at desc limit 200`,
      [ctx.companyId],
    ),
    ctx.db.query<{ status: string; n: number }>(`select status, count(*)::int n from findings where company_id = $1 group by status`, [ctx.companyId]),
  ]);
  const count = (k: string) => counts.rows.find((r) => r.status === k)?.n ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Bandeja de validación"
        title="Hallazgos detectados"
        description="Lo que detecta el análisis son propuestas, no hechos. Revisá la evidencia y decidí: validar, pedir más información o descartar."
      />

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface/70 p-1 ring-1 ring-inset ring-white/[0.06]" aria-label="Estado">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "proposed" ? "/inbox" : `/inbox?status=${t.key}`}
            aria-current={status === t.key ? "page" : undefined}
            className={cx("flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", status === t.key ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}
          >
            {t.label}
            <span className="tabular text-faint">{count(t.key)}</span>
          </Link>
        ))}
      </nav>

      {findings.length === 0 ? (
        <Card>
          <EmptyState
            icon={status === "proposed" ? <CheckCircle2 className="size-5" /> : <Inbox className="size-5" />}
            title={status === "proposed" ? "Bandeja al día" : "Nada por acá"}
            action={status === "proposed" && <LinkButton href="/conversations">Analizar conversaciones</LinkButton>}
          >
            {status === "proposed" ? "No hay hallazgos pendientes de validar. Analizá una conversación para detectar nuevos." : "No hay hallazgos en este estado."}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4">
          {findings.map((f) => (
            <Card key={f.id} as="article" className="animate-fade-up overflow-hidden" aria-labelledby={`f-${f.id}`}>
              <div className="grid lg:grid-cols-[1fr_380px]">
                <div className="min-w-0 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FindingTypeBadge type={f.type} />
                    <Link href={`/conversations/${f.conversation_id}`} className="text-xs text-muted hover:text-accent">{f.conversation_title}</Link>
                  </div>
                  <h2 id={`f-${f.id}`} className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{f.title}</h2>
                  {f.description && <p className="mt-1 text-sm text-muted">{f.description}</p>}
                  <div className="mt-2"><Confidence value={Number(f.confidence)} engine={f.engine} /></div>
                  {f.rationale && <p className="mt-3 text-xs leading-relaxed text-muted"><span className="text-faint">Motivo: </span>{f.rationale}</p>}

                  <div className="mt-4 grid gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-faint"><QuoteIcon className="size-3" />Evidencia</p>
                    {f.evidence.map((e) => (
                      <blockquote key={e.message_id} className="rounded-xl border-l-2 border-accent/60 bg-bg/50 px-4 py-3">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="font-semibold text-fg">{e.author_label ?? "—"}</span>
                          <span className="text-faint tabular">{fmtLocal(e.sent_at, true)}</span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/85"><HighlightedQuote body={e.body} quote={e.quote} /></p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                          <Link href={`/conversations/${f.conversation_id}?m=${e.message_id}#m-${e.message_id}`} className="text-accent/90 hover:underline">Ver en contexto</Link>
                          <span className="font-mono">{e.file_name}:{e.source_line}</span>
                          {e.suspicious && <span className="inline-flex items-center gap-1 text-warn"><ShieldAlert className="size-3" />mensaje sospechoso</span>}
                        </p>
                      </blockquote>
                    ))}
                  </div>
                </div>

                <div className="border-t border-line bg-bg/30 p-5 lg:border-l lg:border-t-0">
                  {f.status !== "proposed" ? (
                    <div className="text-sm">
                      <Badge tone={f.status === "approved" ? "ok" : f.status === "rejected" ? "neutral" : "warn"}>
                        {TABS.find((t) => t.key === f.status)?.label}
                      </Badge>
                      {f.review_note && <p className="mt-3 text-muted">“{f.review_note}”</p>}
                      {f.task_id && <Link className="mt-3 block text-accent hover:underline" href={`/tasks/${f.task_id}`}>Ver tarea →</Link>}
                      <p className="mt-3 text-xs text-faint">Detectado {fmtInstant(f.created_at)}</p>
                    </div>
                  ) : !canReview ? (
                    <p className="text-sm text-muted">Tu rol no permite validar hallazgos.</p>
                  ) : f.type === "completion_signal" ? (
                    <ActionForm action={reviewFindingAction} className="grid gap-3">
                      <input type="hidden" name="finding_id" value={f.id} />
                      <p className="text-xs leading-relaxed text-muted">Este mensaje sugiere que algo se cumplió. Si corresponde, elegí la tarea que confirma: quedará cerrada con este mensaje como evidencia.</p>
                      <div>
                        <Label htmlFor={`task-${f.id}`}>Tarea que confirma</Label>
                        <Select id={`task-${f.id}`} name="task_id" defaultValue="">
                          <option value="">Elegir…</option>
                          {openTasks.rows
                            .sort((a, b) => Number(b.conversation_id === f.conversation_id) - Number(a.conversation_id === f.conversation_id))
                            .map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`note-${f.id}`} hint="opcional">Nota</Label>
                        <Textarea id={`note-${f.id}`} name="note" rows={2} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton size="sm" name="decision" value="complete">Confirmar cumplimiento</SubmitButton>
                        <SubmitButton size="sm" variant="secondary" name="decision" value="insufficient">Sin info suficiente</SubmitButton>
                        <SubmitButton size="sm" variant="ghost" name="decision" value="reject">Descartar</SubmitButton>
                      </div>
                    </ActionForm>
                  ) : (
                    <ActionForm action={reviewFindingAction} className="grid gap-3">
                      <input type="hidden" name="finding_id" value={f.id} />
                      <div>
                        <Label htmlFor={`title-${f.id}`}>{f.type === "decision" ? "Decisión" : "Tarea"}</Label>
                        <Input id={`title-${f.id}`} name="title" defaultValue={f.title} required minLength={3} />
                      </div>
                      {f.type !== "decision" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`as-${f.id}`}>Responsable</Label>
                            <Input id={`as-${f.id}`} name="assignee_label" defaultValue={f.assignee_label ?? ""} placeholder="Sin asignar" />
                          </div>
                          <div>
                            <Label htmlFor={`due-${f.id}`} hint={f.due_hint ?? undefined}>Vence</Label>
                            <Input id={`due-${f.id}`} name="due_date" type="date" defaultValue={f.due_date ?? ""} />
                          </div>
                          <div>
                            <Label htmlFor={`pr-${f.id}`}>Prioridad</Label>
                            <Select id={`pr-${f.id}`} name="priority" defaultValue={f.priority}>
                              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor={`br-${f.id}`}>Sucursal</Label>
                            <Select id={`br-${f.id}`} name="branch_id" defaultValue={f.branch_id ?? ""}>
                              <option value="">—</option>
                              {branches.rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </Select>
                          </div>
                        </div>
                      )}
                      {f.type === "decision" && (
                        <div>
                          <Label htmlFor={`br-${f.id}`}>Sucursal</Label>
                          <Select id={`br-${f.id}`} name="branch_id" defaultValue={f.branch_id ?? ""}>
                            <option value="">Todas / no aplica</option>
                            {branches.rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label htmlFor={`note-${f.id}`} hint="opcional">Nota de revisión</Label>
                        <Textarea id={`note-${f.id}`} name="note" rows={2} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton size="sm" name="decision" value="approve">{f.type === "decision" ? "Validar decisión" : "Validar y crear tarea"}</SubmitButton>
                        <SubmitButton size="sm" variant="secondary" name="decision" value="insufficient">Sin info suficiente</SubmitButton>
                        <SubmitButton size="sm" variant="ghost" name="decision" value="reject">Descartar</SubmitButton>
                      </div>
                    </ActionForm>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
