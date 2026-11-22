import { MODULES } from '../content/modules';
import { QUESTIONS, QUESTION_BY_ID, questionsForModule } from '../content/questions';
import type { Module } from '../content/types';
import type { Attempt, Progress } from '../storage/schema';
import { uid } from './text';

export type ModuleStatus = 'sin-empezar' | 'en-curso' | 'practica-pendiente' | 'leido' | 'completado';

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  'sin-empezar': 'Sin empezar',
  'en-curso': 'En curso',
  'practica-pendiente': 'Práctica pendiente',
  leido: 'Leído · evaluación pendiente',
  completado: 'Completado',
};

export function lastModuleAttempt(p: Progress, moduleId: string): Attempt | undefined {
  return [...p.attempts].reverse().find((a) => a.kind === 'module' && a.moduleId === moduleId);
}

export function bestModuleAttempt(p: Progress, moduleId: string): Attempt | undefined {
  return p.attempts.filter((a) => a.kind === 'module' && a.moduleId === moduleId).sort((a, b) => pct(b) - pct(a))[0];
}

export function pct(a: Attempt): number {
  return a.total ? Math.round(((a.score ?? 0) / a.total) * 100) : 0;
}

export function passed(a: Attempt | undefined): boolean {
  return !!a && a.finishedAt !== null && pct(a) >= a.threshold;
}

export function moduleStats(p: Progress, m: Module) {
  const lessonsRead = m.lessons.filter((l) => p.lessonsRead[l.id]).length;
  const practicesDone = m.exercises.filter((x) => p.practices[x.id]?.completedAt).length;
  const best = bestModuleAttempt(p, m.id);
  const quizPassed = passed(best);
  const attempts = p.attempts.filter((a) => a.kind === 'module' && a.moduleId === m.id).length;
  const touched = lessonsRead > 0 || practicesDone > 0 || attempts > 0 || !!p.active[m.id];
  let status: ModuleStatus;
  if (!touched) status = 'sin-empezar';
  else if (lessonsRead < m.lessons.length) status = 'en-curso';
  else if (practicesDone < m.exercises.length) status = 'practica-pendiente';
  else if (!quizPassed) status = 'leido';
  else status = 'completado';
  // Avance ponderado: lecturas, prácticas y evaluación cuentan por separado.
  const units = m.lessons.length + m.exercises.length + 1;
  const done = lessonsRead + practicesDone + (quizPassed ? 1 : 0);
  return { lessonsRead, practicesDone, best, quizPassed, attempts, status, percent: Math.round((done / units) * 100) };
}

export function overallStats(p: Progress) {
  const per = MODULES.map((m) => ({ m, s: moduleStats(p, m) }));
  const lessonsTotal = MODULES.reduce((n, m) => n + m.lessons.length, 0);
  const practicesTotal = MODULES.reduce((n, m) => n + m.exercises.length, 0);
  return {
    per,
    lessonsRead: per.reduce((n, x) => n + x.s.lessonsRead, 0),
    lessonsTotal,
    practicesDone: per.reduce((n, x) => n + x.s.practicesDone, 0),
    practicesTotal,
    completed: per.filter((x) => x.s.status === 'completado').length,
    started: per.some((x) => x.s.status !== 'sin-empezar') || p.attempts.length > 0,
  };
}

/** Próximo paso sugerido según el progreso real. */
export function nextStep(p: Progress): { module: Module; href: string; label: string } | null {
  for (const m of MODULES) {
    const s = moduleStats(p, m);
    if (s.status === 'completado') continue;
    const lesson = m.lessons.find((l) => !p.lessonsRead[l.id]);
    if (lesson) return { module: m, href: `#/aprender/${m.id}?l=${lesson.id}`, label: `${m.title} · ${lesson.title}` };
    const ex = m.exercises.find((x) => !p.practices[x.id]?.completedAt);
    if (ex) return { module: m, href: `#/aprender/${m.id}?l=${ex.id}`, label: `${m.title} · ${ex.title}` };
    return { module: m, href: `#/evaluacion/${m.id}`, label: `${m.title} · Evaluación` };
  }
  return null;
}

/** Módulos con más errores pendientes de repaso. */
export function reviewRecommendations(p: Progress) {
  const byModule = new Map<string, string[]>();
  for (const qid of Object.keys(p.wrong)) {
    const q = QUESTION_BY_ID[qid];
    if (!q) continue;
    byModule.set(q.moduleId, [...(byModule.get(q.moduleId) ?? []), qid]);
  }
  return [...byModule.entries()]
    .map(([moduleId, qids]) => ({ module: MODULES.find((m) => m.id === moduleId)!, qids }))
    .sort((a, b) => b.qids.length - a.qids.length);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function optionOrderFor(qids: string[]) {
  return Object.fromEntries(qids.map((id) => [id, shuffle(QUESTION_BY_ID[id].options.map((o) => o.id))]));
}

export function createModuleAttempt(moduleId: string, threshold: number): Attempt {
  const qids = questionsForModule(moduleId).map((q) => q.id);
  return { id: uid('intento'), kind: 'module', moduleId, questionIds: qids, optionOrder: optionOrderFor(qids), answers: {}, startedAt: new Date().toISOString(), finishedAt: null, score: null, total: qids.length, threshold };
}

/** Integrador: una pregunta por módulo y cinco adicionales sin repetir (15 en total). */
export function createFinalAttempt(threshold: number): Attempt {
  const perModule = MODULES.map((m) => shuffle(questionsForModule(m.id))[0].id);
  const rest = shuffle(QUESTIONS.map((q) => q.id).filter((id) => !perModule.includes(id))).slice(0, 5);
  const qids = shuffle([...perModule, ...rest]);
  return { id: uid('intento'), kind: 'final', moduleId: null, questionIds: qids, optionOrder: optionOrderFor(qids), answers: {}, startedAt: new Date().toISOString(), finishedAt: null, score: null, total: qids.length, threshold };
}

export function scoreAttempt(a: Attempt): number {
  return a.questionIds.filter((id) => a.answers[id] === QUESTION_BY_ID[id].correct).length;
}

/** Registra una respuesta en el intento activo y actualiza la lista de errores para repasar. */
export function answerInProgress(p: Progress, key: string, qid: string, optionId: string): Progress {
  const a = p.active[key];
  if (!a || a.answers[qid]) return p; // una respuesta por pregunta y por intento
  const correct = QUESTION_BY_ID[qid].correct === optionId;
  const wrong = { ...p.wrong };
  if (correct) delete wrong[qid];
  else wrong[qid] = { at: new Date().toISOString(), count: (wrong[qid]?.count ?? 0) + 1 };
  return { ...p, wrong, active: { ...p.active, [key]: { ...a, answers: { ...a.answers, [qid]: optionId } } } };
}

export function finishAttempt(p: Progress, key: string): Progress {
  const a = p.active[key];
  if (!a) return p;
  const done: Attempt = { ...a, finishedAt: new Date().toISOString(), score: scoreAttempt(a) };
  const active = { ...p.active };
  delete active[key];
  return { ...p, active, attempts: [...p.attempts, done] };
}
