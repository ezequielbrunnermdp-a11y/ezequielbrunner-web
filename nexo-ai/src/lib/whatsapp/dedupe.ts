import { sha256 } from "../crypto";
import type { ParsedMessage } from "./parser";

/**
 * Huella estable de un mensaje dentro de una conversación.
 *
 * WhatsApp no exporta IDs de mensaje, así que la identidad se arma con
 * hora + autor + tipo + texto normalizado. Si el mismo autor envía el mismo
 * texto varias veces en el mismo minuto, el número de ocurrencia los distingue,
 * de modo que reimportar el mismo archivo (o una exportación más reciente que
 * se superpone) no duplica nada y tampoco descarta repeticiones legítimas.
 */
export function normalizeBody(body: string): string {
  return body.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function messageKey(m: Pick<ParsedMessage, "sentAt" | "author" | "kind" | "body">): string {
  return [m.sentAt, (m.author ?? "").normalize("NFC").trim(), m.kind, normalizeBody(m.body)].join("|");
}

export function computeContentHashes(messages: ParsedMessage[]): string[] {
  const seen = new Map<string, number>();
  return messages.map((m) => {
    const key = messageKey(m);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return sha256(`${key}|${occurrence}`);
  });
}
