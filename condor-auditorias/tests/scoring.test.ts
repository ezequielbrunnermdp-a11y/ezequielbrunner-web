import { describe, expect, it } from 'vitest';
import { computeScore, classificationFor, answerState } from '../src/lib/scoring';
import { categoriesV1, allAnswers, answer } from './fixtures';

const cats = categoriesV1();

describe('cuestionario v1', () => {
  it('tiene 15 categorías, ponderaciones que suman 100 y 196 preguntas', () => {
    expect(cats).toHaveLength(15);
    expect(cats.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(cats.reduce((s, c) => s + c.questions.length, 0)).toBe(196);
  });
});

describe('cálculo sobre 100 puntos', () => {
  it('todo en 5 = 100 EXCELENTE', () => {
    const r = computeScore(cats, allAnswers(cats, 5), {});
    expect(r.final_score).toBe(100);
    expect(r.classification).toBe('EXCELENTE');
    expect(r.errors).toHaveLength(0);
  });

  it('todo en 4 = 80 SATISFACTORIA; todo en 3 = 60 DEFICIENTE', () => {
    expect(computeScore(cats, allAnswers(cats, 4), {}).final_score).toBe(80);
    const r3 = computeScore(cats, allAnswers(cats, 3), {});
    expect(r3.final_score).toBe(60);
  });

  it('puntaje de categoría = peso × obtenidos / máximos aplicables', () => {
    const a = allAnswers(cats, 5);
    const hig = cats.find((c) => c.code === 'higiene_bromatologia')!;
    hig.questions.slice(0, 5).forEach((q) => { a[q.id] = answer(q.id, { score: 0, observation: 'falla' }); });
    const r = computeScore(cats, a, {});
    const c = r.categories.find((x) => x.code === 'higiene_bromatologia')!;
    expect(c.obtained).toBe(100);
    expect(c.max).toBe(125);
    expect(c.score).toBeCloseTo(20 * 100 / 125, 4); // 16
    expect(r.final_score).toBe(96);
  });

  it('las preguntas pendientes no cuentan como cero y bloquean la finalización', () => {
    const a = allAnswers(cats, 5);
    delete a[cats[0].questions[0].id];
    const r = computeScore(cats, a, {});
    expect(r.pending).toBe(1);
    expect(r.final_score).toBe(100); // no se toma como 0
    expect(r.errors.some((e) => e.error.includes('pendiente'))).toBe(true);
  });

  it('"No aplica" se excluye del máximo y exige justificación', () => {
    const a = allAnswers(cats, 4);
    const q = cats[12].questions[0];
    a[q.id] = answer(q.id, { not_applicable: true });
    let r = computeScore(cats, a, {});
    expect(r.final_score).toBe(80);
    expect(r.errors).toHaveLength(1);
    a[q.id] = answer(q.id, { not_applicable: true, na_reason: 'Sin delivery por aplicación' });
    r = computeScore(cats, a, {});
    expect(r.errors).toHaveLength(0);
    expect(r.categories[12].max).toBe(45);
  });

  it('puntajes 0, 1 o 2 exigen observación', () => {
    const a = allAnswers(cats, 5);
    const q = cats[3].questions[4];
    for (const s of [0, 1, 2]) {
      a[q.id] = answer(q.id, { score: s });
      expect(computeScore(cats, a, {}).errors.some((e) => e.error.includes('sin observación'))).toBe(true);
      expect(answerState(a[q.id])).toBe('incompleta');
    }
    a[q.id] = answer(q.id, { score: 3 });
    expect(computeScore(cats, a, {}).errors).toHaveLength(0);
  });

  it('categoría no aplicable: exige justificación y redistribuye pesos proporcionalmente', () => {
    const a = allAnswers(cats, 5);
    const club = cats.find((c) => c.code === 'club_condor')!;
    const mk = cats.find((c) => c.code === 'marketing')!;
    mk.questions.forEach((q) => { a[q.id] = answer(q.id, { score: 0, observation: 'sin campañas' }); });
    let r = computeScore(cats, a, { [club.id]: { audit_id: 'a1', category_id: club.id, not_applicable: true, na_reason: '', extras: {} } });
    expect(r.errors.some((e) => e.error.includes('justificar'))).toBe(true);
    r = computeScore(cats, a, { [club.id]: { audit_id: 'a1', category_id: club.id, not_applicable: true, na_reason: 'No adhiere al Club', extras: {} } });
    expect(r.redistributed).toBe(true);
    expect(r.applicable_weight).toBe(97);
    // Marketing (3) en 0 sobre 97 aplicables → 100 − 3/97·100
    expect(r.final_score).toBeCloseTo(100 - (3 / 97) * 100, 2);
    const mkRes = r.categories.find((c) => c.code === 'marketing')!;
    expect(mkRes.effective_weight).toBeCloseTo((3 * 100) / 97, 3);
  });

  it('todas las preguntas N/A sin marcar la categoría es un error', () => {
    const a = allAnswers(cats, 5);
    const del = cats.find((c) => c.code === 'delivery')!;
    del.questions.forEach((q) => { a[q.id] = answer(q.id, { not_applicable: true, na_reason: 'x' }); });
    const r = computeScore(cats, a, {});
    expect(r.errors.some((e) => e.error.includes('marque la categoría completa'))).toBe(true);
  });

  it('paridad con el cálculo del servidor (escenario de tests/db/pruebas.sql = 79,51)', () => {
    const a = allAnswers(cats, 4);
    const delq = cats.find((c) => c.code === 'delivery')!.questions[0];
    a[delq.id] = answer(delq.id, { not_applicable: true, na_reason: 'No opera delivery' });
    const hq = cats.find((c) => c.code === 'higiene_bromatologia')!.questions[4];
    a[hq.id] = answer(hq.id, { score: 1, observation: 'Heladera a 11 °C', is_critical: true });
    const club = cats.find((c) => c.code === 'club_condor')!;
    const r = computeScore(cats, a, { [club.id]: { audit_id: 'a1', category_id: club.id, not_applicable: true, na_reason: 'No participa', extras: {} } });
    expect(r.final_score).toBe(79.51);
    expect(r.classification).toBe('EN OBSERVACIÓN');
    expect(r.categories.find((c) => c.code === 'higiene_bromatologia')!.criticals).toBe(1);
  });
});

describe('clasificación', () => {
  it('respeta los umbrales', () => {
    expect(classificationFor(100)).toBe('EXCELENTE');
    expect(classificationFor(90)).toBe('EXCELENTE');
    expect(classificationFor(89.99)).toBe('SATISFACTORIA');
    expect(classificationFor(80)).toBe('SATISFACTORIA');
    expect(classificationFor(79.99)).toBe('EN OBSERVACIÓN');
    expect(classificationFor(70)).toBe('EN OBSERVACIÓN');
    expect(classificationFor(69.99)).toBe('DEFICIENTE');
    expect(classificationFor(null)).toBeNull();
  });
  it('un control crítico no altera el puntaje (la alerta es independiente)', () => {
    const a = allAnswers(cats, 5);
    const q = cats[3].questions[24];
    a[q.id] = answer(q.id, { score: 5, is_critical: true });
    const r = computeScore(cats, a, {});
    expect(r.final_score).toBe(100);
    expect(r.categories[3].criticals).toBe(1);
  });
});
