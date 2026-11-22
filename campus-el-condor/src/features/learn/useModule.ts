import { MODULES, MODULE_BY_ID } from '../../content/modules';
import type { Module } from '../../content/types';
import type { LocalContent } from '../../storage/schema';
import { useContent } from '../../storage/store';

/** Aplica al módulo los textos y metadatos ajustados en este dispositivo. */
export function applyOverrides(m: Module, c: LocalContent): Module {
  const t = c.texts.modules[m.id] ?? {};
  return {
    ...m,
    objective: t.objective?.trim() || m.objective,
    intro: t.intro?.trim() || m.intro,
    closing: t.closing?.trim() || m.closing,
    meta: { ...m.meta, ...(c.meta[m.id] ?? {}) },
  };
}

export function useModules(): Module[] {
  const c = useContent();
  return MODULES.map((m) => applyOverrides(m, c));
}

export function useModule(id: string): Module | undefined {
  const c = useContent();
  const m = MODULE_BY_ID[id];
  return m ? applyOverrides(m, c) : undefined;
}
