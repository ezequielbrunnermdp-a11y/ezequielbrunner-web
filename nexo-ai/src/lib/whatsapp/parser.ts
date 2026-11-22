/**
 * Lector de exportaciones de WhatsApp (.txt).
 *
 * Soporta:
 *  - Android: "12/03/2024, 09:15 - Nombre: texto"
 *  - iOS:     "[12/03/24, 09:15:32] Nombre: texto"
 *  - 12 h con "a. m." / "p. m." / "AM" / "PM" (incluye espacios finos U+202F)
 *  - Separadores de fecha "/", "." y "-", años de 2 o 4 dígitos, formato ISO (AAAA-MM-DD)
 *  - Orden de fecha día/mes o mes/día (detección automática o forzada)
 *  - Mensajes multilínea, mensajes del sistema, multimedia omitida,
 *    mensajes eliminados y editados, marcas bidireccionales invisibles.
 *
 * No hace I/O: recibe texto y devuelve mensajes con su línea de origen.
 */

export type DateOrder = "DMY" | "MDY" | "YMD";
export type MessageKind = "text" | "media" | "system" | "deleted";

export interface ParsedMessage {
  /** Línea (1-based) donde empieza el mensaje en el archivo original. */
  line: number;
  /** Texto original completo del mensaje, tal como aparecía en el archivo. */
  raw: string;
  /** Hora local "AAAA-MM-DDTHH:MM:SS" (WhatsApp no exporta zona horaria). */
  sentAt: string;
  author: string | null;
  body: string;
  kind: MessageKind;
  edited: boolean;
}

export interface ParseResult {
  messages: ParsedMessage[];
  dateOrder: DateOrder;
  dateOrderAmbiguous: boolean;
  authors: string[];
  warnings: string[];
}

export interface ParseOptions {
  dateOrder?: DateOrder | "auto";
}

const BIDI = /[‎‏‪-‮⁦-⁩﻿]/g;

const HEADER =
  /^(\[)?(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([aApP]\.?\s?[mM]\.?)?\s*(?:(\])\s*|[-–]\s+)(.*)$/;

const AUTHOR = /^([^:\n]{1,120}?):(?:\s([\s\S]*))?$/;

const SYSTEM_PATTERNS = [
  /cifrados de extremo a extremo/i,
  /end-to-end encrypted/i,
  /\b(creó|created) (el |este |this )?(grupo|group)/i,
  /\b(añadió|agregó|added) /i,
  /\bse unió\b|\bjoined using\b/i,
  /\b(salió|left)$/i,
  /\b(eliminó|removed) a?\s/i,
  /\bcambió (el asunto|la descripción|el ícono|la imagen|la foto|su número)/i,
  /\bchanged (the subject|the group description|this group's icon|their phone number)/i,
  /\b(ahora es admin|now an admin)/i,
  /\bmensajes temporales\b|\bdisappearing messages\b/i,
];

const MEDIA_PATTERNS = [
  /^<(multimedia omitido|media omitted)>$/i,
  /^<(adjunto|attached):\s*[^>]+>$/i,
  /^(imagen|video|audio|sticker|documento|gif|image|document|contact card|tarjeta de contacto) omitid[oa]$/i,
  /^(image|video|audio|sticker|gif|document|contact card) omitted$/i,
  /^\S+\.(jpe?g|png|webp|gif|opus|ogg|mp3|m4a|mp4|mov|pdf|vcf|docx?|xlsx?)\s*\((archivo adjunto|file attached)\)$/i,
];

const DELETED = /^(se eliminó este mensaje|eliminaste este mensaje|this message was deleted|you deleted this message|mensaje eliminado)\.?$/i;
const EDITED_SUFFIX = /\s*<(se editó este mensaje\.?|this message was edited)>\s*$/i;

interface RawHeader {
  line: number;
  rawLines: string[];
  a: number;
  b: number;
  c: number;
  aLen: number;
  hour: number;
  minute: number;
  second: number;
  ampm: "am" | "pm" | null;
  rest: string;
  restHadLrm: boolean;
}

function matchHeader(line: string): Omit<RawHeader, "line" | "rawLines"> | null {
  const clean = line.replace(/[  ]/g, " ").replace(BIDI, "").trimStart();
  const m = HEADER.exec(clean);
  if (!m) return null;
  const [, open, a, b, c, h, min, s, ap, close, rest] = m;
  // Los corchetes deben abrir y cerrar juntos (formato iOS).
  if (Boolean(open) !== Boolean(close)) return null;
  let ampm: "am" | "pm" | null = null;
  if (ap) ampm = ap.toLowerCase().startsWith("a") ? "am" : "pm";
  // iOS antepone una marca LRM al cuerpo de mensajes de sistema y adjuntos ("Grupo: \u200eJuan creó…").
  const restHadLrm = /:\s*\u200e/.test(line);
  return {
    a: Number(a),
    b: Number(b),
    c: Number(c),
    aLen: a.length,
    hour: Number(h),
    minute: Number(min),
    second: s ? Number(s) : 0,
    ampm,
    rest,
    restHadLrm,
  };
}

function detectOrder(headers: RawHeader[]): { order: DateOrder; ambiguous: boolean } {
  if (headers.some((h) => h.aLen === 4)) return { order: "YMD", ambiguous: false };
  const firstOver12 = headers.some((h) => h.a > 12);
  const secondOver12 = headers.some((h) => h.b > 12);
  if (firstOver12 && !secondOver12) return { order: "DMY", ambiguous: false };
  if (secondOver12 && !firstOver12) return { order: "MDY", ambiguous: false };
  // Sin evidencia: priorizamos día/mes (configuración regional hispana) y lo informamos.
  return { order: "DMY", ambiguous: true };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function toIso(h: RawHeader, order: DateOrder): string | null {
  let day: number, month: number, year: number;
  if (order === "YMD") [year, month, day] = [h.a, h.b, h.c];
  else if (order === "DMY") [day, month, year] = [h.a, h.b, h.c];
  else [month, day, year] = [h.a, h.b, h.c];
  if (year < 100) year += 2000;
  let hour = h.hour;
  if (h.ampm) {
    if (hour < 1 || hour > 12) return null;
    if (h.ampm === "am" && hour === 12) hour = 0;
    if (h.ampm === "pm" && hour !== 12) hour += 12;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || h.minute > 59 || h.second > 59) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null; // p. ej. 31/02
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(h.minute)}:${pad(h.second)}`;
}

function classify(author: string | null, body: string, hadLrm: boolean): MessageKind {
  if (DELETED.test(body.trim())) return "deleted";
  if (MEDIA_PATTERNS.some((re) => re.test(body.trim()))) return "media";
  if (author === null) return "system";
  if (hadLrm && SYSTEM_PATTERNS.some((re) => re.test(body))) return "system";
  return "text";
}

export function parseWhatsAppText(input: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  // 1) Agrupar líneas: cada encabezado inicia un mensaje; el resto son continuaciones.
  const headers: RawHeader[] = [];
  let orphanLines = 0;
  lines.forEach((line, i) => {
    const h = matchHeader(line);
    if (h) {
      headers.push({ ...h, line: i + 1, rawLines: [line] });
    } else if (headers.length) {
      headers[headers.length - 1].rawLines.push(line);
    } else if (line.trim()) {
      orphanLines++;
    }
  });
  if (orphanLines) warnings.push(`${orphanLines} línea(s) antes del primer mensaje fueron ignoradas.`);
  if (!headers.length) {
    return { messages: [], dateOrder: "DMY", dateOrderAmbiguous: true, authors: [], warnings: [...warnings, "No se reconoció ningún mensaje con formato de WhatsApp."] };
  }

  // 2) Orden de fecha.
  let order: DateOrder;
  let ambiguous = false;
  if (opts.dateOrder && opts.dateOrder !== "auto") order = opts.dateOrder;
  else ({ order, ambiguous } = detectOrder(headers));
  if (ambiguous) warnings.push("Orden de fecha ambiguo (ningún día mayor a 12): se asumió día/mes/año.");

  // 3) Construir mensajes.
  const messages: ParsedMessage[] = [];
  const authors = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const iso = toIso(h, order);
    if (!iso) {
      // Fecha imposible: lo tratamos como continuación del mensaje anterior.
      const prev = messages[messages.length - 1];
      if (prev) {
        prev.raw += "\n" + h.rawLines.join("\n");
        prev.body += "\n" + h.rawLines.join("\n").replace(BIDI, "");
      }
      warnings.push(`Línea ${h.line}: fecha inválida, se trató como continuación.`);
      continue;
    }
    const continuation = h.rawLines.slice(1).map((l) => l.replace(BIDI, "")).join("\n");
    const firstRest = h.rest;
    const am = AUTHOR.exec(firstRest);
    let author: string | null = null;
    let body: string;
    if (am && !/^https?$/i.test(am[1])) {
      author = am[1].trim();
      body = am[2] ?? "";
    } else {
      body = firstRest;
    }
    if (continuation) body = body ? `${body}\n${continuation}` : continuation;
    body = body.replace(/\s+$/, "");
    let edited = false;
    if (EDITED_SUFFIX.test(body)) {
      edited = true;
      body = body.replace(EDITED_SUFFIX, "");
    }
    const kind = classify(author, body, h.restHadLrm);
    if (kind === "system" && author) {
      // En iOS el "autor" de un mensaje de sistema suele ser el nombre del grupo.
      author = null;
      body = firstRest.replace(BIDI, "");
    }
    if (author) authors.add(author);
    messages.push({ line: h.line, raw: h.rawLines.join("\n"), sentAt: iso, author, body, kind, edited });
  }

  return { messages, dateOrder: order, dateOrderAmbiguous: ambiguous, authors: [...authors], warnings };
}

/** Infieren el título del chat a partir del nombre de archivo de exportación. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.(txt|zip)$/i, "");
  const m =
    /^(?:chat de whatsapp con|whatsapp chat with|whatsapp chat -|conversa do whatsapp com)\s*(.+)$/i.exec(base);
  const t = (m ? m[1] : base).replace(/_/g, " ").trim();
  return t && t.toLowerCase() !== "chat" ? t : "Conversación sin título";
}

/** Grupal si hay más de dos autores o eventos de grupo. */
export function inferKind(result: ParseResult): "group" | "individual" {
  if (result.authors.length > 2) return "group";
  if (result.messages.some((m) => m.kind === "system" && /grupo|group/i.test(m.body))) return "group";
  return "individual";
}
