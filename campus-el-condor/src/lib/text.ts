/** Normaliza para búsqueda: minúsculas y sin tildes ni diéresis. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesAll(haystack: string, query: string): boolean {
  const h = normalize(haystack);
  return normalize(query).split(/\s+/).filter(Boolean).every((t) => h.includes(t));
}

/** Devuelve un fragmento alrededor de la primera coincidencia, con sus límites para resaltar. */
export function snippet(text: string, query: string, radius = 70): { before: string; match: string; after: string } | null {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  // Se normaliza carácter a carácter para conservar la posición en el texto original.
  const map: number[] = [];
  let flat = '';
  for (let i = 0; i < text.length; i++) {
    const c = normalize(text[i]);
    for (let k = 0; k < c.length; k++) { flat += c[k]; map.push(i); }
  }
  let idx = -1; let term = '';
  for (const t of terms) { const j = flat.indexOf(t); if (j >= 0 && (idx < 0 || j < idx)) { idx = j; term = t; } }
  if (idx < 0) return null;
  const start = map[idx];
  const end = map[idx + term.length - 1] + 1;
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  return {
    before: (from > 0 ? '…' : '') + text.slice(from, start),
    match: text.slice(start, end),
    after: text.slice(end, to) + (to < text.length ? '…' : ''),
  };
}

export function uid(prefix = 'id'): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${r}`;
}

export function slugify(s: string) {
  return normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
