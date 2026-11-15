"use client";
import { useEffect, useRef, useState } from "react";
import { CitedMarkdown, CitasList } from "./CitedMarkdown";
import { postSSE } from "./sse";
import type { Cita } from "./types";
import { PERSPECTIVAS, type Perspectiva } from "@/lib/taxonomy";

type Msg = { id?: number; role: "user" | "assistant"; markdown: string; citas: Cita[]; perspectiva?: string | null };

const SUGERENCIAS = [
  "Resumime todo el expediente desde el inicio.",
  "¿Qué reclama el actor y cuánto dinero solicita?",
  "¿Qué argumentos utilizó la parte demandada?",
  "Analizá todas las declaraciones testimoniales. ¿Hay contradicciones?",
  "¿Qué argumentos de la demanda no fueron contestados?",
  "¿Qué decidió el juez y cómo fundamentó su sentencia?",
  "Identificá errores procesales o argumentos jurídicos discutibles.",
  "Explicame este caso como si lo estudiara para un examen de Derecho.",
];

export function ChatPanel({ caseId, onCita, expanded, onToggleExpand }: { caseId: string; onCita: (c: Cita) => void; expanded: boolean; onToggleExpand: () => void }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [perspectiva, setPerspectiva] = useState<Perspectiva>("neutral");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function load(tid?: string | null) {
    const r = await fetch(`/api/cases/${caseId}/chat${tid ? `?thread=${tid}` : ""}`);
    if (!r.ok) return;
    const j = await r.json();
    setThreadId(j.threadId);
    setThreads(j.threads);
    setMessages(j.messages);
  }
  useEffect(() => { load(); }, [caseId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming, status]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError("");
    setBusy(true);
    setInput("");
    setStreaming("");
    setMessages((m) => [...m, { role: "user", markdown: text, citas: [], perspectiva }]);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await postSSE(`/api/cases/${caseId}/chat`, { threadId, pregunta: text, perspectiva }, (ev, data) => {
        if (ev === "thread") setThreadId(data.threadId);
        else if (ev === "delta") setStreaming((s) => s + data.text);
        else if (ev === "status") { setStatus(data.text); setStreaming(""); }
        else if (ev === "message") { setStreaming(""); setMessages((m) => [...m, { role: "assistant", markdown: data.markdown, citas: data.citas }]); }
        else if (ev === "stop" && data.reason === "refusal") setError("El modelo declinó responder esta consulta.");
        else if (ev === "stop" && data.reason === "max_rounds") setError("Se alcanzó el límite de búsquedas en este turno; reformule o pida continuar.");
        else if (ev === "error") setError(data.message);
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus("");
      setStreaming("");
      load(threadId);
    }
  }

  async function nuevaConversacion() {
    const r = await fetch(`/api/cases/${caseId}/chat/threads`, { method: "POST" });
    const j = await r.json();
    await load(j.threadId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="text-sm font-semibold text-white">Chat con Claude</span>
        <select className="ml-auto rounded border border-ink-700 bg-ink-850 px-2 py-1 text-xs" value={perspectiva} onChange={(e) => setPerspectiva(e.target.value as Perspectiva)} title="Perspectiva del análisis">
          {Object.entries(PERSPECTIVAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="max-w-36 rounded border border-ink-700 bg-ink-850 px-2 py-1 text-xs" value={threadId ?? ""} onChange={(e) => load(e.target.value)} title="Conversaciones">
          {threads.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button onClick={nuevaConversacion} className="rounded border border-ink-600 px-2 py-1 text-xs hover:border-gold-500" title="Nueva conversación">Nueva</button>
        <button onClick={onToggleExpand} className="rounded border border-ink-600 px-2 py-1 text-xs hover:border-gold-500">{expanded ? "Contraer" : "Pantalla completa"}</button>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 scroll-thin ${expanded ? "mx-auto w-full max-w-4xl" : ""}`}>
        {messages.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="text-sm text-ink-400">Pregunte en lenguaje natural sobre cualquier aspecto de la causa. Cada afirmación lleva cita al documento y página; las citas en rojo no pudieron verificarse.</p>
            {SUGERENCIAS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-md border border-ink-700 px-3 py-2 text-left text-sm text-ink-300 hover:border-gold-500 hover:text-white">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`mb-4 ${m.role === "user" ? "flex justify-end" : ""}`}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-lg bg-ink-700 px-3 py-2 text-sm text-white">
                {m.perspectiva && m.perspectiva !== "neutral" && <div className="mb-1 text-[10px] uppercase tracking-wider text-gold-400">{PERSPECTIVAS[m.perspectiva as Perspectiva]}</div>}
                <div className="whitespace-pre-wrap">{m.markdown}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-ink-700 bg-ink-850 px-4 py-3">
                <CitedMarkdown markdown={m.markdown} citas={m.citas} onCita={onCita} />
                <CitasList citas={m.citas} onCita={onCita} />
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mb-4 rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 text-sm">
            {status && <div className="mb-1 text-xs text-gold-400">⟳ {status}</div>}
            {streaming ? <div className="whitespace-pre-wrap text-ink-300">{streaming}</div> : <div className="text-ink-400">Analizando el expediente…</div>}
          </div>
        )}
        {error && <div className="mb-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className={`border-t border-ink-700 p-3 ${expanded ? "mx-auto w-full max-w-4xl" : ""}`}>
        <textarea
          className="h-20 w-full resize-none rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-gold-500"
          placeholder="Escriba su pregunta sobre la causa… (Enter para enviar, Shift+Enter nueva línea)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
          <span>Respuestas basadas solo en la documentación incorporada. No reemplazan el criterio profesional.</span>
          {busy ? <button type="button" onClick={() => abortRef.current?.abort()} className="rounded border border-ink-600 px-3 py-1 text-xs">Detener</button>
            : <button className="rounded bg-gold-500 px-3 py-1 text-xs font-semibold text-ink-950 hover:bg-gold-400">Enviar</button>}
        </div>
      </form>
    </div>
  );
}
