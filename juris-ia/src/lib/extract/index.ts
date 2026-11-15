import "server-only";
import { extractPdfPages } from "./pdf";
import { ocrImage, ocrPdfPage } from "./ocr";

export type ExtractedPage = {
  page: number;
  text: string;
  source: "texto_nativo" | "ocr_ia" | "sin_texto";
};

export type Extraction = { pages: ExtractedPage[]; warnings: string[] };

/** Mínimo de caracteres para considerar que una página PDF tiene capa de texto. */
const MIN_TEXT_CHARS = 40;
/** Tamaño de las "secciones" para formatos sin paginación (DOCX, HTML, TXT). */
const SECTION_CHARS = 3500;

export const SUPPORTED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/html": "html",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

export function detectMime(filename: string, declared: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    htm: "text/html",
    html: "text/html",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return SUPPORTED_MIME[declared] ? declared : byExt[ext] ?? declared;
}

export async function extract(buf: Buffer, mime: string, opts: { ocr: boolean }): Promise<Extraction> {
  const kind = SUPPORTED_MIME[mime];
  const warnings: string[] = [];
  if (kind === "pdf") {
    const raw = await extractPdfPages(buf);
    const pages: ExtractedPage[] = [];
    for (const p of raw) {
      if (p.text.replace(/\s/g, "").length >= MIN_TEXT_CHARS) {
        pages.push({ page: p.page, text: p.text, source: "texto_nativo" });
      } else if (opts.ocr) {
        try {
          const text = await ocrPdfPage(buf, p.page);
          pages.push({ page: p.page, text, source: text.trim() ? "ocr_ia" : "sin_texto" });
        } catch (e) {
          warnings.push(`Página ${p.page}: OCR falló (${(e as Error).message})`);
          pages.push({ page: p.page, text: p.text, source: "sin_texto" });
        }
      } else {
        pages.push({ page: p.page, text: p.text, source: "sin_texto" });
      }
    }
    const ocrCount = pages.filter((p) => p.source === "ocr_ia").length;
    const empty = pages.filter((p) => p.source === "sin_texto").length;
    if (ocrCount) warnings.push(`${ocrCount} página(s) transcriptas por OCR con IA: verificar contra el original.`);
    if (empty) warnings.push(`${empty} página(s) sin texto legible: su contenido NO está disponible para el análisis.`);
    return { pages, warnings };
  }
  if (kind === "image") {
    if (!opts.ocr) return { pages: [{ page: 1, text: "", source: "sin_texto" }], warnings: ["Imagen sin OCR"] };
    const text = await ocrImage(buf, mime);
    warnings.push("Imagen transcripta por OCR con IA: verificar contra el original.");
    return { pages: [{ page: 1, text, source: text.trim() ? "ocr_ia" : "sin_texto" }], warnings };
  }
  let text = "";
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (kind === "html") {
    text = htmlToText(buf.toString("utf8"));
  } else if (kind === "txt") {
    text = buf.toString("utf8");
  } else {
    throw new Error(`Formato no soportado: ${mime}`);
  }
  return { pages: splitSections(text), warnings };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Divide texto sin paginación en secciones, respetando párrafos. */
export function splitSections(text: string): ExtractedPage[] {
  const paras = text.replace(/\r/g, "").split(/\n\s*\n/);
  const out: ExtractedPage[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > SECTION_CHARS) {
      out.push({ page: out.length + 1, text: cur.trim(), source: "texto_nativo" });
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim() || out.length === 0) out.push({ page: out.length + 1, text: cur.trim(), source: cur.trim() ? "texto_nativo" : "sin_texto" });
  return out;
}
