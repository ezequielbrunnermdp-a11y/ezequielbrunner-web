/* Fechas civiles y moneda en formato argentino. Las fechas civiles (AAAA-MM-DD) no se
   convierten a UTC: se comparan como texto contra "hoy" calculado en Buenos Aires. */
export const AR_TZ = 'America/Argentina/Buenos_Aires';

const civilFmt = new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha civil de hoy en Argentina, como AAAA-MM-DD. */
export function todayAR(now: Date = new Date()): string {
  return civilFmt.format(now);
}

/** Día de la semana (0 = domingo) de una fecha civil, sin depender de la zona del dispositivo. */
export function weekdayOfCivil(civil: string): number {
  const [y, m, d] = civil.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isCivilDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 2026-11-22 → "22 de noviembre de 2026" */
export function formatCivil(civil: string | null | undefined): string {
  if (!civil || !isCivilDate(civil)) return 'Sin fecha';
  const [y, m, d] = civil.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function formatCivilShort(civil: string | null | undefined): string {
  if (!civil || !isCivilDate(civil)) return '—';
  const [y, m, d] = civil.split('-');
  return `${d}/${m}/${y}`;
}

const tsFmt = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/** Marca de tiempo ISO → "22 de noviembre de 2026, 14:05" (hora de Argentina). */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Sin registro';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin registro';
  return tsFmt.format(d);
}

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** null se muestra como dato faltante, nunca como $ 0. */
export function formatMoney(v: number | null | undefined, missing = 'Precio sin informar'): string {
  if (v === null || v === undefined || Number.isNaN(v)) return missing;
  return money.format(v);
}

export function formatPercent(p: number | null | undefined): string {
  if (p === null || p === undefined) return 'Sin dato';
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(p)} %`;
}

/** Interpreta importes escritos en formato argentino ("12.500,50") o simple ("12500.5"). */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/\$|\s/g, '');
  if (!s) return null;
  let norm = s;
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, '');
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
