// Las marcas temporales se guardan en UTC (timestamptz) y se presentan en la
// zona horaria de la organización (por defecto America/Argentina/Buenos_Aires).
export const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';
let currentTz = DEFAULT_TZ;
export const setTimeZone = (tz?: string | null) => { currentTz = tz || DEFAULT_TZ; };
export const getTimeZone = () => currentTz;

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts) + currentTz;
  let f = cache.get(key);
  if (!f) { f = new Intl.DateTimeFormat('es-AR', { timeZone: currentTz, ...opts }); cache.set(key, f); }
  return f;
}
const d = (v: string | number | Date) => (v instanceof Date ? v : new Date(v));

export const fmtTime = (v: string | Date) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d(v));
export const fmtDate = (v: string | Date) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(d(v));
export const fmtDayShort = (v: string | Date) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(d(v));
export const fmtDayLong = (v: string | Date) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d(v));
export const fmtDateTime = (v: string | Date) => fmt({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d(v));
export const fmtWeekday = (v: string | Date) => fmt({ weekday: 'short' }).format(d(v));

/** Fecha local YYYY-MM-DD de un instante, en la zona horaria configurada. */
export function localDate(v: string | Date = new Date(), tz = currentTz): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d(v));
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Offset (minutos) de la zona horaria para un instante dado. */
function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Convierte fecha local + hora local de la sucursal a un instante UTC (ISO). */
export function zonedToUtc(date: string, time: string, tz = currentTz): string {
  const [y, m, dd] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y!, m! - 1, dd!, hh!, mm!));
  const off = tzOffsetMinutes(guess, tz);
  const result = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffsetMinutes(result, tz);
  return (off2 === off ? result : new Date(guess.getTime() - off2 * 60000)).toISOString();
}

/** Construye inicio/fin de un turno. Si la salida es <= ingreso, termina al día siguiente (jornada nocturna). */
export function buildShiftRange(date: string, start: string, end: string, tz = currentTz) {
  const startsAt = zonedToUtc(date, start, tz);
  let endDate = date;
  if (end <= start) endDate = addDays(date, 1);
  const endsAt = zonedToUtc(endDate, end, tz);
  return { startsAt, endsAt, overnight: endDate !== date };
}

export function addDays(date: string, n: number): string {
  const [y, m, dd] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, dd! + n));
  return t.toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha local YYYY-MM-DD. */
export function mondayOf(date: string): string {
  const [y, m, dd] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, dd!)).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

export function durationLabel(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

export function minutesBetween(a: string | Date, b: string | Date) {
  return Math.round((d(b).getTime() - d(a).getTime()) / 60000);
}

export function relativeTime(v: string | Date): string {
  const diff = (Date.now() - d(v).getTime()) / 1000;
  if (diff < 60) return 'recién';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `hace ${Math.floor(diff / 86400)} d`;
  return fmtDate(v);
}

export const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '';

export const initials = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  ((p?.first_name?.[0] || '') + (p?.last_name?.[0] || '')).toUpperCase() || '·';
