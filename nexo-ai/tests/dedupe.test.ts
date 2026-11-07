import { beforeAll, describe, expect, it } from "vitest";
import { computeContentHashes } from "@/lib/whatsapp/dedupe";
import { parseWhatsAppText } from "@/lib/whatsapp/parser";
import { importChat, deleteImport } from "@/lib/imports/service";
import { authorize } from "@/lib/auth/permissions";
import { decrypt } from "@/lib/crypto";
import type { Db } from "@/lib/db";
import { enc, makeCompanyWithOwner, makeDb } from "./helpers/db";

const PART1 = `12/03/2024, 09:15 - Laura: Hay que pedir harina
12/03/2024, 09:15 - Laura: ok
12/03/2024, 09:15 - Laura: ok
12/03/2024, 09:20 - Martín: Dale`;
// Exportación posterior que se superpone con la anterior y agrega mensajes nuevos.
const PART2 = `${PART1}
13/03/2024, 08:00 - Martín: Ya la pedí
13/03/2024, 08:01 - Laura: Gracias. Mi cel es +54 9 223 555-1234`;

describe("huellas de mensajes", () => {
  it("son estables y distinguen repeticiones legítimas en el mismo minuto", () => {
    const a = computeContentHashes(parseWhatsAppText(PART1).messages);
    const b = computeContentHashes(parseWhatsAppText(PART1).messages);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(4); // los dos "ok" son mensajes distintos
  });

  it("ignoran diferencias de espacios y saltos de línea Windows", () => {
    const a = computeContentHashes(parseWhatsAppText("12/03/2024, 09:15 - Ana: Hola   mundo").messages);
    const b = computeContentHashes(parseWhatsAppText("12/03/2024, 09:15 - Ana: Hola mundo\r\n").messages);
    expect(a).toEqual(b);
  });
});

describe("importación sin duplicados", () => {
  let db: Db;
  beforeAll(async () => {
    db = await makeDb();
  });

  it("reimportar el mismo archivo no inserta nada y avisa", async () => {
    const { owner, company } = await makeCompanyWithOwner(db);
    const ctx = await authorize(db, owner.id, company.id, "imports.create");
    const first = await importChat(ctx, { fileName: "Chat de WhatsApp con Cocina.txt", bytes: enc(PART1) });
    expect(first).toMatchObject({ totalParsed: 4, inserted: 4, duplicates: 0, conversationTitle: "Cocina" });
    const again = await importChat(ctx, { fileName: "Chat de WhatsApp con Cocina.txt", bytes: enc(PART1) });
    expect(again.conversationId).toBe(first.conversationId);
    expect(again).toMatchObject({ inserted: 0, duplicates: 4 });
    expect(again.warnings.join(" ")).toMatch(/ya se había importado/);
  });

  it("una exportación superpuesta sólo agrega los mensajes nuevos y conserva procedencia", async () => {
    const { owner, company } = await makeCompanyWithOwner(db);
    const ctx = await authorize(db, owner.id, company.id, "imports.create");
    const a = await importChat(ctx, { fileName: "Chat de WhatsApp con Cocina.txt", bytes: enc(PART1) });
    const b = await importChat(ctx, { fileName: "Chat de WhatsApp con Cocina (2).txt", bytes: enc(PART2), conversationId: a.conversationId });
    expect(b).toMatchObject({ totalParsed: 6, inserted: 2, duplicates: 4 });
    const rows = (await db.query<{ import_id: string; source_line: number; body: string; source_raw_enc: string }>(
      `select import_id, source_line, body, source_raw_enc from messages where conversation_id = $1 order by sent_at, source_line`,
      [a.conversationId],
    )).rows;
    expect(rows).toHaveLength(6);
    expect(rows.slice(0, 4).every((r) => r.import_id === a.importId)).toBe(true);
    expect(rows[4]).toMatchObject({ import_id: b.importId, source_line: 5 });
    // Minimización: el teléfono no se guarda en claro; la línea original queda cifrada para trazabilidad.
    expect(rows[5].body).toContain("[tel ••34]");
    expect(rows[5].body).not.toContain("555-1234");
    expect(rows[5].source_raw_enc).not.toContain("555");
    expect(decrypt(rows[5].source_raw_enc)).toContain("+54 9 223 555-1234");
  });

  it("la misma conversación en otra empresa no se considera duplicada", async () => {
    const A = await makeCompanyWithOwner(db);
    const B = await makeCompanyWithOwner(db);
    const ra = await importChat(await authorize(db, A.owner.id, A.company.id, "imports.create"), { fileName: "c.txt", bytes: enc(PART1), title: "Cocina" });
    const rb = await importChat(await authorize(db, B.owner.id, B.company.id, "imports.create"), { fileName: "c.txt", bytes: enc(PART1), title: "Cocina" });
    expect(ra.inserted).toBe(4);
    expect(rb.inserted).toBe(4);
    expect(ra.conversationId).not.toBe(rb.conversationId);
  });

  it("borrar una importación elimina sólo los mensajes que aportó", async () => {
    const { owner, company } = await makeCompanyWithOwner(db);
    const ctx = await authorize(db, owner.id, company.id, "imports.create");
    const a = await importChat(ctx, { fileName: "c.txt", bytes: enc(PART1), title: "Cocina" });
    const b = await importChat(ctx, { fileName: "c2.txt", bytes: enc(PART2), title: "Cocina" });
    await deleteImport(ctx, b.importId);
    const n = (await db.query<{ n: number }>(`select count(*)::int n from messages where conversation_id = $1`, [a.conversationId])).rows[0].n;
    expect(n).toBe(4);
    // Reimportar restaura los dos mensajes nuevos, sin duplicar los anteriores.
    const c = await importChat(ctx, { fileName: "c2.txt", bytes: enc(PART2), title: "Cocina" });
    expect(c).toMatchObject({ inserted: 2, duplicates: 4 });
  });
});
