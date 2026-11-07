/**
 * Minimización de datos personales antes de guardar o enviar a un modelo.
 * Teléfonos y correos no son necesarios para la gestión operativa.
 */
export interface PrivacySettings {
  redact_phones: boolean;
  redact_emails: boolean;
  retention_days: number | null;
  ai_enabled: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  redact_phones: true,
  redact_emails: true,
  retention_days: null,
  ai_enabled: true,
};

export function readPrivacy(settings: unknown): PrivacySettings {
  return { ...DEFAULT_PRIVACY, ...((settings as Partial<PrivacySettings>) ?? {}) };
}

// Secuencias tipo teléfono: +54 9 223 555-1234, 2235551234, (011) 4555-1234…
const PHONE_RE = /(?<![\w/])\+?\(?\d[\d\s().\-]{6,}\d(?![\w/])/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export function redactText(text: string, s: Pick<PrivacySettings, "redact_phones" | "redact_emails">): string {
  let out = text;
  if (s.redact_emails) out = out.replace(EMAIL_RE, "[email oculto]");
  if (s.redact_phones) {
    out = out.replace(PHONE_RE, (m) => {
      const digits = m.replace(/\D/g, "");
      // Sólo 8+ dígitos: no tapa horas, cantidades ni montos cortos.
      if (digits.length < 8) return m;
      return `[tel ••${digits.slice(-2)}]`;
    });
  }
  return out;
}

/** Autores que son números sin agendar se muestran como "Contacto ••34". */
export function redactAuthor(author: string, s: Pick<PrivacySettings, "redact_phones">): string {
  const digits = author.replace(/\D/g, "");
  if (s.redact_phones && digits.length >= 8 && /^[+\d\s().\-  ]+$/.test(author.trim())) {
    return `Contacto ••${digits.slice(-2)}`;
  }
  return author;
}

/** Patrones típicos de inyección de instrucciones dentro de mensajes importados. */
const INJECTION_PATTERNS = [
  /ignor(a|á|e|ar|en|en)\s+(todas?\s+)?(las\s+)?(instrucciones|indicaciones|reglas)/i,
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+(instructions|rules)/i,
  /(system|sistema)\s*prompt/i,
  /\byou are now\b/i,
  /a partir de ahora (sos|eres) /i,
  /marc(a|á|ar)\s+(todas?|todo)\s+(las\s+)?(tareas\s+)?como\s+(cumplid|hech|resuelt)/i,
  /<\/?(system|instructions|assistant)>/i,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}
