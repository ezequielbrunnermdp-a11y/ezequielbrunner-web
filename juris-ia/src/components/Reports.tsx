"use client";
import { useEffect, useState } from "react";
import { CitedMarkdown, CitasList } from "./CitedMarkdown";
import { postSSE } from "./sse";
import type { Cita } from "./types";
import { PERSPECTIVAS, type Perspectiva } from "@/lib/taxonomy";

export type Report = { id: string; kind: string; perspectiva: string; markdown: string; citas: Cita[]; meta: { modo?: string }; created_at: string };

/** Genera un informe con streaming y lo muestra con citas. */
export function ReportRunner({
  caseId, kind, perspectiva = "neutral", label, big, onDone, onCita,
}: { caseId: string; kind: string; perspectiva?: Perspectiva; label: string; big?: boolean; onDone?: (r: Report) => void; onCita: (c: Cita) => void }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Report | null>(null);

  async function run() {
    setBusy(true); setText(""); setError(""); setResult(null); setStatus("Leyendo el expediente…");
    try {
      await postSSE(`/api/cases/${caseId}/reports`, { kind, perspectiva }, (ev, d) => {
        if (ev === "delta") setText((t) => t + d.text);
        else if (ev === "status") setStatus(d.text);
        else if (ev === "report") {
          const r: Report = { id: d.id, kind, perspectiva, markdown: d.markdown, citas: d.citas, meta: { modo: d.modo }, created_at: new Date().toISOString() };
          setResult(r); onDone?.(r);
        } else if (ev === "error") setError(d.message);
      });
    } catch (e) { setError((e as Error).message); }
    setBusy(false); setStatus("");
  }

  return (
    <div>
      <button onClick={run} disabled={busy}
        className={big ? "rounded-lg bg-gold-500 px-8 py-4 text-lg font-bold tracking-wide text-ink-950 shadow-lg hover:bg-gold-400 disabled:opacity-50" : "rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-400 disabled:opacity-50"}>
        {busy ? "Generando…" : label}
      </button>
      {busy && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850 p-4 text-sm">
          <div className="mb-2 text-xs text-gold-400">⟳ {status || "Redactando…"}</div>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-ink-300 scroll-thin">{text}</div>
        </div>
      )}
      {error && <div className="mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>}
      {result && <ReportView report={result} onCita={onCita} />}
    </div>
  );
}

export function ReportView({ report, onCita }: { report: Report; onCita: (c: Cita) => void }) {
  const noVerif = report.citas.filter((c) => c.kind === "expediente" && !c.verificada).length;
  return (
    <article className="mt-4 rounded-xl border border-ink-700 bg-ink-900 p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
        <span>{new Date(report.created_at).toLocaleString("es-AR")}</span>
        <span>Perspectiva: {PERSPECTIVAS[report.perspectiva as Perspectiva] ?? report.perspectiva}</span>
        {report.meta?.modo && <span>Lectura: {report.meta.modo === "texto_completo" ? "texto completo del expediente" : "lectura con herramientas (expediente extenso)"}</span>}
        <span>{report.citas.length} cita(s){noVerif ? ` · ${noVerif} sin verificar` : ""}</span>
        <span className="ml-auto flex gap-2">
          <a className="rounded border border-ink-600 px-2 py-1 hover:border-gold-500" href={`/api/reports/${report.id}?format=pdf`}>Exportar PDF</a>
          <a className="rounded border border-ink-600 px-2 py-1 hover:border-gold-500" href={`/api/reports/${report.id}?format=docx`}>Exportar Word</a>
        </span>
      </div>
      <CitedMarkdown markdown={report.markdown} citas={report.citas} onCita={onCita} />
      <CitasList citas={report.citas} onCita={onCita} />
    </article>
  );
}

export function useReports(caseId: string) {
  const [reports, setReports] = useState<Report[]>([]);
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const reload = () => fetch(`/api/cases/${caseId}/reports`).then((r) => r.json()).then((j) => { setReports(j.reports); setKinds(j.kinds); });
  useEffect(() => { reload(); }, [caseId]);
  return { reports, kinds, reload };
}
