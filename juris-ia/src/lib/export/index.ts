import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { citaReferencia, type Cita } from "../citations";

type Line =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string; ordered: boolean }
  | { kind: "table"; rows: string[][] };

/** Parser mínimo de Markdown (títulos, párrafos, listas, tablas, **negrita**). */
export function parseMarkdown(md: string): Line[] {
  const out: Line[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      out.push({ kind: "h", level: h[1].length, text: h[2] });
    } else if (/^\s*[-*]\s+/.test(l)) {
      flush();
      out.push({ kind: "li", text: l.replace(/^\s*[-*]\s+/, ""), ordered: false });
    } else if (/^\s*\d+[.)]\s+/.test(l)) {
      flush();
      out.push({ kind: "li", text: l.replace(/^\s*/, ""), ordered: true });
    } else if (/^\s*\|/.test(l)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      out.push({ kind: "table", rows });
    } else if (!l.trim()) {
      flush();
    } else {
      para.push(l.trim());
    }
  }
  flush();
  return out;
}

/** Reemplaza los enlaces de cita [[n]](#cita-n) por [n] y quita otros enlaces Markdown. */
export function plainCitations(s: string): string {
  return s.replace(/\[\[(\d+)\]\]\(#cita-\d+\)/g, "[$1]").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)");
}

function runs(text: string): { text: string; bold: boolean }[] {
  return plainCitations(text)
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((t) => (t.startsWith("**") && t.endsWith("**") ? { text: t.slice(2, -2), bold: true } : { text: t.replace(/\*/g, ""), bold: false }));
}

export type ExportInput = { title: string; subtitle: string; markdown: string; citas: Cita[] };

const DISCLAIMER =
  "Documento generado con asistencia de IA a partir de la documentación incorporada a JURIS IA. Las citas remiten a los documentos originales; las marcadas como NO VERIFICADAS u OCR-IA deben cotejarse. No sustituye el criterio profesional. Puede contener datos personales protegidos por la Ley 25.326.";

export async function toDocx(input: ExportInput): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: input.subtitle, italics: true })] }),
  ];
  for (const l of parseMarkdown(input.markdown)) {
    if (l.kind === "h") {
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][l.level - 1];
      children.push(new Paragraph({ heading: level, children: runs(l.text).map((r) => new TextRun({ text: r.text, bold: true })) }));
    } else if (l.kind === "table") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: l.rows.map(
            (r, ri) =>
              new TableRow({
                children: r.map(
                  (c) =>
                    new TableCell({
                      children: [new Paragraph({ children: runs(c).map((x) => new TextRun({ text: x.text, bold: x.bold || ri === 0, size: 18 })) })],
                    }),
                ),
              }),
          ),
        }),
      );
    } else {
      children.push(
        new Paragraph({
          bullet: l.kind === "li" && !l.ordered ? { level: 0 } : undefined,
          children: runs(l.text).map((r) => new TextRun({ text: r.text, bold: r.bold })),
        }),
      );
    }
  }
  if (input.citas.length) {
    children.push(new Paragraph({ text: "Referencias documentales", heading: HeadingLevel.HEADING_1 }));
    for (const c of input.citas) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${c.n}] `, bold: true }),
            new TextRun({ text: citaReferencia(c) }),
            new TextRun({ text: `\n“${c.cited_text.slice(0, 400)}${c.cited_text.length > 400 ? "…" : ""}”`, italics: true, size: 18 }),
          ],
        }),
      );
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ text: DISCLAIMER, italics: true, size: 16 })] }));
  return Packer.toBuffer(new Document({ creator: "JURIS IA", title: input.title, sections: [{ children }] }));
}

export async function toPdf(input: ExportInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 60, right: 60 }, info: { Title: input.title, Creator: "JURIS IA" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const write = (text: string, size: number, font = "Helvetica") => {
    for (const r of runs(text)) doc.font(r.bold ? "Helvetica-Bold" : font).fontSize(size).text(r.text, { continued: true });
    doc.text("", { continued: false });
  };
  doc.font("Helvetica-Bold").fontSize(18).text(input.title);
  doc.font("Helvetica-Oblique").fontSize(10).fillColor("#444").text(input.subtitle).fillColor("black").moveDown();
  for (const l of parseMarkdown(input.markdown)) {
    if (l.kind === "h") {
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize([16, 14, 12, 11][l.level - 1]).text(plainCitations(l.text).replace(/\*/g, ""));
      doc.moveDown(0.3);
    } else if (l.kind === "li") {
      doc.font("Helvetica").fontSize(10.5).text(l.ordered ? "" : "•  ", { continued: true, indent: 10 });
      write(l.text, 10.5);
    } else if (l.kind === "table") {
      for (const [ri, r] of l.rows.entries()) {
        doc.font(ri === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(r.map((c) => plainCitations(c).replace(/\*/g, "")).join("  |  "));
        doc.moveDown(0.2);
      }
      doc.moveDown(0.4);
    } else {
      write(l.text, 10.5);
      doc.moveDown(0.4);
    }
  }
  if (input.citas.length) {
    doc.addPage().font("Helvetica-Bold").fontSize(14).text("Referencias documentales").moveDown(0.5);
    for (const c of input.citas) {
      doc.font("Helvetica-Bold").fontSize(9.5).text(`[${c.n}] `, { continued: true }).font("Helvetica").text(citaReferencia(c));
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#333").text(`“${c.cited_text.slice(0, 400)}${c.cited_text.length > 400 ? "…" : ""}”`).fillColor("black").moveDown(0.4);
    }
  }
  doc.moveDown().font("Helvetica-Oblique").fontSize(8).fillColor("#555").text(DISCLAIMER);
  doc.end();
  return done;
}
