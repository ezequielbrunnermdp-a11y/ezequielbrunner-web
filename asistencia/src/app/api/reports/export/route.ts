import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { actorFromSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildReport, resolvePeriod, toCsv, type Period } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { fmtMinutes } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidOr = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
const HUMAN: Record<string, string> = {
  min_programados: "Programado (min)", min_trabajados: "Trabajado (min)", min_tarde: "Tarde (min)", min_salida_anticipada: "Salida anticipada (min)",
  min_adicionales_a_revisar: "Adicional a revisar (min)", origen_entrada: "Origen entrada", origen_salida: "Origen salida", motivo_correccion: "Motivo corrección",
  salidas_anticipadas: "Salidas anticipadas", distancia_m: "Distancia (m)", precision_m: "Precisión (m)", fecha_hora: "Fecha y hora",
};
const head = (k: string) => HUMAN[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");

export async function GET(req: Request) {
  const actor = await actorFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!actor || !can(actor, "reports.view")) return NextResponse.json({ ok: false }, { status: 403 });
  const u = new URL(req.url);
  const per = resolvePeriod((u.searchParams.get("period") ?? "diario") as Period, u.searchParams.get("date") ?? "", u.searchParams.get("from") ?? undefined, u.searchParams.get("to") ?? undefined);
  const f = {
    companyId: uuidOr(u.searchParams.get("company")), branchId: uuidOr(u.searchParams.get("branch")), employeeId: uuidOr(u.searchParams.get("employee")),
    supervisorId: uuidOr(u.searchParams.get("supervisor")), sector: u.searchParams.get("sector")?.slice(0, 60) || undefined,
  };
  const format = u.searchParams.get("format") ?? "xlsx";
  const rep = await buildReport(actor, per.from, per.to, f);
  await audit({ actorId: actor.id, action: "report.exported", entity: "report", entityId: format, after: { ...per, ...f } });
  const name = `asistencia_${per.from}_${per.to}`;
  const strip = (rows: any[]) => rows.map(({ status, id, ...r }) => r);

  if (format === "csv") {
    const which = u.searchParams.get("sheet") ?? "detalle";
    const rows = which === "resumen" ? rep.summary : which === "fichadas" ? strip(rep.punches) : strip(rep.detail);
    return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}_${which}.csv"` } });
  }

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Asistencia";
    const add = (title: string, rows: any[]) => {
      const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
      if (!rows.length) { ws.addRow(["Sin datos"]); return; }
      const cols = Object.keys(rows[0]);
      ws.columns = cols.map((c) => ({ header: head(c), key: c, width: Math.min(40, Math.max(12, head(c).length + 2)) }));
      rows.forEach((r) => ws.addRow(r));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F7" } };
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    };
    add("Resumen", rep.summary);
    add("Detalle diario", strip(rep.detail));
    add("Fichadas (trazabilidad)", strip(rep.punches));
    const info = wb.addWorksheet("Notas");
    info.addRows([[`Período: ${per.label}`], [`Generado por: ${actor.full_name} · ${new Date().toISOString()}`],
      ["Las fichadas de origen 'Corrección administrativa' no fueron validadas por GPS/QR: se cargaron con autorización y motivo."],
      ["Las fichadas anuladas se conservan en la hoja de trazabilidad."],
      ["'Adicional a revisar' no constituye horas extra liquidadas hasta su autorización conforme a la normativa laboral."]]);
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
  }

  // PDF: resumen por empleado + detalle de novedades.
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  doc.fontSize(16).text("Reporte de asistencia", { continued: false });
  doc.fontSize(10).fillColor("#555").text(`${per.label} · generado por ${actor.full_name}`).moveDown();
  const table = (cols: { k: string; t: string; w: number }[], rows: any[]) => {
    const x0 = doc.page.margins.left;
    const drawHead = () => {
      let x = x0; const y = doc.y;
      doc.fontSize(8).fillColor("#111").font("Helvetica-Bold");
      cols.forEach((c) => { doc.text(c.t, x, y, { width: c.w - 4 }); x += c.w; });
      doc.font("Helvetica").moveDown(0.6);
      doc.moveTo(x0, doc.y).lineTo(x0 + cols.reduce((a, c) => a + c.w, 0), doc.y).strokeColor("#ddd").stroke();
      doc.moveDown(0.3);
    };
    drawHead();
    for (const r of rows) {
      if (doc.y > doc.page.height - 60) { doc.addPage(); drawHead(); }
      let x = x0; const y = doc.y;
      doc.fontSize(8).fillColor(r._warn ? "#b45309" : "#222");
      cols.forEach((c) => { doc.text(String(r[c.k] ?? ""), x, y, { width: c.w - 4, lineBreak: false, ellipsis: true }); x += c.w; });
      doc.moveDown(0.7);
    }
    doc.moveDown();
  };
  doc.fontSize(12).fillColor("#111").text("Resumen por empleado").moveDown(0.4);
  table([
    { k: "empleado", t: "Empleado", w: 150 }, { k: "legajo", t: "Legajo", w: 50 }, { k: "sucursal", t: "Sucursal", w: 110 },
    { k: "turnos", t: "Turnos", w: 45 }, { k: "asistidos", t: "Asistidos", w: 50 }, { k: "ausencias", t: "Ausencias", w: 55 },
    { k: "tardanzas", t: "Tardanzas", w: 55 }, { k: "salidas_anticipadas", t: "Sal. antic.", w: 55 }, { k: "incompletas", t: "Incompl.", w: 50 },
    { k: "correcciones", t: "Correc.", w: 45 }, { k: "trab", t: "Trabajado", w: 55 }, { k: "adic", t: "Adic. a revisar", w: 70 },
  ], rep.summary.map((s) => ({ ...s, trab: fmtMinutes(s.min_trabajados), adic: fmtMinutes(s.min_adicionales_a_revisar), _warn: s.ausencias || s.incompletas })));
  const novedades = rep.detail.filter((d) => d.status !== "finished" || d.min_tarde || d.min_salida_anticipada || d.origen_entrada === "Corrección" || d.origen_salida === "Corrección");
  if (novedades.length) {
    doc.addPage();
    doc.fontSize(12).fillColor("#111").text("Detalle de novedades").moveDown(0.4);
    table([
      { k: "fecha", t: "Fecha", w: 55 }, { k: "empleado", t: "Empleado", w: 140 }, { k: "sucursal", t: "Sucursal", w: 100 }, { k: "turno", t: "Turno", w: 65 },
      { k: "entrada", t: "Entrada", w: 45 }, { k: "origen_entrada", t: "Origen", w: 60 }, { k: "salida", t: "Salida", w: 45 }, { k: "origen_salida", t: "Origen", w: 60 },
      { k: "estado", t: "Estado", w: 110 }, { k: "min_tarde", t: "Tarde", w: 35 }, { k: "min_salida_anticipada", t: "Antes", w: 35 },
    ], novedades.map((d) => ({ ...d, _warn: d.origen_entrada === "Corrección" || d.origen_salida === "Corrección" })));
  }
  doc.fontSize(7).fillColor("#666").text("Origen 'Corrección': fichada cargada administrativamente con motivo y aprobación; no validada por GPS/QR. 'Adic. a revisar' no equivale a horas extra liquidadas.");
  doc.end();
  return new NextResponse(new Uint8Array(await done), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
}
