import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { chunkPages, segmentText } from "@/lib/chunk";
import { categorizarMovimiento, parseMovimientos } from "@/lib/movements";
import { verifyCitedText } from "@/lib/citations";
import { decrypt, encrypt, hashPassword, sha256, verifyPassword } from "@/lib/crypto";
import { extractPdfPages } from "@/lib/extract/pdf";
import { htmlToText, splitSections } from "@/lib/extract";
import { parseMarkdown, plainCitations, toDocx, toPdf } from "@/lib/export";
import { detectHomonimos, type CaseHit } from "@/lib/search";
import { categoriaDeTipo } from "@/lib/taxonomy";

describe("fragmentación", () => {
  it("cada fragmento queda dentro de una sola página y conserva todo el texto", () => {
    const pages = [
      { page: 1, text: "Primer párrafo.\n\nSegundo párrafo con más texto." },
      { page: 2, text: "x ".repeat(3000) },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.every((c) => [1, 2].includes(c.page))).toBe(true);
    expect(chunks.filter((c) => c.page === 1)).toHaveLength(1);
    const p2 = chunks.filter((c) => c.page === 2).map((c) => c.segments.join(" ")).join(" ");
    expect(p2.replace(/\s/g, "")).toBe(pages[1].text.replace(/\s/g, ""));
  });
  it("nunca pierde texto (abreviaturas, montos, puntuación sin espacio)", () => {
    const text = "Y VISTOS: autos “Pérez c/ Imaginarios S.A. s/ daños”. " + "FALLO: condena a abonar $ 3.200.000, con intereses;costas. ".repeat(30) + "Fin sin punto";
    const squash = (s: string) => s.replace(/\s/g, "");
    expect(squash(segmentText(text).join(""))).toBe(squash(text));
    expect(squash(chunkPages([{ page: 1, text }]).map((c) => c.segments.join("")).join(""))).toBe(squash(text));
  });
  it("segmenta párrafos largos en oraciones de tamaño acotado", () => {
    const segs = segmentText(Array.from({ length: 30 }, (_, i) => `Oración número ${i} del considerando.`).join(" "));
    expect(segs.length).toBeGreaterThan(1);
    expect(segs.every((s) => s.length <= 900)).toBe(true);
  });
});

describe("verificación de citas", () => {
  const segs = ["Que la demandada no acreditó la culpa de la víctima.", "FALLO: Haciendo lugar parcialmente a la demanda."];
  it("acepta texto citado presente (concatenado, con diferencias de espacios y tildes)", () => {
    expect(verifyCitedText(segs.join(""), segs)).toBe(true);
    expect(verifyCitedText("que la demandada  no acredito la culpa", segs)).toBe(true);
  });
  it("rechaza texto que no está en el fragmento", () => {
    expect(verifyCitedText("La demandada acreditó la culpa de la víctima", segs)).toBe(false);
    expect(verifyCitedText("", segs)).toBe(false);
  });
});

describe("movimientos", () => {
  it("parsea fechas, continuaciones y descarta líneas sin fecha", () => {
    const r = parseMovimientos("Encabezado\n15/03/2024 AGREGA CONTESTACIÓN DE DEMANDA\n  continúa\n2-4-24 - SE ABRE A PRUEBA\n31/02/2024 fecha inválida");
    expect(r.movimientos).toEqual([
      { fecha: "2024-03-15", descripcion: "AGREGA CONTESTACIÓN DE DEMANDA continúa", linea: 2 },
      { fecha: "2024-04-02", descripcion: "SE ABRE A PRUEBA", linea: 4 },
    ]);
    expect(r.descartadas).toContain("Encabezado");
    expect(r.descartadas.some((l) => l.startsWith("31/02"))).toBe(true);
  });
  it("categoriza", () => {
    expect(categorizarMovimiento("SENTENCIA DEFINITIVA").categoria).toBe("sentencia");
    expect(categorizarMovimiento("Interpone recurso de apelación").categoria).toBe("recurso");
    expect(categorizarMovimiento("Contesta demanda").tipo).toBe("contestacion");
    expect(categoriaDeTipo("pericia")).toBe("prueba");
  });
});

describe("seguridad", () => {
  it("cifra y descifra; detecta manipulación", () => {
    const key = Buffer.alloc(32, 7);
    const data = Buffer.from("contenido original");
    const blob = encrypt(data, key);
    expect(decrypt(blob, key).equals(data)).toBe(true);
    blob[blob.length - 1] ^= 1;
    expect(() => decrypt(blob, key)).toThrow();
    expect(sha256("a")).toHaveLength(64);
  });
  it("hash de contraseñas", () => {
    const h = hashPassword("una-clave-larga-123");
    expect(verifyPassword("una-clave-larga-123", h)).toBe(true);
    expect(verifyPassword("otra", h)).toBe(false);
  });
});

describe("extracción", () => {
  it("extrae el PDF ficticio por página", async () => {
    const pdf = fs.readFileSync(new URL("./fixtures/expediente-ficticio.pdf", import.meta.url));
    const pages = await extractPdfPages(pdf);
    expect(pages).toHaveLength(4);
    expect(pages[0].text).toContain("CINCO MILLONES");
    expect(pages[3].text).toContain("TRES MILLONES DOSCIENTOS MIL");
  });
  it("HTML y texto sin paginar", () => {
    expect(htmlToText("<p>Hola&nbsp;<b>mundo</b></p><script>x()</script>")).toBe("Hola mundo");
    expect(splitSections("a\n\n".repeat(2000)).length).toBeGreaterThan(1);
  });
});

describe("homónimos", () => {
  const hit = (id: string, nombre: string, identificador: string | null): CaseHit => ({
    id, caratula: id, numero: null, receptoria: null, departamento: null, organismo: null, fuero: null, estado_procesal: null,
    reservada: false, documentos: 0, updated_at: "", score: 1, coincidencias: [{ nombre, rol: "actor", identificador, score: 1 }],
  });
  it("detecta mismo nombre con distinto DNI o sin DNI, no con el mismo DNI", () => {
    expect(detectHomonimos([hit("a", "Juan Pérez", "20111"), hit("b", "JUAN PEREZ", "20222")])).toHaveLength(1);
    expect(detectHomonimos([hit("a", "Juan Pérez", null), hit("b", "Juan Perez", "20222")])[0].motivo).toMatch(/verificar/);
    expect(detectHomonimos([hit("a", "Juan Pérez", "20.111"), hit("b", "Juan Perez", "20111")])).toHaveLength(0);
  });
});

describe("exportación", () => {
  const input = {
    title: "Informe de prueba",
    subtitle: "Causa ficticia",
    markdown: "## Título\n\nTexto con **negrita** y cita [[1]](#cita-1).\n\n- punto uno\n\n| A | B |\n|---|---|\n| 1 | 2 |",
    citas: [{ n: 1, kind: "expediente" as const, cited_text: "texto", document_id: "x", tipo: "Demanda", titulo: "Demanda", fecha: "2024-01-01", page: 3, unidad: "pág.", verificada: true }],
  };
  it("parsea markdown y citas", () => {
    expect(plainCitations("a [[1]](#cita-1)")).toBe("a [1]");
    expect(parseMarkdown(input.markdown).map((l) => l.kind)).toEqual(["h", "p", "li", "table"]);
  });
  it("genera DOCX y PDF", async () => {
    const docx = await toDocx(input);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    const pdf = await toPdf(input);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
