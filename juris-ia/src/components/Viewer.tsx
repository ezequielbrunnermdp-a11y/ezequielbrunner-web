"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Doc } from "./types";
import { tipoLabel } from "@/lib/taxonomy";

type Page = { page_number: number; text: string; text_source: string };
export type ViewerTarget = { documentId: string; page?: number; highlight?: string; nonce: number };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex tolerante a espacios/saltos para ubicar un texto citado dentro de la página. */
function highlightRegex(text: string): RegExp | null {
  // Primeras palabras del texto citado (los segmentos citados pueden venir concatenados).
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 14);
  if (!words.length) return null;
  return new RegExp(words.map(escapeRe).join("[\\s\\n]+"), "i");
}

function renderHighlighted(text: string, highlight: string | undefined, search: string) {
  let re: RegExp | null = null;
  if (highlight) re = highlightRegex(highlight);
  const parts: React.ReactNode[] = [];
  if (re) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      return [text.slice(0, m.index), <mark key="h" id="cita-highlight">{m[0]}</mark>, text.slice(m.index + m[0].length)];
    }
  }
  if (search.trim().length >= 3) {
    const sre = new RegExp(`(${escapeRe(search.trim())})`, "gi");
    text.split(sre).forEach((t, i) => parts.push(i % 2 ? <mark key={i}>{t}</mark> : t));
    return parts;
  }
  return [text];
}

export function Viewer({ doc, target, caseId, onOpen }: { doc: Doc | null; target: ViewerTarget | null; caseId: string; onOpen: (t: Omit<ViewerTarget, "nonce">) => void }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [search, setSearch] = useState("");
  const [caseHits, setCaseHits] = useState<{ document_id: string; filename: string; titulo: string | null; page: number; unidad: string; text: string }[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doc) return;
    setPages([]);
    fetch(`/api/documents/${doc.id}/pages`).then((r) => r.json()).then((j) => setPages(j.pages ?? []));
  }, [doc?.id]);

  useEffect(() => {
    if (!pages.length || !target) return;
    const el = document.getElementById("cita-highlight") ?? (target.page ? document.getElementById(`pg-${target.page}`) : null);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pages, target?.nonce]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 3) return 0;
    return pages.reduce((n, p) => n + (p.text.toLowerCase().split(q).length - 1), 0);
  }, [pages, search]);

  async function searchCase() {
    if (search.trim().length < 2) return;
    const r = await fetch(`/api/cases/${caseId}/search?q=${encodeURIComponent(search)}`);
    setCaseHits((await r.json()).hits);
  }

  const unidad = doc?.mime_type === "application/pdf" ? "Página" : "Sección";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-4 py-2">
        <input className="min-w-40 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm outline-none focus:border-gold-500" placeholder="Buscar en el documento o en todo el expediente…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchCase()} />
        {matches > 0 && <span className="text-xs text-ink-400">{matches} coincidencia(s) en este documento</span>}
        <button onClick={searchCase} className="rounded-md border border-ink-600 px-2.5 py-1.5 text-xs hover:border-gold-500">Buscar en todo el expediente</button>
      </div>
      {caseHits && (
        <div className="max-h-56 overflow-y-auto border-b border-ink-700 bg-ink-850 px-4 py-2 text-xs scroll-thin">
          <div className="mb-1 flex justify-between text-ink-400"><span>{caseHits.length} fragmento(s) en el expediente</span><button onClick={() => setCaseHits(null)}>cerrar ✕</button></div>
          {caseHits.map((h, i) => (
            <button key={i} className="block w-full border-t border-ink-700 py-1.5 text-left hover:bg-ink-800" onClick={() => onOpen({ documentId: h.document_id, page: h.page })}>
              <span className="text-gold-400">{h.titulo || h.filename} · {h.unidad} {h.page}</span> — <span className="text-ink-300">{h.text.slice(0, 180)}…</span>
            </button>
          ))}
        </div>
      )}
      {!doc ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-ink-400">Seleccione un documento del panel izquierdo o haga clic en una cita del chat.</div>
      ) : (
        <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scroll-thin">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-gold-400">{tipoLabel(doc.tipo)}{doc.clasificacion_origen === "ia" ? " · clasificación IA" : ""}</div>
              <h2 className="font-serif text-xl text-white">{doc.titulo || doc.filename}</h2>
              <div className="text-xs text-ink-400">{doc.fecha ?? "sin fecha"} · {doc.page_count} {unidad.toLowerCase()}(s) · {doc.filename} · SHA-256 {doc.sha256.slice(0, 12)}…</div>
            </div>
            <div className="flex gap-2">
              <a className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-gold-400" target="_blank" rel="noreferrer" href={`/api/documents/${doc.id}/file${doc.mime_type === "application/pdf" && target?.page ? `#page=${target.page}` : ""}`}>Abrir original</a>
              <a className="rounded-md border border-ink-600 px-3 py-1.5 text-xs hover:border-gold-500" href={`/api/documents/${doc.id}/file?download=1`}>Descargar</a>
            </div>
          </div>
          {target?.highlight && target.documentId === doc.id && (
            <div className="mb-4 rounded-md border border-gold-500/40 bg-gold-500/10 p-3 text-xs text-ink-100">
              <div className="mb-1 font-semibold text-gold-400">Texto citado</div>“{target.highlight}”
            </div>
          )}
          <p className="mb-4 text-[11px] text-ink-400">Texto extraído del original para lectura y búsqueda. Ante cualquier duda, prevalece el archivo original (“Abrir original”).</p>
          {pages.map((p) => (
            <section key={p.page_number} id={`pg-${p.page_number}`} className={`mb-6 rounded-lg border p-4 ${target?.page === p.page_number && target.documentId === doc.id ? "border-gold-500/60" : "border-ink-700"} bg-ink-900`}>
              <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wider text-ink-400">
                <span>{unidad} {p.page_number}</span>
                {p.text_source === "ocr_ia" && <span className="text-amber-400">Transcripción OCR por IA — cotejar con el original</span>}
                {p.text_source === "sin_texto" && <span className="text-red-400">Sin texto legible — contenido no disponible para el análisis</span>}
              </div>
              <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-ink-100">
                {renderHighlighted(p.text, target?.documentId === doc.id && target.page === p.page_number ? target.highlight : undefined, search)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
