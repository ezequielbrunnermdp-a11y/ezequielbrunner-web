import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { query } from "./db";
import { embed, embeddingsEnabled, toPgVector } from "./embeddings";
import { tipoLabel } from "./taxonomy";

export type ChunkHit = {
  id: string;
  document_id: string;
  page_number: number;
  segments: string[];
  text: string;
  filename: string;
  tipo: string;
  titulo: string | null;
  fecha: string | null;
  mime_type: string;
  text_source: string;
  score: number;
};

const HIT_COLUMNS = `c.id, c.document_id, c.page_number, c.segments, c.text,
  d.filename, d.tipo, d.titulo, d.fecha, d.mime_type, p.text_source`;
const HIT_JOIN = `FROM chunks c JOIN documents d ON d.id = c.document_id
  JOIN document_pages p ON p.document_id = c.document_id AND p.page_number = c.page_number`;

/**
 * Búsqueda híbrida: full-text en español + trigramas (+ vectorial si hay embeddings),
 * combinadas con Reciprocal Rank Fusion.
 */
export async function searchChunks(
  caseId: string,
  q: string,
  opts: { limit?: number; documentIds?: string[]; tipos?: string[] } = {},
): Promise<ChunkHit[]> {
  const limit = opts.limit ?? 12;
  const filters: string[] = ["c.case_id = $1"];
  const params: unknown[] = [caseId];
  if (opts.documentIds?.length) {
    params.push(opts.documentIds);
    filters.push(`c.document_id = ANY($${params.length}::uuid[])`);
  }
  if (opts.tipos?.length) {
    params.push(opts.tipos);
    filters.push(`d.tipo = ANY($${params.length}::text[])`);
  }
  const where = filters.join(" AND ");
  const base = params.length;

  const lexical = await query<ChunkHit>(
    `SELECT ${HIT_COLUMNS},
       ts_rank_cd(c.tsv, websearch_to_tsquery('spanish', f_unaccent($${base + 1}))) * 2
       + similarity(f_unaccent(lower(c.text)), f_unaccent(lower($${base + 1}))) AS score
     ${HIT_JOIN}
     WHERE ${where} AND (c.tsv @@ websearch_to_tsquery('spanish', f_unaccent($${base + 1}))
        OR c.tsv @@ plainto_tsquery('spanish', f_unaccent($${base + 1}))
        OR f_unaccent(lower(c.text)) % f_unaccent(lower($${base + 1})))
     ORDER BY score DESC LIMIT ${limit * 2}`,
    [...params, q],
  );

  // Respaldo: si ninguna frase coincide, buscar cualquier término (OR).
  let orHits: ChunkHit[] = [];
  if (lexical.length < limit) {
    const terms = q
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .match(/[a-z0-9ñ]{4,}/g);
    if (terms?.length) {
      orHits = await query<ChunkHit>(
        `SELECT ${HIT_COLUMNS}, ts_rank_cd(c.tsv, to_tsquery('spanish', $${base + 1})) AS score
         ${HIT_JOIN} WHERE ${where} AND c.tsv @@ to_tsquery('spanish', $${base + 1})
         ORDER BY score DESC LIMIT ${limit * 2}`,
        [...params, terms.join(" | ")],
      );
    }
  }

  let semantic: ChunkHit[] = [];
  if (embeddingsEnabled()) {
    const [v] = await embed([q], "query");
    if (v) {
      semantic = await query<ChunkHit>(
        `SELECT ${HIT_COLUMNS}, 1 - (c.embedding <=> $${base + 1}::vector) AS score
         ${HIT_JOIN} WHERE ${where} AND c.embedding IS NOT NULL
         ORDER BY c.embedding <=> $${base + 1}::vector LIMIT ${limit * 2}`,
        [...params, toPgVector(v)],
      );
    }
  }

  const fused = new Map<string, { hit: ChunkHit; score: number }>();
  for (const list of [lexical, semantic, orHits]) {
    list.forEach((hit, rank) => {
      const prev = fused.get(hit.id);
      const add = 1 / (60 + rank);
      fused.set(hit.id, { hit, score: (prev?.score ?? 0) + add });
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ hit, score }) => ({ ...hit, score }));
}

export async function readDocumentPages(
  caseId: string,
  documentId: string,
  from: number,
  to: number,
): Promise<ChunkHit[]> {
  return query<ChunkHit>(
    `SELECT ${HIT_COLUMNS}, 0 AS score ${HIT_JOIN}
     WHERE c.case_id = $1 AND c.document_id = $2 AND c.page_number BETWEEN $3 AND $4
     ORDER BY c.page_number, c.ordinal`,
    [caseId, documentId, from, to],
  );
}

export async function allChunks(caseId: string): Promise<ChunkHit[]> {
  return query<ChunkHit>(
    `SELECT ${HIT_COLUMNS}, 0 AS score ${HIT_JOIN}
     WHERE c.case_id = $1
     ORDER BY d.fecha NULLS LAST, d.created_at, c.page_number, c.ordinal`,
    [caseId],
  );
}

/** Identificador estable que viaja en `source` y vuelve en cada cita. */
export function sourceId(h: Pick<ChunkHit, "id">): string {
  return `chunk:${h.id}`;
}

export function unitLabel(mime: string): string {
  return mime === "application/pdf" ? "pág." : "secc.";
}

export function hitTitle(h: ChunkHit): string {
  const name = h.titulo || h.filename;
  const fecha = h.fecha ? ` · ${h.fecha}` : " · sin fecha";
  const ocr = h.text_source === "ocr_ia" ? " · OCR-IA" : "";
  return `${tipoLabel(h.tipo)}: ${name}${fecha} · ${unitLabel(h.mime_type)} ${h.page_number}${ocr}`;
}

/** Convierte fragmentos en bloques search_result citables por Claude. */
export function toSearchResults(hits: ChunkHit[]): Anthropic.Beta.BetaSearchResultBlockParam[] {
  return hits.map((h) => ({
    type: "search_result",
    source: sourceId(h),
    title: hitTitle(h),
    content: h.segments.map((s) => ({ type: "text", text: s })),
    citations: { enabled: true },
  }));
}
