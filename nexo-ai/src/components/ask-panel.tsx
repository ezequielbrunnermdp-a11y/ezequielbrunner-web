"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Sparkles, AlertCircle } from "lucide-react";
import { askAction, type AskState } from "@/app/actions/search";
import { Notice, Textarea } from "./ui";
import { SubmitButton } from "./forms";
import { HighlightedQuote } from "./quote";

const SUGGESTIONS = [
  "¿Qué problemas hubo con la freidora y se resolvieron?",
  "¿Qué se decidió sobre el horario de cierre?",
  "¿Qué pedidos a proveedores quedaron pendientes?",
];

const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

export function AskPanel({ aiReady }: { aiReady: boolean }) {
  const [state, action] = useActionState<AskState, FormData>(askAction, null);
  const r = state?.result;
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3">
        <label htmlFor="question" className="sr-only">Pregunta</label>
        <Textarea id="question" name="question" rows={2} defaultValue={state?.question} placeholder="Preguntá en lenguaje natural, por ejemplo: ¿quién quedó a cargo de llamar al técnico?" required />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Buscando evidencia…"><Sparkles className="size-4" />Preguntar</SubmitButton>
          {!aiReady && <span className="text-xs text-muted">IA no disponible: se mostrarán los mensajes más relevantes, sin respuesta generada.</span>}
        </div>
        {!state && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  const ta = e.currentTarget.form?.elements.namedItem("question") as HTMLTextAreaElement | null;
                  if (ta) { ta.value = s; ta.focus(); }
                }}
                className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-muted ring-1 ring-inset ring-white/10 transition hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>

      <div aria-live="polite">
        {state?.error && <Notice tone="danger">{state.error}</Notice>}
        {r && (
          <div className="grid gap-4 animate-fade-up">
            {r.answer && (
              <div className="rounded-2xl bg-accent/[0.05] p-5 ring-1 ring-inset ring-accent/20">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent"><Sparkles className="size-3" />Respuesta basada en {r.citations.length} cita{r.citations.length === 1 ? "" : "s"}</p>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{r.answer}</p>
                {r.insufficient && <p className="mt-3 flex items-center gap-1.5 text-xs text-warn"><AlertCircle className="size-3.5" />Los mensajes no alcanzan para una respuesta completa.</p>}
              </div>
            )}
            {!r.answer && r.insufficient && r.mode === "ai" && <Notice tone="warn" title="Sin información suficiente">No hay mensajes que permitan responder con respaldo.</Notice>}
            {r.notice && <Notice tone={r.mode === "ai" ? "warn" : "info"}>{r.notice}</Notice>}
            {(r.citations.length ? r.citations : r.sources.slice(0, 12)).length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-faint">{r.citations.length ? "Citas verificadas" : "Mensajes más relevantes"}</p>
                <div className="grid gap-2">
                  {(r.citations.length ? r.citations : r.sources.slice(0, 12)).map((c, i) => (
                    <blockquote key={`${c.id}-${i}`} className="rounded-xl border-l-2 border-accent/60 bg-bg/50 px-4 py-3">
                      <p className="text-xs"><span className="font-semibold">{c.author_label ?? "—"}</span> <span className="text-faint">· {c.conversation_title} · {fmt(c.sent_at)}</span></p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg/85"><HighlightedQuote body={c.body} quote={"quote" in c ? (c as { quote: string }).quote : null} /></p>
                      <Link href={`/conversations/${c.conversation_id}?m=${c.id}#m-${c.id}`} className="mt-2 inline-block text-[11px] text-accent/90 hover:underline">Ver en contexto · {c.file_name}:{c.source_line}</Link>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
