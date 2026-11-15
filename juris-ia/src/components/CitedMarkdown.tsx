"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Cita } from "./types";

/** Renderiza Markdown con citas [[n]](#cita-n) como chips clickeables. */
export function CitedMarkdown({ markdown, citas, onCita }: { markdown: string; citas: Cita[]; onCita: (c: Cita) => void }) {
  const byN = new Map(citas.map((c) => [c.n, c]));
  return (
    <div className="prose-juris">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const m = href?.match(/^#cita-(\d+)$/);
            if (m) {
              const c = byN.get(Number(m[1]));
              const label = c ? describeCita(c) : "Cita";
              return (
                <a className={`cita ${c && !c.verificada && c.kind === "expediente" ? "noverif" : ""}`} title={label} onClick={(e) => { e.preventDefault(); if (c) onCita(c); }} href={href}>
                  {m[1]}
                </a>
              );
            }
            return <a href={href} target="_blank" rel="noreferrer noopener" className="text-gold-400 underline">{children}</a>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function describeCita(c: Cita): string {
  if (c.kind === "web") return `${c.title ?? "Fuente web"} — ${c.url}`;
  if (!c.document_id) return "Fuente no localizada (no verificable)";
  return `${c.tipo}: ${c.titulo || c.filename} · ${c.fecha ?? "sin fecha"} · ${c.unidad} ${c.page}${c.ocr ? " · OCR-IA" : ""}${c.verificada ? " · verificada" : " · NO VERIFICADA"}`;
}

export function CitasList({ citas, onCita }: { citas: Cita[]; onCita: (c: Cita) => void }) {
  if (!citas.length) return null;
  return (
    <ol className="mt-3 space-y-1 border-t border-ink-700 pt-2 text-[11px] text-ink-300">
      {citas.map((c) => (
        <li key={c.n}>
          <button onClick={() => onCita(c)} className="text-left hover:text-white">
            <span className={`mr-1 font-semibold ${c.verificada || c.kind === "web" ? "text-gold-400" : "text-red-400"}`}>[{c.n}]</span>
            {describeCita(c)}
          </button>
        </li>
      ))}
    </ol>
  );
}
