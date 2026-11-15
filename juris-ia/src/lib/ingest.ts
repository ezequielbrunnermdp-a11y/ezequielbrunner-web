import "server-only";
import { one, query, tx } from "./db";
import { storeOriginal } from "./storage";
import { detectMime, extract, SUPPORTED_MIME } from "./extract";
import { chunkPages } from "./chunk";
import { classifyDocument } from "./classify";
import { embed, embeddingsEnabled, toPgVector } from "./embeddings";
import { isConfigured } from "./claude";
import { sha256 } from "./crypto";
import { categoriaDeTipo } from "./taxonomy";
import { HttpError } from "./auth";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type IngestResult = { documentId: string; duplicate: boolean; pages: number; warnings: string[] };

/** Etapa 1 (sincrónica): almacenar original cifrado, extraer texto por página e indexar. */
export async function ingestDocument(
  caseId: string,
  userId: string,
  file: { name: string; type: string; buf: Buffer },
): Promise<IngestResult> {
  if (file.buf.length > MAX_FILE_BYTES) throw new HttpError(413, `El archivo supera ${MAX_FILE_BYTES / 1048576} MB`);
  const mime = detectMime(file.name, file.type);
  if (!SUPPORTED_MIME[mime]) throw new HttpError(415, `Formato no soportado: ${file.name}`);

  const hash = sha256(file.buf);
  const dup = await one<{ id: string; page_count: number }>(
    "SELECT id, page_count FROM documents WHERE case_id = $1 AND sha256 = $2",
    [caseId, hash],
  );
  if (dup) return { documentId: dup.id, duplicate: true, pages: dup.page_count, warnings: ["Documento ya incorporado (mismo hash)."] };

  const { pages, warnings } = await extract(file.buf, mime, { ocr: isConfigured() });
  if (!isConfigured() && pages.some((p) => p.source === "sin_texto")) {
    warnings.push("OCR no disponible: configure ANTHROPIC_API_KEY para transcribir páginas escaneadas.");
  }
  const stored = await storeOriginal(file.buf);
  const chunks = chunkPages(pages.filter((p) => p.text.trim()));

  const documentId = await tx(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO documents (case_id, uploaded_by, filename, mime_type, size_bytes, sha256, storage_key, page_count, status, status_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'listo',$9) RETURNING id`,
      [caseId, userId, file.name, mime, file.buf.length, stored.sha256, stored.key, pages.length, warnings.join(" ") || null],
    );
    const id = rows[0].id;
    for (const p of pages) {
      await c.query("INSERT INTO document_pages (document_id, page_number, text, text_source) VALUES ($1,$2,$3,$4)", [
        id,
        p.page,
        p.text,
        p.source,
      ]);
    }
    for (const ch of chunks) {
      await c.query(
        "INSERT INTO chunks (document_id, case_id, page_number, ordinal, segments, text) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, caseId, ch.page, ch.ordinal, JSON.stringify(ch.segments), ch.text],
      );
    }
    await c.query("UPDATE cases SET updated_at = now() WHERE id = $1", [caseId]);
    return id;
  });

  return { documentId, duplicate: false, pages: pages.length, warnings };
}

/** Etapa 2 (en segundo plano): clasificación con Claude, embeddings, partes y actuaciones. */
export async function enrichDocument(documentId: string): Promise<void> {
  const doc = await one<{ case_id: string; filename: string; clasificacion_origen: string }>(
    "SELECT case_id, filename, clasificacion_origen FROM documents WHERE id = $1",
    [documentId],
  );
  if (!doc) return;
  const notes: string[] = [];

  if (embeddingsEnabled()) {
    try {
      const chunks = await query<{ id: string; text: string }>("SELECT id, text FROM chunks WHERE document_id = $1", [documentId]);
      const vectors = await embed(
        chunks.map((c) => c.text),
        "document",
      );
      for (let i = 0; i < chunks.length; i++) {
        await query("UPDATE chunks SET embedding = $1::vector WHERE id = $2", [toPgVector(vectors[i]), chunks[i].id]);
      }
    } catch (e) {
      notes.push(`Embeddings no generados: ${(e as Error).message}`);
    }
  }

  if (isConfigured() && doc.clasificacion_origen === "pendiente") {
    try {
      const pages = await query<{ page_number: number; text: string }>(
        "SELECT page_number, text FROM document_pages WHERE document_id = $1 ORDER BY page_number",
        [documentId],
      );
      const c = await classifyDocument(
        doc.filename,
        pages.map((p) => ({ page: p.page_number, text: p.text })),
      );
      if (c) {
        await tx(async (db) => {
          await db.query(
            `UPDATE documents SET tipo=$2, titulo=$3, fecha=$4, parte=$5, fojas=$6, resumen=$7, clasificacion_origen='ia'
             WHERE id=$1 AND clasificacion_origen='pendiente'`,
            [documentId, c.tipo, c.titulo, c.fecha, c.parte, c.fojas, c.resumen],
          );
          await db.query(
            `INSERT INTO actuaciones (case_id, document_id, fecha, tipo, categoria, parte, descripcion, origen)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'documento')`,
            [doc.case_id, documentId, c.fecha, c.tipo, categoriaDeTipo(c.tipo), c.parte, `${c.titulo}. ${c.resumen}`],
          );
          for (const p of c.partes_mencionadas.slice(0, 30)) {
            const exists = await db.query(
              "SELECT 1 FROM case_parties WHERE case_id=$1 AND f_unaccent(lower(nombre)) = f_unaccent(lower($2))",
              [doc.case_id, p.nombre],
            );
            if (!exists.rowCount) {
              await db.query(
                "INSERT INTO case_parties (case_id, nombre, rol, identificador, origen, documento_id) VALUES ($1,$2,$3,$4,'extraido_ia',$5)",
                [doc.case_id, p.nombre, p.rol, p.identificador, documentId],
              );
            }
          }
        });
        if (!c.legible) notes.push("La IA indicó que el texto está dañado o incompleto.");
      } else {
        notes.push("No se pudo clasificar automáticamente.");
      }
    } catch (e) {
      notes.push(`Clasificación fallida: ${(e as Error).message}`);
    }
  } else if (!isConfigured()) {
    notes.push("Clasificación automática no disponible (falta ANTHROPIC_API_KEY).");
  }

  if (notes.length) {
    await query("UPDATE documents SET status_detail = trim(coalesce(status_detail,'') || ' ' || $2) WHERE id = $1", [
      documentId,
      notes.join(" "),
    ]);
  }
}
