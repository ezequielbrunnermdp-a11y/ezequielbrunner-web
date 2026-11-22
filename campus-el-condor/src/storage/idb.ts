/* Archivos propios (PDF, imágenes, videos, subtítulos) guardados como binarios en IndexedDB.
   Las URL blob se regeneran en cada sesión: guardar la URL no guarda el archivo. */

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: string;
  blob: Blob;
}

export type FileInfo = Omit<StoredFile, 'blob'>;

const DB_NAME = 'condor-campus-files';
const STORE = 'files';
let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!idbAvailable()) return reject(new Error('IndexedDB no está disponible en este navegador.'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el almacenamiento de archivos.'));
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.onerror = () => reject(t.error);
  }));
}

export async function putFile(file: File, id?: string): Promise<FileInfo> {
  const rec: StoredFile = {
    id: id ?? `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    addedAt: new Date().toISOString(),
    blob: file,
  };
  await tx('readwrite', (s) => s.put(rec));
  urlCache.delete(rec.id);
  const { blob: _b, ...info } = rec;
  void _b;
  return info;
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<StoredFile | undefined>);
}

export async function deleteFile(id: string): Promise<void> {
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}

export async function listFiles(): Promise<FileInfo[]> {
  const all = await tx('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>);
  return all.map(({ blob: _b, ...info }) => { void _b; return info; });
}

const urlCache = new Map<string, string>();

/** Devuelve una URL blob válida para esta sesión, o null si el archivo no existe. */
export async function fileURL(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const f = await getFile(id);
  if (!f) return null;
  const u = URL.createObjectURL(f.blob);
  urlCache.set(id, u);
  return u;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch { /* sin estimación */ }
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} KB`;
  return `${(n / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}
