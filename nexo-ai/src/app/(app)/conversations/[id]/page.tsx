import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert, Sparkles, Cpu, Image as ImageIcon, Trash2, Info } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { claudeAvailable } from "@/lib/analysis/claude";
import { getPrivacy } from "@/lib/admin/service";
import { SENT_AT } from "@/lib/tasks/service";
import { Badge, Card, CardHeader, cx, Input, Label, Notice, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { fmtInstant, fmtLocal } from "@/components/labels";
import { deleteConversationAction, runAnalysisAction, updateConversationAction } from "../../../actions/work";

export const metadata: Metadata = { title: "Conversación" };
const PAGE = 150;

interface Msg {
  id: string;
  sent_at: string;
  author_label: string | null;
  body: string;
  kind: "text" | "media" | "system" | "deleted";
  edited: boolean;
  suspicious: boolean;
  source_line: number;
  file_name: string;
  analyzed: boolean;
}

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; m?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx("data.read");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const conv = (await ctx.db.query<{ id: string; title: string; kind: string; branch_id: string | null; branch: string | null; created_at: string }>(
    `select c.id, c.title, c.kind, c.branch_id, b.name as branch, c.created_at from conversations c left join branches b on b.id = c.branch_id where c.id = $1 and c.company_id = $2`,
    [id, ctx.companyId],
  )).rows[0];
  if (!conv) notFound();

  const stats = (await ctx.db.query<{ total: number; text: number; unanalyzed: number; suspicious: number; first: string; last: string }>(
    `select count(*)::int total, count(*) filter (where kind = 'text')::int text,
       count(*) filter (where kind = 'text' and analyzed_at is null)::int unanalyzed,
       count(*) filter (where suspicious)::int suspicious,
       to_char(min(sent_at), 'YYYY-MM-DD"T"HH24:MI') first, to_char(max(sent_at), 'YYYY-MM-DD"T"HH24:MI') last
     from messages where conversation_id = $1 and company_id = $2`,
    [id, ctx.companyId],
  )).rows[0];

  let page = Math.max(1, Number(sp.page) || 1);
  if (sp.m && /^[0-9a-f-]{36}$/i.test(sp.m)) {
    const r = await ctx.db.query<{ n: number }>(
      `select count(*)::int n from messages m, (select sent_at, source_line from messages where id = $3 and company_id = $2) t
       where m.conversation_id = $1 and m.company_id = $2 and (m.sent_at, m.source_line) < (t.sent_at, t.source_line)`,
      [id, ctx.companyId, sp.m],
    );
    page = Math.floor((r.rows[0]?.n ?? 0) / PAGE) + 1;
  }
  const pages = Math.max(1, Math.ceil(stats.total / PAGE));
  page = Math.min(page, pages);

  const [messages, branches, runs, privacy] = await Promise.all([
    ctx.db.query<Msg>(
      `select m.id, ${SENT_AT} as sent_at, m.author_label, m.body, m.kind, m.edited, m.suspicious, m.source_line, i.file_name, m.analyzed_at is not null as analyzed
       from messages m join imports i on i.id = m.import_id
       where m.conversation_id = $1 and m.company_id = $2 order by m.sent_at, m.source_line limit ${PAGE} offset ${(page - 1) * PAGE}`,
      [id, ctx.companyId],
    ),
    ctx.db.query<{ id: string; name: string }>(`select id, name from branches where company_id = $1 order by name`, [ctx.companyId]),
    ctx.db.query<{ id: string; engine: string; status: string; messages_analyzed: number; findings_created: number; outputs_rejected: number; error: string | null; created_at: string }>(
      `select id, engine, status, messages_analyzed, findings_created, outputs_rejected, error, created_at from analysis_runs
       where conversation_id = $1 and company_id = $2 order by created_at desc limit 5`,
      [id, ctx.companyId],
    ),
    getPrivacy(ctx),
  ]);
  const ai = claudeAvailable() && privacy.ai_enabled;
  let lastDay = "";

  return (
    <>
      <PageHeader
        eyebrow={conv.kind === "group" ? "Grupo" : "Conversación individual"}
        title={conv.title}
        description={`${stats.total} mensajes · ${fmtLocal(stats.first, true)} → ${fmtLocal(stats.last, true)}${conv.branch ? ` · ${conv.branch}` : ""}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Mensajes" description="Hora local del dispositivo que exportó el chat. Pasá el cursor por la línea para ver la procedencia." />
          <ol className="max-h-[75vh] overflow-y-auto px-3 py-3 sm:px-5" aria-label="Mensajes de la conversación">
            {messages.rows.map((m) => {
              const day = m.sent_at.slice(0, 10);
              const header = day !== lastDay;
              lastDay = day;
              const target = sp.m === m.id;
              return (
                <li key={m.id} id={`m-${m.id}`} className="scroll-mt-24">
                  {header && (
                    <div className="sticky top-0 z-10 my-3 flex justify-center">
                      <span className="rounded-full bg-surface-3/90 px-3 py-1 text-[11px] text-muted backdrop-blur">{fmtLocal(day, true)}</span>
                    </div>
                  )}
                  {m.kind === "system" ? (
                    <p className="my-2 text-center text-xs italic text-faint">{m.body}</p>
                  ) : (
                    <div className={cx("group rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.025]", target && "msg-target ring-1 ring-accent/40")}>
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="font-semibold text-fg">{m.author_label ?? "—"}</span>
                        <span className="text-faint tabular">{m.sent_at.slice(11, 16)}</span>
                        {m.edited && <span className="text-faint">· editado</span>}
                        <span className="ml-auto hidden font-mono text-[10px] text-faint group-hover:inline" title={`${m.file_name}, línea ${m.source_line}`}>
                          {m.file_name.slice(0, 28)}{m.file_name.length > 28 ? "…" : ""}:{m.source_line}
                        </span>
                      </div>
                      {m.kind === "media" ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted"><ImageIcon className="size-3.5" />Adjunto no importado</p>
                      ) : m.kind === "deleted" ? (
                        <p className="mt-1 text-sm italic text-faint">Mensaje eliminado</p>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/90">{m.body}</p>
                      )}
                      {m.suspicious && (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-warn">
                          <ShieldAlert className="size-3.5" />Contiene posibles instrucciones para la IA. Se trata sólo como texto.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {pages > 1 && (
            <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted" aria-label="Paginación">
              {page > 1 ? <Link className="hover:text-accent" href={`?page=${page - 1}`}>← Anteriores</Link> : <span />}
              <span className="tabular">Página {page} de {pages}</span>
              {page < pages ? <Link className="hover:text-accent" href={`?page=${page + 1}`}>Siguientes →</Link> : <span />}
            </nav>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Análisis" description={`${stats.unanalyzed} de ${stats.text} mensajes de texto sin analizar`} />
            <div className="p-5">
              {can(ctx.role, "analysis.run") ? (
                <ActionForm action={runAnalysisAction} className="grid gap-4">
                  <input type="hidden" name="conversation_id" value={conv.id} />
                  <fieldset className="grid gap-2">
                    <legend className="mb-1.5 text-xs font-medium text-muted">Motor</legend>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset ring-white/10 has-[:checked]:bg-accent/[0.06] has-[:checked]:ring-accent/40">
                      <input type="radio" name="engine" value="claude" defaultChecked={ai} disabled={!ai} className="mt-1 accent-[#5EEAD4]" />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-3.5 text-accent" />IA (Claude)</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {ai ? "Detecta órdenes, compromisos, decisiones, incidencias y cumplimientos con citas verificadas."
                            : !privacy.ai_enabled ? "Desactivada en la configuración de privacidad de la empresa."
                            : "No disponible: falta configurar ANTHROPIC_API_KEY en el servidor."}
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset ring-white/10 has-[:checked]:bg-accent/[0.06] has-[:checked]:ring-accent/40">
                      <input type="radio" name="engine" value="heuristic" defaultChecked={!ai} className="mt-1 accent-[#5EEAD4]" />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-medium"><Cpu className="size-3.5 text-muted" />Reglas locales</span>
                        <span className="mt-0.5 block text-xs text-muted">Patrones de lenguaje, sin enviar datos afuera. Menor precisión.</span>
                      </span>
                    </label>
                  </fieldset>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="reanalyze" className="accent-[#5EEAD4]" /> Reanalizar todo el historial (sin duplicar hallazgos)
                  </label>
                  <SubmitButton pendingLabel="Analizando…">Analizar</SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-sm text-muted">Tu rol no permite ejecutar análisis.</p>
              )}
              {stats.suspicious > 0 && (
                <div className="mt-4"><Notice tone="warn" title={`${stats.suspicious} mensaje(s) sospechoso(s)`}>Contienen texto que intenta dar instrucciones a la IA. Se analizan sólo como datos y ningún resultado se confirma sin validación.</Notice></div>
              )}
              {runs.rows.length > 0 && (
                <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs">
                  {runs.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{fmtInstant(r.created_at)} · {r.engine === "claude" ? "IA" : "Reglas"}</span>
                      {r.status === "failed" ? (
                        <Badge tone="danger">Falló</Badge>
                      ) : (
                        <span className="tabular text-fg">{r.findings_created} hallazgos{r.outputs_rejected ? <span className="text-faint"> · {r.outputs_rejected} sin evidencia</span> : null}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {can(ctx.role, "imports.create") && (
            <Card>
              <CardHeader title="Datos de la conversación" />
              <ActionForm action={updateConversationAction} className="grid gap-3 p-5">
                <input type="hidden" name="conversation_id" value={conv.id} />
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" defaultValue={conv.title} required />
                </div>
                <div>
                  <Label htmlFor="branch_id">Sucursal</Label>
                  <Select id="branch_id" name="branch_id" defaultValue={conv.branch_id ?? ""}>
                    <option value="">Varias / sin sucursal</option>
                    {branches.rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </div>
                <SubmitButton variant="secondary" size="sm">Guardar</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {can(ctx.role, "imports.delete") && (
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Trash2 className="size-3.5 text-danger" />Eliminar conversación</p>
              <p className="mt-1 text-xs text-muted">Borra mensajes, importaciones y hallazgos. Las tareas ya validadas se conservan sin el vínculo.</p>
              <ActionForm action={deleteConversationAction} className="mt-3">
                <input type="hidden" name="conversation_id" value={conv.id} />
                <SubmitButton variant="danger" size="sm" confirm={`¿Eliminar "${conv.title}" y todos sus mensajes? No se puede deshacer.`}>Eliminar definitivamente</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-faint">
            <Info className="mt-0.5 size-3 shrink-0" />La línea original de cada mensaje se guarda cifrada para auditoría; el texto visible respeta el enmascaramiento de datos personales.
          </p>
        </div>
      </div>
    </>
  );
}
