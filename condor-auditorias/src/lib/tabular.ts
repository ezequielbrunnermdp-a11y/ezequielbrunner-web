// Lectura de archivos CSV / XLSX cargados por el usuario (sin integraciones automáticas).
import Papa from 'papaparse';

export type Row = Record<string, string | number | null>;

export async function readTabular(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file');
    const rows = await readXlsxFile(file);
    if (!rows.length) return [];
    const headers = rows[0].map((h, i) => String(h ?? `col_${i + 1}`).trim());
    return rows.slice(1).filter((r) => r.some((c) => c != null && c !== '')).map((r) =>
      Object.fromEntries(headers.map((h, i) => {
        const v = r[i];
        return [h, v instanceof Date ? v.toISOString().slice(0, 10) : (v as string | number | null) ?? null];
      })));
  }
  const text = await file.text();
  const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, dynamicTyping: false, transformHeader: (h) => h.trim() });
  return res.data;
}

/** "1.234,56" | "1234.56" | "$ 1.234" → número */
export function parseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[$\s]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeKey(k: string): string {
  return k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
