import type { CodeRecord } from '../content/types';
import { parseCSV } from './csv';
import { normalize } from './text';

export interface RowIssue { row: number; message: string }

export interface CodesPreview {
  valid: CodeRecord[];
  errors: RowIssue[];
  warnings: RowIssue[];
  columns: string[];
  missingColumns: string[];
  totalRows: number;
}

const ALIASES: Record<keyof CodeRecord, string[]> = {
  code: ['codigo', 'code', 'cod', 'plu', 'id'],
  name: ['nombre', 'producto', 'name', 'descripcion', 'articulo'],
  category: ['categoria', 'rubro', 'category', 'familia'],
  variant: ['variante', 'variant', 'tamano', 'presentacion'],
  notes: ['observaciones', 'notas', 'notes', 'obs'],
};

function mapHeader(h: string): keyof CodeRecord | null {
  const n = normalize(h).trim().replace(/[^a-z]/g, '');
  for (const [k, list] of Object.entries(ALIASES) as [keyof CodeRecord, string[]][]) if (list.includes(n)) return k;
  return null;
}

function fromObjects(rows: Record<string, unknown>[]): { headers: string[]; records: Record<string, string>[] } {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return { headers, records: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]))) };
}

/** Valida un CSV o JSON de códigos sin tocar el catálogo vigente. */
export function previewCodes(text: string, format: 'csv' | 'json', existing: CodeRecord[]): CodesPreview {
  let headers: string[] = [];
  let records: Record<string, string>[] = [];
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];

  if (format === 'json') {
    let data: unknown;
    try { data = JSON.parse(text); } catch { return { valid: [], errors: [{ row: 0, message: 'El archivo no es un JSON válido.' }], warnings: [], columns: [], missingColumns: [], totalRows: 0 }; }
    const arr = Array.isArray(data) ? data : (typeof data === 'object' && data && Array.isArray((data as { codes?: unknown }).codes) ? (data as { codes: unknown[] }).codes : null);
    if (!arr) return { valid: [], errors: [{ row: 0, message: 'Se esperaba una lista de códigos o un objeto con la propiedad “codes”.' }], warnings: [], columns: [], missingColumns: [], totalRows: 0 };
    const objs = arr.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x));
    if (objs.length !== arr.length) errors.push({ row: 0, message: `${arr.length - objs.length} elemento(s) no son objetos y se ignoran.` });
    ({ headers, records } = fromObjects(objs));
  } else {
    const rows = parseCSV(text);
    if (!rows.length) return { valid: [], errors: [{ row: 0, message: 'El archivo está vacío.' }], warnings: [], columns: [], missingColumns: [], totalRows: 0 };
    headers = rows[0].map((h) => h.trim());
    records = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '')])));
  }

  const mapping = new Map<string, keyof CodeRecord>();
  headers.forEach((h) => { const k = mapHeader(h); if (k && ![...mapping.values()].includes(k)) mapping.set(h, k); });
  const mapped = new Set(mapping.values());
  const missingColumns = (['code', 'name'] as const).filter((k) => !mapped.has(k)).map((k) => (k === 'code' ? 'codigo' : 'nombre'));
  if (missingColumns.length) {
    return { valid: [], errors: [{ row: 0, message: `Faltan columnas obligatorias: ${missingColumns.join(', ')}.` }], warnings: [], columns: headers, missingColumns, totalRows: records.length };
  }
  const unknown = headers.filter((h) => !mapping.has(h));
  if (unknown.length) warnings.push({ row: 0, message: `Columnas no reconocidas que se ignoran: ${unknown.join(', ')}.` });

  const seen = new Map<string, number>();
  const existingCodes = new Set(existing.map((c) => c.code));
  const valid: CodeRecord[] = [];
  records.forEach((r, i) => {
    const rowNum = format === 'csv' ? i + 2 : i + 1; // CSV: la fila 1 es el encabezado
    const rec: CodeRecord = { code: '', name: '', category: '', variant: '', notes: '' };
    for (const [h, k] of mapping) rec[k] = (r[h] ?? '').trim();
    if (!rec.code) { errors.push({ row: rowNum, message: 'Falta el código.' }); return; }
    if (/\s/.test(rec.code)) { errors.push({ row: rowNum, message: `El código “${rec.code}” contiene espacios.` }); return; }
    if (!rec.name) { errors.push({ row: rowNum, message: `El código “${rec.code}” no tiene nombre.` }); return; }
    if (seen.has(rec.code)) { errors.push({ row: rowNum, message: `Código “${rec.code}” duplicado (ya figura en la fila ${seen.get(rec.code)}).` }); return; }
    seen.set(rec.code, rowNum);
    if (existingCodes.has(rec.code)) warnings.push({ row: rowNum, message: `El código “${rec.code}” ya existe y se reemplazará.` });
    valid.push(rec);
  });
  return { valid, errors, warnings, columns: headers, missingColumns: [], totalRows: records.length };
}

export function mergeCodes(existing: CodeRecord[], incoming: CodeRecord[], mode: 'merge' | 'replace'): CodeRecord[] {
  if (mode === 'replace') return [...incoming];
  const map = new Map(existing.map((c) => [c.code, c]));
  incoming.forEach((c) => map.set(c.code, c));
  return [...map.values()];
}
