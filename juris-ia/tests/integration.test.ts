/**
 * Pruebas de integración contra PostgreSQL real (requieren DATABASE_URL y DOCUMENT_ENCRYPTION_KEY).
 * Usan el expediente FICTICIO de tests/fixtures. No llaman a la API de Claude.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { getPool, one, query } from "@/lib/db";
import { ingestDocument } from "@/lib/ingest";
import { searchChunks, toSearchResults } from "@/lib/retrieval";
import { renderWithCitations } from "@/lib/citations";
import { readOriginal } from "@/lib/storage";
import { caseInventory } from "@/lib/caseContext";
import { hashPassword } from "@/lib/crypto";
import type { Block } from "@/lib/claude";

const enabled = Boolean(process.env.DATABASE_URL && process.env.DOCUMENT_ENCRYPTION_KEY);
const d = enabled ? describe : describe.skip;

d("ingesta, recuperación y citas (base real)", () => {
  let userId = "";
  let caseId = "";
  let documentId = "";

  beforeAll(async () => {
    userId = (await one<{ id: string }>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1,'Test',$2) RETURNING id",
      [`test-${Date.now()}@juris.local`, hashPassword("x".repeat(12))],
    ))!.id;
    caseId = (await one<{ id: string }>(
      "INSERT INTO cases (owner_id, caratula, numero) VALUES ($1,'Prueba Ficticia, Ana c/ Transportes Imaginarios S.A. s/ daños (FICTICIO)','TEST-1') RETURNING id",
      [userId],
    ))!.id;
  });
  afterAll(async () => {
    await query("DELETE FROM cases WHERE id = $1", [caseId]);
    await query("DELETE FROM users WHERE id = $1", [userId]);
    await getPool().end();
  });

  it("incorpora el PDF, conserva el original cifrado e íntegro y detecta duplicados", async () => {
    const buf = fs.readFileSync(new URL("./fixtures/expediente-ficticio.pdf", import.meta.url));
    const r = await ingestDocument(caseId, userId, { name: "expediente-ficticio.pdf", type: "application/pdf", buf });
    documentId = r.documentId;
    expect(r.pages).toBe(4);
    const doc = await one<{ storage_key: string; sha256: string }>("SELECT storage_key, sha256 FROM documents WHERE id = $1", [documentId]);
    expect((await readOriginal(doc!.storage_key, doc!.sha256)).equals(buf)).toBe(true);
    const again = await ingestDocument(caseId, userId, { name: "copia.pdf", type: "application/pdf", buf });
    expect(again.duplicate).toBe(true);
  });

  it("recupera los fragmentos pertinentes con su página", async () => {
    const monto = await searchChunks(caseId, "cuánto dinero reclama la actora");
    expect(monto.slice(0, 3).map((h) => h.page_number)).toContain(1);
    const semaforo = await searchChunks(caseId, "color del semáforo testigos");
    expect(semaforo.slice(0, 3).map((h) => h.page_number)).toContain(3);
    const fallo = await searchChunks(caseId, "fallo condena suma");
    expect(fallo.map((h) => h.page_number)).toContain(4);
  });

  it("resuelve y verifica citas con la forma de respuesta de la API (search_result_location)", async () => {
    const [hit] = await searchChunks(caseId, "FALLO haciendo lugar parcialmente");
    const sr = toSearchResults([hit])[0];
    const idx = hit.segments.findIndex((s) => s.includes("FALLO"));
    // Respuesta simulada con la estructura documentada de la API (no es una salida real de Claude).
    const content = [
      {
        type: "text",
        text: "La sentencia hizo lugar parcialmente a la demanda",
        citations: [{ type: "search_result_location", source: sr.source, title: sr.title, cited_text: hit.segments[idx], search_result_index: 0, start_block_index: idx, end_block_index: idx + 1 }],
      },
      {
        type: "text",
        text: " y otra afirmación con una cita alterada.",
        citations: [{ type: "search_result_location", source: sr.source, title: sr.title, cited_text: "Texto que no figura en el expediente", search_result_index: 0, start_block_index: 0, end_block_index: 1 }],
      },
    ] as unknown as Block[];
    const { markdown, citas } = await renderWithCitations(content);
    expect(markdown).toContain("[[1]](#cita-1)");
    expect(citas[0]).toMatchObject({ document_id: documentId, page: 4, verificada: true, unidad: "pág." });
    expect(citas[1].verificada).toBe(false);
  });

  it("el inventario advierte piezas faltantes y documento sin clasificar", async () => {
    const inv = await caseInventory(caseId);
    expect(inv).toContain("expediente-ficticio.pdf");
    expect(inv).toMatch(/Piezas habituales NO incorporadas/);
  });
});
