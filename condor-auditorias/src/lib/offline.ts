// Guardado automático con respaldo local (IndexedDB) y sincronización segura.
// Nada se muestra como "guardado en el servidor" hasta que Supabase confirma la escritura.
import { get, set, del, keys } from 'idb-keyval';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, friendlyError } from './supabase';
import { uploadEvidence } from './files';
import type { Answer, CategoryState, Audit, Nonconformity } from './types';

type AuditPatch = Partial<Pick<Audit, 'manager_present' | 'initial_notes' | 'conclusion' | 'recommendations' | 'start_time'>>;

export type NcDraft = Omit<Nonconformity, 'created_at' | 'updated_at' | 'branches' | 'categories' | 'questions' | 'audits' | 'corrected_at' | 'correction_comment' | 'verified_by' | 'closed_at' | 'status'> & { status?: Nonconformity['status'] };

interface PendingBag {
  ncs?: Record<string, NcDraft>;
  answers: Record<string, Answer & { _rev: number }>;
  categories: Record<string, CategoryState & { _rev: number }>;
  audit: (AuditPatch & { _rev: number }) | null;
}

export interface QueuedPhoto {
  id: string;
  auditId: string;
  branchId: string;
  questionId: string | null;
  nonconformityId?: string | null;
  caption: string | null;
  blob: Blob;
  createdAt: number;
}

const pendingKey = (id: string) => `cnd:pending:${id}`;
const photosKey = (id: string) => `cnd:photos:${id}`;
const snapshotKey = (id: string) => `cnd:snapshot:${id}`;

const emptyBag = (): PendingBag => ({ answers: {}, categories: {}, audit: null });

export async function readPending(auditId: string): Promise<PendingBag> {
  try {
    return ((await get(pendingKey(auditId))) as PendingBag) ?? emptyBag();
  } catch {
    return emptyBag();
  }
}
export async function readQueuedPhotos(auditId: string): Promise<QueuedPhoto[]> {
  try {
    return ((await get(photosKey(auditId))) as QueuedPhoto[]) ?? [];
  } catch {
    return [];
  }
}
export async function saveSnapshot(auditId: string, snapshot: unknown) {
  try { await set(snapshotKey(auditId), snapshot); } catch { /* almacenamiento local no disponible */ }
}
export async function readSnapshot<T>(auditId: string): Promise<T | undefined> {
  try { return (await get(snapshotKey(auditId))) as T | undefined; } catch { return undefined; }
}
export async function clearLocal(auditId: string) {
  try {
    await del(pendingKey(auditId));
    await del(photosKey(auditId));
    await del(snapshotKey(auditId));
  } catch { /* noop */ }
}
/** Auditorías con cambios sin sincronizar en este dispositivo. */
export async function auditsWithLocalChanges(): Promise<string[]> {
  try {
    const ks = (await keys()) as string[];
    const ids = new Set<string>();
    for (const k of ks) {
      const m = /^cnd:(pending|photos):(.+)$/.exec(String(k));
      if (!m) continue;
      const v = await get(k);
      const has = m[1] === 'photos' ? (v as unknown[])?.length > 0
        : v && (Object.keys((v as PendingBag).ncs ?? {}).length || Object.keys((v as PendingBag).answers).length || Object.keys((v as PendingBag).categories).length || (v as PendingBag).audit);
      if (has) ids.add(m[2]);
    }
    return [...ids];
  } catch {
    return [];
  }
}

// Serializa las escrituras locales para evitar condiciones de carrera.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.catch(() => undefined);
  return p;
}

let revCounter = Date.now();

export type SyncStatus = 'guardado' | 'guardando' | 'pendiente' | 'sin_conexion' | 'error';

export function useAuditSync(auditId: string | undefined, branchId: string | undefined, enabled: boolean) {
  const [status, setStatus] = useState<SyncStatus>('guardado');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const flushing = useRef(false);
  const again = useRef(false);

  const countPending = useCallback(async () => {
    if (!auditId) return 0;
    const bag = await readPending(auditId);
    const photos = await readQueuedPhotos(auditId);
    const n = Object.keys(bag.ncs ?? {}).length + Object.keys(bag.answers).length + Object.keys(bag.categories).length + (bag.audit ? 1 : 0) + photos.length;
    setPendingCount(n);
    return n;
  }, [auditId]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (!auditId || !branchId || !enabled) return true;
    if (flushing.current) { again.current = true; return false; }
    if (!navigator.onLine) { setStatus('sin_conexion'); await countPending(); return false; }
    flushing.current = true;
    setStatus('guardando');
    try {
      const bag = await readPending(auditId);
      const ncs = Object.values(bag.ncs ?? {});
      for (const nc of ncs) {
        const { error: e } = await supabase.from('nonconformities').upsert(nc, { onConflict: 'id', ignoreDuplicates: true });
        if (e) throw e;
        await serial(async () => {
          const cur = await readPending(auditId);
          if (cur.ncs) delete cur.ncs[nc.id];
          await set(pendingKey(auditId), cur);
        });
        window.dispatchEvent(new CustomEvent('cnd:nc-synced', { detail: { auditId, id: nc.id } }));
      }
      const answers = Object.values(bag.answers);
      const cats = Object.values(bag.categories);
      if (answers.length) {
        const rows = answers.map(({ _rev: _r, updated_at: _u, ...a }) => a);
        const { error: e } = await supabase.from('audit_answers').upsert(rows, { onConflict: 'audit_id,question_id' });
        if (e) throw e;
      }
      if (cats.length) {
        const rows = cats.map(({ _rev: _r, ...c }) => c);
        const { error: e } = await supabase.from('audit_category_states').upsert(rows, { onConflict: 'audit_id,category_id' });
        if (e) throw e;
      }
      if (bag.audit) {
        const { _rev: _r, ...patch } = bag.audit;
        const { error: e } = await supabase.from('audits').update(patch).eq('id', auditId);
        if (e) throw e;
      }
      // Quitar solo lo confirmado que no haya cambiado mientras se enviaba.
      await serial(async () => {
        const cur = await readPending(auditId);
        for (const a of answers) if (cur.answers[a.question_id]?._rev === a._rev) delete cur.answers[a.question_id];
        for (const c of cats) if (cur.categories[c.category_id]?._rev === c._rev) delete cur.categories[c.category_id];
        if (bag.audit && cur.audit?._rev === bag.audit._rev) cur.audit = null;
        await set(pendingKey(auditId), cur);
      });

      // Fotografías en cola
      const photos = await readQueuedPhotos(auditId);
      for (const ph of photos) {
        await uploadEvidence(ph.blob, {
          branchId: ph.branchId, auditId: ph.nonconformityId ? null : ph.auditId, questionId: ph.questionId,
          nonconformityId: ph.nonconformityId ?? null, caption: ph.caption, kind: 'foto',
        });
        await serial(async () => {
          const cur = await readQueuedPhotos(auditId);
          await set(photosKey(auditId), cur.filter((x) => x.id !== ph.id));
        });
        window.dispatchEvent(new CustomEvent('cnd:photo-synced', { detail: { auditId, id: ph.id } }));
      }

      const left = await countPending();
      setError(null);
      if (left === 0) {
        setStatus('guardado');
        setLastSaved(new Date());
      } else {
        setStatus('pendiente');
      }
      return left === 0;
    } catch (e) {
      const msg = friendlyError(e);
      setError(msg);
      setStatus(navigator.onLine ? 'error' : 'sin_conexion');
      await countPending();
      return false;
    } finally {
      flushing.current = false;
      if (again.current) {
        again.current = false;
        schedule(300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, branchId, enabled, countPending]);

  const schedule = useCallback((ms = 900) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { flush(); }, ms);
  }, [flush]);

  const queueAnswer = useCallback(async (a: Answer) => {
    if (!auditId) return;
    setStatus('pendiente');
    await serial(async () => {
      const bag = await readPending(auditId);
      bag.answers[a.question_id] = { ...a, _rev: ++revCounter };
      await set(pendingKey(auditId), bag);
    });
    await countPending();
    schedule();
  }, [auditId, countPending, schedule]);

  const queueCategory = useCallback(async (c: CategoryState) => {
    if (!auditId) return;
    setStatus('pendiente');
    await serial(async () => {
      const bag = await readPending(auditId);
      bag.categories[c.category_id] = { ...c, _rev: ++revCounter };
      await set(pendingKey(auditId), bag);
    });
    await countPending();
    schedule();
  }, [auditId, countPending, schedule]);

  const queueAudit = useCallback(async (patch: AuditPatch) => {
    if (!auditId) return;
    setStatus('pendiente');
    await serial(async () => {
      const bag = await readPending(auditId);
      bag.audit = { ...(bag.audit ?? {}), ...patch, _rev: ++revCounter };
      await set(pendingKey(auditId), bag);
    });
    await countPending();
    schedule(1500);
  }, [auditId, countPending, schedule]);

  const queueNc = useCallback(async (nc: NcDraft) => {
    if (!auditId) return;
    await serial(async () => {
      const bag = await readPending(auditId);
      bag.ncs = { ...(bag.ncs ?? {}), [nc.id]: nc };
      await set(pendingKey(auditId), bag);
    });
    setStatus('pendiente');
    await countPending();
    schedule(200);
  }, [auditId, countPending, schedule]);

  const queuePhoto = useCallback(async (blob: Blob, questionId: string | null, caption: string | null, nonconformityId: string | null = null) => {
    if (!auditId || !branchId) return null;
    const item: QueuedPhoto = { id: crypto.randomUUID(), auditId, branchId, questionId, nonconformityId, caption, blob, createdAt: Date.now() };
    await serial(async () => {
      const cur = await readQueuedPhotos(auditId);
      await set(photosKey(auditId), [...cur, item]);
    });
    setStatus('pendiente');
    await countPending();
    schedule(200);
    return item;
  }, [auditId, branchId, countPending, schedule]);

  useEffect(() => {
    if (!enabled) return;
    countPending().then((n) => { if (n > 0) schedule(500); });
    const online = () => schedule(300);
    const offline = () => setStatus('sin_conexion');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const iv = window.setInterval(() => { countPending().then((n) => { if (n > 0) flush(); }); }, 20000);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.clearInterval(iv);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled, countPending, schedule, flush]);

  return { status, pendingCount, lastSaved, error, flush, queueAnswer, queueCategory, queueAudit, queuePhoto, queueNc };
}
