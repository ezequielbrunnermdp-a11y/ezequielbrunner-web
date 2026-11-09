export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function fmtTime(d: Date | string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}
export function fmtDate(d: Date | string, tz = DEFAULT_TZ, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: tz, ...opts }).format(new Date(d));
}
export function fmtDateTime(d: Date | string, tz = DEFAULT_TZ): string {
  return `${fmtDate(d, tz)} ${fmtTime(d, tz)}`;
}
/** Fecha local "YYYY-MM-DD" en la zona horaria indicada. */
export function localDate(d: Date | string = new Date(), tz = DEFAULT_TZ): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d));
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fmtMinutes(min: number): string {
  const sign = min < 0 ? "-" : "";
  const m = Math.abs(Math.round(min));
  return `${sign}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
}
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function tzOffsetMs(at: number, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(at));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(at / 1000) * 1000;
}

/** Convierte fecha + hora locales de una zona horaria a un instante UTC. */
export function zonedToUtc(date: string, time = "00:00", tz = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz);
  return new Date(t);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
