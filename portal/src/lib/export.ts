// Exportaciones profesionales generadas en el navegador a partir de datos ya
// autorizados por RLS (el servidor filtra qué filas puede ver cada rol).
export interface Column<T> { header: string; value: (row: T) => string | number | null; width?: number }

export async function exportXlsx<T>(filename: string, sheets: { name: string; title: string; subtitle?: string; columns: Column<T>[]; rows: T[] }[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal del equipo';
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.mergeCells(1, 1, 1, s.columns.length);
    ws.getCell(1, 1).value = s.title;
    ws.getCell(1, 1).font = { size: 14, bold: true };
    ws.getCell(2, 1).value = s.subtitle ?? '';
    ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF7A716A' } };
    const header = ws.getRow(4);
    s.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B3430' } };
      cell.alignment = { vertical: 'middle' };
      ws.getColumn(i + 1).width = c.width ?? 16;
    });
    header.height = 20;
    s.rows.forEach((r) => ws.addRow(s.columns.map((c) => c.value(r))));
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: s.columns.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
}

export async function exportPdf<T>(filename: string, title: string, subtitle: string, columns: Column<T>[], rows: T[], footer?: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(15); doc.setTextColor(28, 25, 23); doc.text(title, 14, 16);
  doc.setFontSize(9); doc.setTextColor(120, 112, 105); doc.text(subtitle, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(c.value(r) ?? ''))),
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [40, 36, 33] },
    headStyles: { fillColor: [59, 52, 48], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 243, 240] },
    didDrawPage: () => {
      const n = doc.getNumberOfPages();
      doc.setFontSize(7); doc.setTextColor(140);
      doc.text(`${footer ?? ''}  ·  Generado ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}  ·  Página ${n}`, 14, doc.internal.pageSize.getHeight() - 8);
    },
  });
  doc.save(`${filename}.pdf`);
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
