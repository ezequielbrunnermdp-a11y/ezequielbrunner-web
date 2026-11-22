import { store } from '../../storage/store';
import type { PracticeRecord } from '../../storage/schema';

/** Registra un intento de práctica. `completed` marca la práctica como realizada. */
export function recordPractice(id: string, result: string, completed: boolean, label?: string, href?: string) {
  const now = new Date().toISOString();
  store.updateProgress((p) => {
    const prev: PracticeRecord | undefined = p.practices[id];
    const rec: PracticeRecord = {
      completedAt: prev?.completedAt ?? (completed ? now : null),
      attempts: (prev?.attempts ?? 0) + 1,
      lastResult: result,
      lastAt: now,
      state: prev?.state,
    };
    return {
      ...p,
      practices: { ...p.practices, [id]: rec },
      lastActivity: label && href ? { at: now, label, href } : p.lastActivity,
    };
  });
}

export function savePracticeState(id: string, state: unknown) {
  store.updateProgress((p) => {
    const prev = p.practices[id];
    return { ...p, practices: { ...p.practices, [id]: { completedAt: prev?.completedAt ?? null, attempts: prev?.attempts ?? 0, lastResult: prev?.lastResult ?? '', lastAt: prev?.lastAt ?? new Date().toISOString(), state } } };
  });
}
