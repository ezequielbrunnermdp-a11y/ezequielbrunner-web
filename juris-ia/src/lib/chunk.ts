/**
 * Fragmentación para RAG. Cada fragmento (chunk) pertenece a UNA sola página/sección, de
 * modo que toda cita queda anclada a documento + página. Dentro del fragmento el texto se
 * divide en segmentos (párrafos u oraciones), que son la unidad mínima que Claude puede citar.
 */
export type Chunk = { page: number; ordinal: number; segments: string[]; text: string };

const SEGMENT_MAX = 450;
const CHUNK_MAX = 1800;

export function segmentText(text: string): string[] {
  const paras = text
    .replace(/\r/g, "")
    .split(/\n\s*\n|\n(?=\s*(?:[IVXLC]+[.)-]|\d+[.)-]|[a-z][.)]|[-•]\s))/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of paras) {
    if (p.length <= SEGMENT_MAX) {
      out.push(p);
      continue;
    }
    // Párrafo largo: dividir en oraciones y reagrupar hasta SEGMENT_MAX.
    // Corte solo después de puntuación seguida de espacio: nunca descarta caracteres
    // (abreviaturas como "S.A." o montos como "3.200.000" quedan intactos).
    const sentences = p.split(/(?<=[.!?;])\s+/);
    let cur = "";
    for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
      if (cur && cur.length + s.length + 1 > SEGMENT_MAX) {
        out.push(cur);
        cur = "";
      }
      if (s.length > SEGMENT_MAX * 2) {
        // Oración desmesurada (p. ej. sin puntuación): cortar por palabras.
        if (cur) out.push(cur);
        cur = "";
        const words = s.split(" ");
        let w = "";
        for (const word of words) {
          if (w && w.length + word.length + 1 > SEGMENT_MAX) {
            out.push(w);
            w = "";
          }
          w += (w ? " " : "") + word;
        }
        if (w) out.push(w);
        continue;
      }
      cur += (cur ? " " : "") + s;
    }
    if (cur) out.push(cur);
  }
  return out;
}

export function chunkPages(pages: { page: number; text: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  let ordinal = 0;
  for (const { page, text } of pages) {
    const segs = segmentText(text);
    let cur: string[] = [];
    let len = 0;
    const flush = () => {
      if (cur.length) chunks.push({ page, ordinal: ordinal++, segments: cur, text: cur.join("\n") });
      cur = [];
      len = 0;
    };
    for (const s of segs) {
      if (len && len + s.length > CHUNK_MAX) flush();
      cur.push(s);
      len += s.length + 1;
    }
    flush();
  }
  return chunks;
}

/** Normalización usada para verificar citas contra el texto almacenado. */
export function normForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
