import cuestionario from '../supabase/seed/cuestionario_v1.json';
import type { Answer, Category } from '../src/lib/types';

type Q = string | { text: string; guidance?: string; critical?: boolean };

/** Cuestionario v1 en memoria (mismo origen que la migración de datos iniciales). */
export function categoriesV1(): Category[] {
  return (cuestionario as { code: string; name: string; weight: number; extras: string | null; kind?: string; description?: string; questions: Q[] }[]).map((c, i) => ({
    id: `cat-${c.code}`,
    version_id: 'v1',
    position: i + 1,
    code: c.code,
    name: c.name,
    weight: c.weight,
    description: c.description ?? null,
    extras: c.extras as Category['extras'],
    kind: c.kind === 'document' ? 'documento' : 'puntaje',
    questions: c.questions.map((q, j) => {
      const o = typeof q === 'string' ? { text: q } : q;
      return { id: `q-${c.code}-${j + 1}`, category_id: `cat-${c.code}`, position: j + 1, text: o.text, guidance: o.guidance ?? null, critical_control: !!o.critical, active: true };
    }),
  }));
}

export function answer(qid: string, patch: Partial<Answer>): Answer {
  return { audit_id: 'a1', question_id: qid, score: null, not_applicable: false, na_reason: null, observation: null, recommendation: null, is_critical: false, doc_status: null, doc_expiry: null, ...patch };
}

export function allAnswers(cats: Category[], score: number) {
  const out: Record<string, Answer> = {};
  cats.forEach((c) => c.questions.forEach((q) => { out[q.id] = answer(q.id, { score }); }));
  return out;
}
