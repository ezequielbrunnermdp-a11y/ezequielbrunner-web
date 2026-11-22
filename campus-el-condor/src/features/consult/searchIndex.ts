import { MODULES } from '../../content/modules';
import { QUESTIONS } from '../../content/questions';
import { SCENARIOS } from '../../content/scenarios';
import { BASE_RESOURCES, FAQ, PRACTICE_PRODUCTS, VIDEO_SCRIPTS } from '../../content/library';
import type { Block, Resource } from '../../content/types';
import type { LocalContent } from '../../storage/schema';
import { matchesAll, normalize, snippet } from '../../lib/text';

export type SearchCategory = 'Lecciones' | 'Preguntas frecuentes' | 'Casos' | 'Evaluación' | 'Productos' | 'Códigos' | 'Promociones' | 'Biblioteca' | 'Videos';

export interface SearchDoc {
  id: string;
  category: SearchCategory;
  title: string;
  context: string; // ubicación legible
  text: string;
  href: string;
  favId?: string;
}

function blockText(b: Block): string {
  switch (b.type) {
    case 'p': return b.text;
    case 'list': return b.items.join(' · ');
    case 'example': return b.text;
    case 'phrases': return b.items.join(' ');
    case 'callout': return `${b.title}. ${b.text}`;
    case 'dodont': return [...b.doText, ...b.dontText].join(' · ');
    case 'moments': return b.items.map((m) => `${m.title}. ${m.summary} ${m.useful} ${m.mistake} ${m.example}`).join(' ');
    case 'stations': return b.items.map((s) => `${s.title}: ${s.text}`).join(' · ');
    case 'pendingDoc': return b.text;
    default: return '';
  }
}

export function resolveResources(c: LocalContent): Resource[] {
  return [...BASE_RESOURCES.map((r) => ({ ...r, ...(c.resources[r.id] ?? {}) })), ...c.customResources];
}

export function buildIndex(c: LocalContent): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const m of MODULES) {
    for (const l of m.lessons) {
      docs.push({ id: l.id, category: 'Lecciones', title: l.title, context: `Módulo ${m.number} · ${m.title}`, text: l.blocks.map(blockText).join(' '), href: `#/aprender/${m.id}?l=${l.id}`, favId: `lesson:${l.id}` });
    }
    docs.push({ id: `${m.id}-sintesis`, category: 'Lecciones', title: `Síntesis: ${m.title}`, context: `Módulo ${m.number}`, text: `${m.objective} ${m.synthesis.join(' ')} ${m.closing}`, href: `#/aprender/${m.id}?l=${m.id}-sintesis` });
  }
  for (const f of FAQ) docs.push({ id: f.id, category: 'Preguntas frecuentes', title: f.q, context: 'Ayuda rápida', text: f.a, href: f.link });
  for (const s of SCENARIOS) docs.push({ id: s.id, category: 'Casos', title: s.title, context: 'Casos interactivos', text: `${s.context} ${s.steps.map((x) => x.situation).join(' ')} ${s.explanation}`, href: `#/casos/${s.id}` });
  for (const q of QUESTIONS) docs.push({ id: q.id, category: 'Evaluación', title: q.prompt, context: `Pregunta ${q.id} · Módulo ${q.moduleId.slice(1)}`, text: `${q.expected} ${q.explanation}`, href: `#/facilitador?m=${q.moduleId}&i=${QUESTIONS.filter((x) => x.moduleId === q.moduleId).indexOf(q)}` });
  for (const v of VIDEO_SCRIPTS) docs.push({ id: v.id, category: 'Videos', title: v.title, context: 'Guion de video', text: v.script, href: `#/videos?v=${v.id}` });
  const products = c.products.length ? c.products : PRACTICE_PRODUCTS;
  for (const p of products) {
    docs.push({ id: p.id, category: 'Productos', title: p.name, context: `${p.isExample ? 'Práctica · ' : ''}${p.category}`, text: `${p.description} ${p.variants.join(' ')} ${p.code ?? ''}`, href: `#/consultar/productos?p=${p.id}`, favId: `product:${p.id}` });
  }
  for (const k of c.codes) docs.push({ id: `code-${k.code}`, category: 'Códigos', title: `${k.code} · ${k.name}`, context: k.category || 'Códigos', text: `${k.variant} ${k.notes}`, href: `#/consultar/codigos?q=${encodeURIComponent(k.code)}`, favId: `code:${k.code}` });
  for (const p of c.promotions) docs.push({ id: p.id, category: 'Promociones', title: p.title || p.entity, context: p.entity, text: `${p.paymentMethod} ${p.conditions} ${p.exclusions}`, href: `#/consultar/promociones?p=${p.id}` });
  for (const r of resolveResources(c)) docs.push({ id: r.id, category: 'Biblioteca', title: r.title, context: r.category, text: `${r.description} ${r.searchText ?? ''}`, href: `#/consultar/biblioteca?r=${r.id}`, favId: `resource:${r.id}` });
  return docs;
}

export interface SearchHit { doc: SearchDoc; snip: ReturnType<typeof snippet>; score: number }

export function search(docs: SearchDoc[], query: string): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalize(q);
  return docs
    .filter((d) => matchesAll(`${d.title} ${d.context} ${d.text}`, q))
    .map((d) => {
      const inTitle = normalize(d.title).includes(nq);
      return { doc: d, snip: snippet(d.text, q) ?? snippet(d.title, q), score: (inTitle ? 10 : 0) + (d.category === 'Lecciones' ? 2 : 0) };
    })
    .sort((a, b) => b.score - a.score);
}
