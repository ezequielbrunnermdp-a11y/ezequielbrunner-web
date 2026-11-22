import { useSyncExternalStore } from 'react';
import { emptyContent, emptyProgress, SCHEMA_VERSION, type LocalContent, type Profile, type Progress } from './schema';
import { uid } from '../lib/text';

/* Persistencia versionada en localStorage. Cada perfil local guarda su progreso en una clave
   propia; el contenido gestionado en este dispositivo vive aparte y no pertenece a ningún perfil. */

const PREFIX = `condor.v${SCHEMA_VERSION}`;
const K_PROFILES = `${PREFIX}.profiles`;
const K_CONTENT = `${PREFIX}.content`;
const kProgress = (id: string) => `${PREFIX}.progress.${id}`;

let storageOk = true;
let lastError: string | null = null;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    storageOk = false;
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    lastError = null;
    return true;
  } catch (e) {
    storageOk = false;
    lastError = e instanceof DOMException && e.name === 'QuotaExceededError'
      ? 'El almacenamiento del navegador está lleno. Exportá un respaldo y liberá espacio.'
      : 'No se pudo guardar en este navegador (puede estar en modo privado o con el almacenamiento bloqueado).';
    return false;
  }
}

/** El listado oficial viaja con la aplicación: no hace falta copiarlo en cada navegador. */
function persistable(c: LocalContent): LocalContent {
  return c.codesInfo.importedAt ? c : { ...c, codes: [] };
}

interface ProfilesState { profiles: Profile[]; activeId: string | null }

interface State {
  profiles: Profile[];
  activeId: string | null;
  progress: Progress;
  content: LocalContent;
}

function mergeProgress(p: Partial<Progress> | null): Progress {
  const base = emptyProgress();
  if (!p) return base;
  return {
    ...base,
    ...p,
    checklist: { ...base.checklist, ...(p.checklist ?? {}) },
    reviewPlan: { ...base.reviewPlan, ...(p.reviewPlan ?? {}) },
    schemaVersion: SCHEMA_VERSION,
  };
}

export function mergeContent(c: Partial<LocalContent> | null): LocalContent {
  const base = emptyContent();
  if (!c) return base;
  return {
    ...base,
    ...c,
    texts: { ...base.texts, ...(c.texts ?? {}), modules: { ...(c.texts?.modules ?? {}) } },
    // Sin una importación local propia, se usa el listado oficial incluido en el campus.
    ...(!c.codes?.length && !c.codesInfo?.importedAt
      ? { codes: base.codes, codesInfo: base.codesInfo }
      : { codesInfo: { ...base.codesInfo, ...(c.codesInfo ?? {}) } }),
    settings: { ...base.settings, ...(c.settings ?? {}) },
    timeGoals: c.timeGoals?.length ? c.timeGoals : base.timeGoals,
    schemaVersion: SCHEMA_VERSION,
  };
}

function load(): State {
  const ps = read<ProfilesState>(K_PROFILES) ?? { profiles: [], activeId: null };
  let { profiles, activeId } = ps;
  if (!profiles.length) {
    const p: Profile = { id: uid('perfil'), alias: '', sector: '', createdAt: new Date().toISOString() };
    profiles = [p];
    activeId = p.id;
    write(K_PROFILES, { profiles, activeId });
  }
  if (!activeId || !profiles.some((p) => p.id === activeId)) activeId = profiles[0].id;
  return {
    profiles,
    activeId,
    progress: mergeProgress(read<Progress>(kProgress(activeId))),
    content: mergeContent(read<LocalContent>(K_CONTENT)),
  };
}

let state: State = load();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const store = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  storageOk: () => storageOk,
  lastError: () => lastError,

  updateProgress(fn: (p: Progress) => Progress) {
    const next = fn(state.progress);
    state = { ...state, progress: next };
    if (state.activeId) write(kProgress(state.activeId), next);
    emit();
  },

  touch(label: string, href: string) {
    store.updateProgress((p) => ({ ...p, lastActivity: { at: new Date().toISOString(), label, href } }));
  },

  updateContent(fn: (c: LocalContent) => LocalContent) {
    const next = mergeContent({ ...fn(state.content), updatedAt: new Date().toISOString() });
    state = { ...state, content: next };
    write(K_CONTENT, persistable(next));
    emit();
  },

  replaceContent(raw: LocalContent) {
    const c = mergeContent(raw);
    state = { ...state, content: c };
    write(K_CONTENT, persistable(c));
    emit();
  },

  // ---- perfiles locales ----
  createProfile(alias: string, sector: string): Profile {
    const p: Profile = { id: uid('perfil'), alias: alias.trim(), sector: sector.trim(), createdAt: new Date().toISOString() };
    const profiles = [...state.profiles, p];
    write(K_PROFILES, { profiles, activeId: p.id });
    write(kProgress(p.id), emptyProgress());
    state = { ...state, profiles, activeId: p.id, progress: emptyProgress() };
    emit();
    return p;
  },

  updateProfile(id: string, patch: Partial<Pick<Profile, 'alias' | 'sector'>>) {
    const profiles = state.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
    write(K_PROFILES, { profiles, activeId: state.activeId });
    state = { ...state, profiles };
    emit();
  },

  switchProfile(id: string) {
    if (!state.profiles.some((p) => p.id === id)) return;
    write(K_PROFILES, { profiles: state.profiles, activeId: id });
    state = { ...state, activeId: id, progress: mergeProgress(read<Progress>(kProgress(id))) };
    emit();
  },

  deleteProfile(id: string) {
    try { localStorage.removeItem(kProgress(id)); } catch { /* sin acceso */ }
    let profiles = state.profiles.filter((p) => p.id !== id);
    if (!profiles.length) profiles = [{ id: uid('perfil'), alias: '', sector: '', createdAt: new Date().toISOString() }];
    const activeId = state.activeId === id ? profiles[0].id : state.activeId!;
    write(K_PROFILES, { profiles, activeId });
    state = { ...state, profiles, activeId, progress: mergeProgress(read<Progress>(kProgress(activeId))) };
    emit();
  },

  /** Reemplaza el progreso de un perfil existente o crea uno nuevo con el progreso importado. */
  importProgress(profile: Profile, progress: Progress, mode: 'replace' | 'new') {
    let target = profile;
    let profiles = state.profiles;
    if (mode === 'new' || !profiles.some((p) => p.id === profile.id)) {
      target = { ...profile, id: mode === 'new' ? uid('perfil') : profile.id };
      profiles = [...profiles, target];
    } else {
      profiles = profiles.map((p) => (p.id === profile.id ? { ...p, alias: profile.alias, sector: profile.sector } : p));
    }
    const merged = mergeProgress(progress);
    write(kProgress(target.id), merged);
    write(K_PROFILES, { profiles, activeId: target.id });
    state = { ...state, profiles, activeId: target.id, progress: merged };
    emit();
    return target;
  },

  resetProgress() {
    const fresh = emptyProgress();
    state = { ...state, progress: fresh };
    if (state.activeId) write(kProgress(state.activeId), fresh);
    emit();
  },

  readProgressOf(id: string): Progress {
    return mergeProgress(read<Progress>(kProgress(id)));
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}

export const useProgress = () => useStore((s) => s.progress);
export const useContent = () => useStore((s) => s.content);
export function useActiveProfile() {
  const profiles = useStore((s) => s.profiles);
  const activeId = useStore((s) => s.activeId);
  return profiles.find((p) => p.id === activeId) ?? profiles[0];
}

export function profileName(p: Profile | undefined, index?: number) {
  if (!p) return 'Perfil local';
  return p.alias || (index !== undefined ? `Perfil local ${index + 1}` : 'Perfil sin nombre');
}
