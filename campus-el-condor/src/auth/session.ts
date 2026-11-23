import { useSyncExternalStore } from 'react';
import { api, ApiError, login as apiLogin, type AccountUser } from './api';
import { AUTH_ENABLED } from './config';
import { store } from '../storage/store';
import type { Progress } from '../storage/schema';

/* Sesión del usuario y sincronización del progreso con el servidor.
   El progreso se guarda primero en el navegador (respuesta inmediata) y se envía al servidor
   con una pequeña demora; si no hay conexión, se reintenta. */

const K_TOKEN = 'condor.session.v1';

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface SessionState {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: AccountUser | null;
  token: string | null;
  sync: SyncState;
  lastSyncedAt: string | null;
  notice: string | null;
}

let state: SessionState = { status: AUTH_ENABLED ? 'loading' : 'anonymous', user: null, token: null, sync: 'idle', lastSyncedAt: null, notice: null };
const subs = new Set<() => void>();
const set = (patch: Partial<SessionState>) => { state = { ...state, ...patch }; subs.forEach((s) => s()); };

export function useSession() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);
}
export const getSession = () => state;

function readToken(): string | null { try { return localStorage.getItem(K_TOKEN); } catch { return null; } }
function writeToken(t: string | null) { try { if (t) localStorage.setItem(K_TOKEN, t); else localStorage.removeItem(K_TOKEN); } catch { /* sin acceso */ } }

function profileOf(u: AccountUser) {
  return { id: u.id, alias: u.displayName || u.username, sector: u.sector, createdAt: u.createdAt };
}

let unsubscribeStore: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = '';

function startSync() {
  stopSync();
  lastSent = JSON.stringify(store.get().progress);
  unsubscribeStore = store.subscribe(() => {
    if (state.status !== 'authenticated') return;
    const snapshot = JSON.stringify(store.get().progress);
    if (snapshot === lastSent) return;
    schedule(1200);
  });
  window.addEventListener('online', onOnline);
  window.addEventListener('beforeunload', flushBeacon);
}

function stopSync() {
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (timer) clearTimeout(timer);
  timer = null;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('beforeunload', flushBeacon);
}

function onOnline() { schedule(200); }
function flushBeacon() { if (timer) { clearTimeout(timer); void pushNow(); } }

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void pushNow(); }, ms);
}

export async function pushNow() {
  if (!state.token) return;
  const data = store.get().progress;
  const snapshot = JSON.stringify(data);
  set({ sync: 'saving' });
  try {
    const at = await api.saveProgress(state.token, data);
    lastSent = snapshot;
    set({ sync: 'saved', lastSyncedAt: at });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'SESION_INVALIDA') { await expire(e.message); return; }
    set({ sync: e instanceof ApiError && e.code === 'RED' ? 'offline' : 'error' });
    schedule(15000);
  }
}

async function enter(token: string, user: AccountUser) {
  let serverProgress: Partial<Progress> | null = null;
  try {
    const r = await api.getProgress(token);
    serverProgress = (r?.data as Partial<Progress>) ?? null;
    if (r) set({ lastSyncedAt: r.updatedAt });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'SESION_INVALIDA') throw e;
    set({ sync: 'offline' });
  }
  // Sin progreso en el servidor (primer ingreso) se usa el que haya en este navegador para ese usuario.
  store.setAccount(profileOf(user), serverProgress);
  set({ status: 'authenticated', user, token, sync: serverProgress ? 'saved' : 'idle', notice: null });
  startSync();
  if (!serverProgress) schedule(500);
}

async function expire(message: string) {
  stopSync();
  writeToken(null);
  store.clearAccount();
  set({ status: 'anonymous', user: null, token: null, sync: 'idle', notice: message });
}

/** Restaura la sesión guardada al abrir la aplicación. */
export async function restoreSession() {
  if (!AUTH_ENABLED) return;
  const token = readToken();
  if (!token) { set({ status: 'anonymous' }); return; }
  try {
    const user = await api.me(token);
    await enter(token, user);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'RED') {
      set({ status: 'anonymous', notice: 'No hay conexión con el servidor. Revisá tu conexión e ingresá de nuevo.' });
    } else {
      await expire('Tu sesión venció. Volvé a ingresar.');
    }
  }
}

export async function signIn(username: string, password: string) {
  const { token, user } = await apiLogin(username, password);
  writeToken(token);
  await enter(token, user);
}

export async function signOut() {
  const t = state.token;
  if (t) { await pushNow().catch(() => undefined); await api.logout(t).catch(() => undefined); }
  await expire('');
  set({ notice: null });
}

export async function changeOwnPassword(current: string, next: string) {
  if (!state.token || !state.user) throw new ApiError('SESION_INVALIDA', 'Tu sesión venció.');
  await api.changePassword(state.token, current, next);
  set({ user: { ...state.user, mustChangePassword: false } });
}

export function refreshUser(u: AccountUser) {
  if (state.user && u.id === state.user.id) set({ user: u });
}
