// Cálculo de puntaje. Réplica exacta de public.compute_audit_score (la fuente de verdad es el servidor;
// este módulo se usa para mostrar puntajes provisionales en tiempo real, también sin conexión).
import type { Answer, Category, CategoryState, ScoreResult, CategoryResult } from './types';

export const SCALE = [
  { value: 5, label: 'Excelente' },
  { value: 4, label: 'Cumple correctamente' },
  { value: 3, label: 'Cumplimiento parcial' },
  { value: 2, label: 'Deficiente' },
  { value: 1, label: 'Incumplimiento grave' },
  { value: 0, label: 'Incumplimiento total' },
] as const;

export function classificationFor(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score >= 90) return 'EXCELENTE';
  if (score >= 80) return 'SATISFACTORIA';
  if (score >= 70) return 'EN OBSERVACIÓN';
  return 'DEFICIENTE';
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const blank = (s: string | null | undefined) => !s || s.trim() === '';

export type AnswerState = 'pendiente' | 'respondida' | 'incompleta';

/** Estado de una respuesta individual (para la interfaz). */
export function answerState(a: Answer | undefined): AnswerState {
  if (!a || (a.score == null && !a.not_applicable)) return 'pendiente';
  if (a.not_applicable && blank(a.na_reason)) return 'incompleta';
  if (a.score != null && a.score <= 2 && blank(a.observation)) return 'incompleta';
  return 'respondida';
}

export function computeScore(
  categories: Category[],
  answers: Record<string, Answer | undefined>,
  states: Record<string, CategoryState | undefined>,
): ScoreResult {
  let totalWeight = 0;
  let applicableWeight = 0;
  let pendingTotal = 0;
  const errors: ScoreResult['errors'] = [];
  const cats: Omit<CategoryResult, 'effective_weight' | 'score'>[] = [];

  for (const c of [...categories].sort((a, b) => a.position - b.position)) {
    const weight = Number(c.weight);
    totalWeight += weight;
    const st = states[c.id];
    const qs = c.questions.filter((q) => q.active);
    const criticals = qs.filter((q) => answers[q.id]?.is_critical).length;
    if (st?.not_applicable) {
      if (blank(st.na_reason)) errors.push({ category: c.name, error: 'Falta justificar por qué la categoría no aplica' });
      cats.push({ category_id: c.id, code: c.code, name: c.name, weight, applicable: false, na_reason: st.na_reason, obtained: 0, max: 0, pct: null, criticals });
      continue;
    }
    let scored = 0, obtained = 0, pending = 0, naQ = 0, naUnj = 0, obsMissing = 0;
    for (const q of qs) {
      const a = answers[q.id];
      if (!a || (a.score == null && !a.not_applicable)) { pending++; continue; }
      if (a.not_applicable) { naQ++; if (blank(a.na_reason)) naUnj++; continue; }
      scored++;
      obtained += a.score!;
      if (a.score! <= 2 && blank(a.observation)) obsMissing++;
    }
    pendingTotal += pending;
    if (pending > 0) errors.push({ category: c.name, error: `${pending} pregunta(s) pendiente(s)` });
    if (naUnj > 0) errors.push({ category: c.name, error: `${naUnj} "No aplica" sin justificar` });
    if (obsMissing > 0) errors.push({ category: c.name, error: `${obsMissing} puntaje(s) de 0 a 2 sin observación` });
    if (scored === 0 && pending === 0)
      errors.push({ category: c.name, error: 'Todas las preguntas son "No aplica": marque la categoría completa como no aplicable y justifique' });
    if (scored > 0) applicableWeight += weight;
    cats.push({
      category_id: c.id, code: c.code, name: c.name, weight, applicable: scored > 0, obtained, max: scored * 5,
      pct: scored > 0 ? round((obtained / (scored * 5)) * 100, 2) : null, criticals, na_questions: naQ,
    });
  }

  const categoriesOut: CategoryResult[] = cats.map((c) => {
    if (c.applicable && applicableWeight > 0) {
      const eff = (c.weight * totalWeight) / applicableWeight;
      return { ...c, effective_weight: round(eff, 4), score: round(((eff * c.obtained) / c.max) * 100 / totalWeight, 4) };
    }
    return { ...c, effective_weight: 0, score: null };
  });
  const sum = categoriesOut.reduce((s, c) => s + (c.score ?? 0), 0);
  const final = applicableWeight > 0 ? round(sum, 2) : null;
  return {
    final_score: final,
    classification: classificationFor(final),
    total_weight: totalWeight,
    applicable_weight: applicableWeight,
    redistributed: applicableWeight < totalWeight,
    pending: pendingTotal,
    errors,
    categories: categoriesOut,
  };
}

/** Puntaje provisional de una categoría sobre su ponderación nominal (para el avance en pantalla). */
export function provisionalCategory(c: Category, answers: Record<string, Answer | undefined>) {
  const qs = c.questions.filter((q) => q.active);
  let answered = 0, scored = 0, obtained = 0, incomplete = 0;
  for (const q of qs) {
    const a = answers[q.id];
    const s = answerState(a);
    if (s !== 'pendiente') answered++;
    if (s === 'incompleta') incomplete++;
    if (a && !a.not_applicable && a.score != null) { scored++; obtained += a.score; }
  }
  return {
    total: qs.length,
    answered,
    incomplete,
    progress: qs.length ? answered / qs.length : 0,
    pct: scored ? (obtained / (scored * 5)) * 100 : null,
  };
}
