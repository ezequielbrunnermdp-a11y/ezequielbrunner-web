import { one, query, tx } from "./db";
import { readOriginal, storeOriginal } from "./storage";
import { ocrImage, ocrPdfPage } from "./extract/ocr";
import { detectMime, extract, SUPPORTED_MIME } from "./extract";
import { chunkPages } from "./chunk";
import { classifyDocument } from "./classify";
import { embed, embeddingsEnabled, toPgVector } from "./embeddings";
import { isConfigured } from "./claude";
import { sha256 } from "./crypto";
import { categoriaDeTipo } from "./taxonomy";
import { HttpError } from "./errors";

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

  // El OCR (lento) se hace después, en segundo plano: ver ocrPendingPages().
  const { pages, warnings: rawWarnings } = await extract(file.buf, mime, { ocr: false });
  const warnings = rawWarnings.filter((w) => !w.includes("sin texto legible") && w !== "Imagen sin OCR");
  const sinTexto = pages.filter((p) => p.source === "sin_texto").length;
  if (sinTexto) {
    warnings.push(
      isConfigured()
        ? `${sinTexto} página(s) sin capa de texto: se transcribirán con OCR por IA en segundo plano.`
        : `${sinTexto} página(s) sin capa de texto y OCR no disponible (falta ANTHROPIC_API_KEY): su contenido no está disponible para el análisis.`,
    );
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

/** OCR con Claude de las páginas sin capa de texto; agrega sus fragmentos al índice. */
export async function ocrPendingPages(documentId: string): Promise<string[]> {
  const notes: string[] = [];
  const doc = await one<{ case_id: string; mime_type: string; storage_key: string; sha256: string }>(
    "SELECT case_id, mime_type, storage_key, sha256 FROM documents WHERE id = $1",
    [documentId],
  );
  if (!doc) return notes;
  const pending = await query<{ page_number: number }>(
    "SELECT page_number FROM document_pages WHERE document_id = $1 AND text_source = 'sin_texto' ORDER BY page_number",
    [documentId],
  );
  if (!pending.length) return notes;
  const original = await readOriginal(doc.storage_key, doc.sha256);
  let ok = 0;
  for (const { page_number } of pending) {
    try {
      const text = doc.mime_type === "application/pdf" ? await ocrPdfPage(original, page_number) : await ocrImage(original, doc.mime_type);
      if (!text.trim()) continue;
      const max = await one<{ m: number | null }>("SELECT max(ordinal) AS m FROM chunks WHERE document_id = $1", [documentId]);
      const chunks = chunkPages([{ page: page_number, text }]);
      await tx(async (c) => {
        await c.query("UPDATE document_pages SET text = $3, text_source = 'ocr_ia' WHERE document_id = $1 AND page_number = $2", [documentId, page_number, text]);
        for (const [i, ch] of chunks.entries())
          await c.query("INSERT INTO chunks (document_id, case_id, page_number, ordinal, segments, text) VALUES ($1,$2,$3,$4,$5,$6)", [
            documentId, doc.case_id, ch.page, (max?.m ?? -1) + 1 + i, JSON.stringify(ch.segments), ch.text,
          ]);
      });
      ok++;
    } catch (e) {
      notes.push(`OCR falló en pág. ${page_number}: ${(e as Error).message}`);
    }
  }
  if (ok) notes.push(`${ok} página(s) transcriptas por OCR con IA: verificar contra el original.`);
  return notes;
}

/** Etapa 2 (en segundo plano): OCR, clasificación con Claude, embeddings, partes y actuaciones. */
export async function enrichDocument(documentId: string): Promise<void> {
  const doc = await one<{ case_id: string; filename: string; clasificacion_origen: string }>(
    "SELECT case_id, filename, clasificacion_origen FROM documents WHERE id = $1",
    [documentId],
  );
  if (!doc) return;
  const notes: string[] = [];
  if (isConfigured()) {
    try {
      notes.push(...(await ocrPendingPages(documentId)));
    } catch (e) {
      notes.push(`OCR no realizado: ${(e as Error).message}`);
    }
  }

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
