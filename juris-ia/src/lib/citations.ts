import { query } from "./db";
import { normForMatch } from "./chunk";
import type { Block } from "./claude";
import { tipoLabel } from "./taxonomy";

export type Cita = {
  n: number;
  kind: "expediente" | "web";
  cited_text: string;
  // expediente
  chunk_id?: string;
  document_id?: string;
  filename?: string;
  titulo?: string | null;
  tipo?: string;
  fecha?: string | null;
  page?: number;
  unidad?: string;
  ocr?: boolean;
  /** true si el texto citado coincide con el texto almacenado del fragmento. */
  verificada: boolean;
  // web
  url?: string;
  title?: string | null;
};

type ChunkRow = {
  id: string;
  document_id: string;
  page_number: number;
  segments: string[];
  filename: string;
  titulo: string | null;
  tipo: string;
  fecha: string | null;
  mime_type: string;
  text_source: string;
};

const squash = (s: string) => normForMatch(s).replace(/[^a-z0-9ñ]/g, "");

/** Verifica que el texto citado esté contenido en el fragmento almacenado (pura, testeable). */
export function verifyCitedText(cited: string, segments: string[]): boolean {
  const c = squash(cited);
  if (!c) return false;
  return squash(segments.join(" ")).includes(c);
}

/**
 * Convierte los bloques de texto de Claude en Markdown con marcadores de cita [n] y
 * devuelve las citas resueltas contra la base (documento, fecha, página) y verificadas.
 */
export async function renderWithCitations(content: Block[]): Promise<{ markdown: string; citas: Cita[] }> {
  const texts = content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text");
  const chunkIds = new Set<string>();
  for (const t of texts)
    for (const c of t.citations ?? [])
      if (c.type === "search_result_location" && c.source.startsWith("chunk:")) chunkIds.add(c.source.slice(6));

  const rows = chunkIds.size
    ? await query<ChunkRow>(
        `SELECT c.id, c.document_id, c.page_number, c.segments, d.filename, d.titulo, d.tipo, d.fecha, d.mime_type, p.text_source
         FROM chunks c JOIN documents d ON d.id = c.document_id
         JOIN document_pages p ON p.document_id = c.document_id AND p.page_number = c.page_number
         WHERE c.id = ANY($1::uuid[])`,
        [[...chunkIds].filter((id) => /^[0-9a-f-]{36}$/i.test(id))],
      )
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const citas: Cita[] = [];
  const keyToN = new Map<string, number>();
  let markdown = "";

  for (const t of texts) {
    markdown += t.text;
    const marks: number[] = [];
    for (const c of t.citations ?? []) {
      let cita: Omit<Cita, "n"> | null = null;
      let key = "";
      if (c.type === "search_result_location") {
        const id = c.source.startsWith("chunk:") ? c.source.slice(6) : "";
        const row = byId.get(id);
        key = `${c.source}|${c.start_block_index}|${c.end_block_index}`;
        cita = row
          ? {
              kind: "expediente",
              cited_text: c.cited_text,
              chunk_id: row.id,
              document_id: row.document_id,
              filename: row.filename,
              titulo: row.titulo,
              tipo: tipoLabel(row.tipo),
              fecha: row.fecha,
              page: row.page_number,
              unidad: row.mime_type === "application/pdf" ? "pág." : "secc.",
              ocr: row.text_source === "ocr_ia",
              verificada: verifyCitedText(c.cited_text, row.segments),
            }
          : { kind: "expediente", cited_text: c.cited_text, verificada: false, title: c.title };
      } else if (c.type === "web_search_result_location") {
        key = `web|${c.url}|${c.cited_text.slice(0, 40)}`;
        cita = { kind: "web", cited_text: c.cited_text, url: c.url, title: c.title, verificada: false };
      }
      if (!cita) continue;
      let n = keyToN.get(key);
      if (!n) {
        n = citas.length + 1;
        keyToN.set(key, n);
        citas.push({ n, ...cita });
      }
      if (!marks.includes(n)) marks.push(n);
    }
    if (marks.length) {
      // Insertar los marcadores antes del espacio/salto final del bloque, si lo hay.
      const m = markdown.match(/(\s*)$/);
      const tail = m ? m[1] : "";
      markdown = markdown.slice(0, markdown.length - tail.length) + marks.map((n) => ` [[${n}]](#cita-${n})`).join("") + tail;
    }
  }
  return { markdown, citas };
}

export function citaReferencia(c: Cita): string {
  if (c.kind === "web") return `${c.title ?? "Fuente web"} — ${c.url}`;
  if (!c.document_id) return "Fuente no localizada en el expediente (cita no verificable)";
  return `${c.tipo}: ${c.titulo || c.filename} — ${c.fecha ?? "sin fecha"} — ${c.unidad} ${c.page}${c.ocr ? " (OCR-IA)" : ""}${
    c.verificada ? "" : " — NO VERIFICADA"
  }`;
}
