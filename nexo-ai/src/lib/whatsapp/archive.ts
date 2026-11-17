import { unzipSync, strFromU8 } from "fflate";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_BYTES = 20 * 1024 * 1024;

export class ImportFileError extends Error {}

export interface ExtractedChat {
  text: string;
  sourceKind: "txt" | "zip";
  /** Nombre del .txt dentro del ZIP, o el nombre del archivo subido. */
  innerName: string;
  /** Adjuntos presentes en el ZIP. No se guardan (minimización de datos); sólo se cuentan. */
  ignoredAttachments: number;
}

function isZip(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function decodeText(bytes: Uint8Array): string {
  // UTF-16 LE con BOM (algunas exportaciones antiguas de Windows).
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  const text = strFromU8(bytes);
  if (text.includes("\u0000")) throw new ImportFileError("El archivo no parece ser texto plano.");
  return text;
}

/** Acepta un .txt de WhatsApp o un .zip exportado ("Incluir archivos" o "Sin archivos"). */
export function extractChat(fileName: string, bytes: Uint8Array): ExtractedChat {
  if (bytes.length === 0) throw new ImportFileError("El archivo está vacío.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ImportFileError("El archivo supera el máximo de 25 MB.");

  if (!isZip(bytes)) {
    if (!/\.txt$/i.test(fileName)) throw new ImportFileError("Formato no soportado. Subí un .txt o .zip exportado de WhatsApp.");
    if (bytes.length > MAX_TEXT_BYTES) throw new ImportFileError("El texto supera el máximo de 20 MB.");
    return { text: decodeText(bytes), sourceKind: "txt", innerName: fileName, ignoredAttachments: 0 };
  }

  let attachments = 0;
  let candidates: string[] = [];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      // Sólo descomprimimos .txt y validamos tamaño declarado (protección ante "zip bombs").
      filter: (f) => {
        if (/(^|\/)__MACOSX\//.test(f.name) || f.name.endsWith("/")) return false;
        if (!/\.txt$/i.test(f.name)) {
          attachments++;
          return false;
        }
        if (f.originalSize > MAX_TEXT_BYTES) throw new ImportFileError("El chat dentro del ZIP supera 20 MB.");
        candidates.push(f.name);
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ImportFileError) throw e;
    throw new ImportFileError("No se pudo leer el ZIP. ¿Está dañado o protegido?");
  }
  candidates = Object.keys(entries);
  if (!candidates.length) throw new ImportFileError("El ZIP no contiene ningún archivo .txt de chat.");
  // Preferimos el archivo de chat estándar de cada plataforma.
  const pick =
    candidates.find((n) => /(^|\/)_chat\.txt$/i.test(n)) ??
    candidates.find((n) => /whatsapp/i.test(n)) ??
    candidates.sort((x, y) => entries[y].length - entries[x].length)[0];
  const text = decodeText(entries[pick]);
  if (text.length > MAX_TEXT_BYTES) throw new ImportFileError("El chat supera 20 MB.");
  return { text, sourceKind: "zip", innerName: pick, ignoredAttachments: attachments };
}
