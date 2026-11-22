import { SCHEMA_VERSION, type LocalContent, type Profile, type Progress } from './schema';
import { mergeContent } from './store';
import type { FileInfo } from './idb';
import { BASE_RESOURCES, VIDEO_SCRIPTS } from '../content/library';

export const PROGRESS_KIND = 'el-condor-campus/progreso';
export const CONTENT_KIND = 'el-condor-campus/contenido';

export interface ProgressBackup {
  kind: typeof PROGRESS_KIND;
  schemaVersion: number;
  exportedAt: string;
  profile: Profile;
  progress: Progress;
}

export interface FileManifestEntry {
  fileId: string;
  name: string | null;
  type: string | null;
  size: number | null;
  usedBy: string;
  includedInThisFile: false;
}

export interface ContentBackup {
  kind: typeof CONTENT_KIND;
  schemaVersion: number;
  exportedAt: string;
  note: string;
  content: LocalContent;
  fileManifest: FileManifestEntry[];
}

export type ValidationResult<T> = { ok: true; value: T; warnings: string[] } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function buildProgressBackup(profile: Profile, progress: Progress): ProgressBackup {
  return { kind: PROGRESS_KIND, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), profile, progress };
}

export function validateProgressBackup(raw: unknown): ValidationResult<ProgressBackup> {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['El archivo no contiene un objeto JSON válido.'] };
  if (raw.kind === CONTENT_KIND) return { ok: false, errors: ['Este archivo es una configuración de contenido. Importalo desde “Gestionar contenido”.'] };
  if (raw.kind !== PROGRESS_KIND) errors.push('No es un respaldo de progreso del campus de El Cóndor.');
  if (typeof raw.schemaVersion !== 'number') errors.push('Falta la versión del respaldo.');
  else if (raw.schemaVersion > SCHEMA_VERSION) errors.push(`El respaldo es de una versión más nueva (${raw.schemaVersion}) que esta aplicación (${SCHEMA_VERSION}).`);
  const profile = raw.profile;
  if (!isObj(profile) || typeof profile.id !== 'string') errors.push('El respaldo no identifica el perfil.');
  const p = raw.progress;
  if (!isObj(p)) errors.push('El respaldo no contiene progreso.');
  else {
    if (!isObj(p.lessonsRead)) errors.push('El registro de lecturas no es válido.');
    if (!isObj(p.practices)) errors.push('El registro de prácticas no es válido.');
    if (!Array.isArray(p.attempts)) errors.push('El registro de intentos no es válido.');
    if (p.favorites !== undefined && !Array.isArray(p.favorites)) errors.push('Los favoritos no son válidos.');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: raw as unknown as ProgressBackup, warnings: [] };
}

function usages(content: LocalContent): Map<string, string> {
  const m = new Map<string, string>();
  for (const [rid, r] of Object.entries(content.resources)) {
    if (r.fileId) m.set(r.fileId, `Biblioteca: ${BASE_RESOURCES.find((b) => b.id === rid)?.title ?? rid}`);
  }
  for (const r of content.customResources) if (r.fileId) m.set(r.fileId, `Biblioteca: ${r.title}`);
  for (const [vid, v] of Object.entries(content.videos)) {
    const t = VIDEO_SCRIPTS.find((s) => s.id === vid)?.title ?? vid;
    if (v.fileId) m.set(v.fileId, `Video: ${t}`);
    if (v.captionsFileId) m.set(v.captionsFileId, `Subtítulos: ${t}`);
  }
  for (const p of content.products) if (p.photoFileId) m.set(p.photoFileId, `Foto de producto: ${p.name}`);
  return m;
}

export function buildContentBackup(content: LocalContent, files: FileInfo[]): ContentBackup {
  const byId = new Map(files.map((f) => [f.id, f]));
  const fileManifest: FileManifestEntry[] = [...usages(content)].map(([fileId, usedBy]) => {
    const f = byId.get(fileId);
    return { fileId, usedBy, name: f?.name ?? null, type: f?.type ?? null, size: f?.size ?? null, includedInThisFile: false };
  });
  return {
    kind: CONTENT_KIND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    note: 'Este JSON contiene textos, metadatos, productos, códigos y promociones. No contiene los archivos (PDF, imágenes, videos): fileManifest lista cuáles hay que volver a asociar en el otro dispositivo.',
    content,
    fileManifest,
  };
}

export function validateContentBackup(raw: unknown): ValidationResult<ContentBackup> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['El archivo no contiene un objeto JSON válido.'] };
  if (raw.kind === PROGRESS_KIND) return { ok: false, errors: ['Este archivo es un respaldo de progreso. Importalo desde “Progreso”.'] };
  if (raw.kind !== CONTENT_KIND) errors.push('No es una configuración de contenido del campus de El Cóndor.');
  if (typeof raw.schemaVersion !== 'number') errors.push('Falta la versión de la configuración.');
  else if (raw.schemaVersion > SCHEMA_VERSION) errors.push(`La configuración es de una versión más nueva (${raw.schemaVersion}).`);
  const c = raw.content;
  if (!isObj(c)) errors.push('No contiene la sección “content”.');
  else {
    for (const key of ['products', 'codes', 'promotions'] as const) {
      if (c[key] !== undefined && !Array.isArray(c[key])) errors.push(`La lista “${key}” no es válida.`);
    }
    if (Array.isArray(c.codes)) {
      const bad = (c.codes as unknown[]).filter((x) => !isObj(x) || typeof x.code !== 'string' || typeof x.name !== 'string').length;
      if (bad) errors.push(`${bad} código(s) no tienen “code” y “name” como texto.`);
    }
    if (Array.isArray(c.products)) {
      const bad = (c.products as unknown[]).filter((x) => !isObj(x) || typeof x.name !== 'string' || typeof x.id !== 'string').length;
      if (bad) errors.push(`${bad} producto(s) no tienen identificador o nombre.`);
    }
  }
  if (Array.isArray(raw.fileManifest) && raw.fileManifest.length) {
    warnings.push(`La configuración menciona ${raw.fileManifest.length} archivo(s) que no viajan dentro del JSON. Si no existen en este dispositivo, vas a verlos como pendientes.`);
  }
  if (errors.length) return { ok: false, errors };
  const value = { ...(raw as unknown as ContentBackup), content: mergeContent(c as Partial<LocalContent>) };
  return { ok: true, value, warnings };
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function readJSONFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
}
