import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Report } from "./service";

const TOTAL_LABELS: [keyof Report["totals"], string][] = [
  ["messages", "Mensajes del período"],
  ["conversationsActive", "Conversaciones activas"],
  ["tasksCreated", "Tareas creadas"],
  ["tasksCompleted", "Tareas cumplidas"],
  ["tasksDiscarded", "Tareas descartadas"],
  ["openAtEnd", "Abiertas al cierre"],
  ["overdueAtEnd", "Vencidas al cierre"],
  ["findingsProposed", "Hallazgos detectados"],
  ["findingsApproved", "Hallazgos validados"],
  ["findingsRejected", "Hallazgos descartados"],
];

export async function reportToXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NEXO AI";
  wb.created = new Date(r.generatedAt);
  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FF101315" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5EEAD4" } };
  };

  const s = wb.addWorksheet("Resumen");
  s.columns = [{ header: "Indicador", key: "k", width: 32 }, { header: "Valor", key: "v", width: 14 }];
  header(s);
  s.addRow({ k: "Empresa", v: r.company });
  s.addRow({ k: "Período", v: r.label });
  for (const [key, label] of TOTAL_LABELS) s.addRow({ k: label, v: r.totals[key] });

  const add = <T extends object>(name: string, cols: [keyof T & string, string, number][], rows: T[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = cols.map(([key, h, width]) => ({ header: h, key, width }));
    header(ws);
    rows.forEach((row) => ws.addRow(row));
  };
  add("Por sucursal", [["branch", "Sucursal", 26], ["open", "Abiertas", 12], ["overdue", "Vencidas", 12], ["completed", "Cumplidas en el período", 24]], r.byBranch);
  add("Abiertas", [["title", "Tarea", 50], ["status", "Estado", 22], ["priority", "Prioridad", 12], ["due", "Vence", 12], ["branch", "Sucursal", 20], ["assignee", "Responsable", 20]], r.openTasks);
  add("Cumplidas", [["date", "Fecha", 12], ["title", "Tarea", 60], ["branch", "Sucursal", 20]], r.completed);
  add("Incidencias", [["date", "Fecha", 12], ["title", "Incidencia", 60], ["branch", "Sucursal", 20], ["status", "Estado", 20]], r.incidents);
  add("Decisiones", [["date", "Fecha", 12], ["title", "Decisión", 70], ["branch", "Sucursal", 20]], r.decisions);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// pdf-lib con fuentes estándar (WinAnsi): reemplazamos caracteres fuera de ese juego.
function safe(text: string): string {
  return text
    .replace(/[→]/g, "->")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

export async function reportToPdf(r: Report): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`NEXO AI — ${r.company} — ${r.label}`);
  pdf.setCreator("NEXO AI");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.11, 0.12);
  const muted = rgb(0.4, 0.43, 0.45);
  const accent = rgb(0.08, 0.55, 0.5);
  const W = 595, H = 842, M = 48;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (h: number) => {
    if (y - h < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const wrap = (text: string, f: PDFFont, size: number, width: number) => {
    const words = safe(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (t: string, opts: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; width?: number } = {}) => {
    const f = opts.f ?? font, size = opts.size ?? 10, x = opts.x ?? M;
    for (const l of wrap(t, f, size, opts.width ?? W - M - x)) {
      ensure(size + 4);
      page.drawText(l, { x, y: y - size, size, font: f, color: opts.color ?? ink });
      y -= size + 4;
    }
  };
  const section = (title: string) => {
    y -= 10;
    ensure(30);
    page.drawRectangle({ x: M, y: y - 2, width: 3, height: 14, color: accent });
    text(title, { f: bold, size: 12, x: M + 10 });
    y -= 4;
  };

  text("NEXO AI · Reporte operativo", { f: bold, size: 9, color: accent });
  text(r.company, { f: bold, size: 20 });
  text(`${r.label}  ·  generado ${r.generatedAt.slice(0, 16).replace("T", " ")} UTC`, { size: 9, color: muted });

  section("Resumen");
  const colW = (W - 2 * M) / 2;
  TOTAL_LABELS.forEach(([key, label], i) => {
    if (i % 2 === 0) ensure(16);
    const x = M + (i % 2) * colW;
    page.drawText(safe(label), { x, y: y - 10, size: 10, font, color: muted });
    page.drawText(String(r.totals[key]), { x: x + colW - 60, y: y - 10, size: 10, font: bold, color: ink });
    if (i % 2 === 1) y -= 16;
  });

  section("Por sucursal");
  if (!r.byBranch.length) text("Sin tareas registradas.", { color: muted });
  for (const b of r.byBranch) text(`${b.branch}: ${b.open} abiertas · ${b.overdue} vencidas · ${b.completed} cumplidas en el período`);

  const list = (title: string, items: string[], empty: string) => {
    section(title);
    if (!items.length) text(empty, { color: muted });
    items.forEach((i) => text(`• ${i}`));
  };
  list("Incidencias validadas", r.incidents.map((i) => `${i.date} — ${i.title}${i.branch ? ` (${i.branch})` : ""} · ${i.status}`), "No se validaron incidencias en el período.");
  list("Decisiones validadas", r.decisions.map((d) => `${d.date} — ${d.title}${d.branch ? ` (${d.branch})` : ""}`), "No se validaron decisiones en el período.");
  list("Tareas cumplidas", r.completed.map((c) => `${c.date} — ${c.title}${c.branch ? ` (${c.branch})` : ""}`), "No hay tareas cumplidas en el período.");
  list(
    "Tareas abiertas al cierre",
    r.openTasks.map((t) => `${t.title} · ${t.status} · ${t.priority}${t.due ? ` · vence ${t.due}` : ""}${t.branch ? ` · ${t.branch}` : ""}`),
    "No hay tareas abiertas.",
  );

  y -= 10;
  text("Sólo incluye hallazgos validados por personas. Las métricas son agregadas y no evalúan a empleados.", { size: 8, color: muted });
  return pdf.save();
}
