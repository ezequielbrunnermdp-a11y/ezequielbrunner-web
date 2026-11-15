import "server-only";
import { PDFDocument } from "pdf-lib";
import type Anthropic from "@anthropic-ai/sdk";
import { claude, FALLBACK, MODEL, textOf } from "../claude";

const OCR_PROMPT = `Transcribí literalmente todo el texto visible de esta página de un expediente judicial.
Reglas estrictas:
- Copiá el texto tal como aparece, sin corregir, resumir, completar ni interpretar.
- Mantené los saltos de párrafo.
- Si una palabra o tramo es ilegible, escribí [ilegible]. Si hay firmas o sellos, indicá [firma] o [sello: texto legible].
- No agregues comentarios ni introducción. Si la página no contiene texto, respondé exactamente: [SIN TEXTO]`;

async function transcribe(content: Anthropic.Beta.BetaContentBlockParam[]) {
  const res = await claude.beta.messages.create({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low" },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("El modelo rechazó la transcripción");
  const t = textOf(res.content).trim();
  return t === "[SIN TEXTO]" ? "" : t;
}

export async function ocrPdfPage(pdf: Buffer, pageNumber: number): Promise<string> {
  const src = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(src, [pageNumber - 1]);
  out.addPage(p);
  const data = Buffer.from(await out.save()).toString("base64");
  return transcribe([
    { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
    { type: "text", text: OCR_PROMPT },
  ]);
}

export async function ocrImage(img: Buffer, mime: string): Promise<string> {
  return transcribe([
    {
      type: "image",
      source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp", data: img.toString("base64") },
    },
    { type: "text", text: OCR_PROMPT },
  ]);
}
