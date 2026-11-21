import { supabase, friendlyError } from './supabase';
import type { Attachment } from './types';

/** Reduce fotos de cámara a un tamaño razonable (máx. 1600 px, JPEG 0,82) antes de subirlas. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return out && out.size < file.size ? out : file;
  } catch {
    return file; // HEIC u otros formatos que el navegador no decodifica: se sube el original
  }
}

export interface UploadParams {
  branchId: string;
  auditId?: string | null;
  questionId?: string | null;
  nonconformityId?: string | null;
  kind?: Attachment['kind'];
  caption?: string | null;
  fileName?: string;
}

function extFor(type: string, name?: string) {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'application/pdf') return 'pdf';
  return name?.split('.').pop()?.toLowerCase() || 'bin';
}

/** Sube un archivo al bucket privado "evidencias" y lo registra en la tabla attachments. */
export async function uploadEvidence(blob: Blob, p: UploadParams): Promise<Attachment> {
  const data = blob.type.startsWith('image/') ? await compressImage(blob) : blob;
  const scope = p.nonconformityId ? `nc/${p.nonconformityId}` : p.auditId ? `auditoria/${p.auditId}` : 'general';
  const path = `${p.branchId}/${scope}/${crypto.randomUUID()}.${extFor(data.type, p.fileName)}`;
  const up = await supabase.storage.from('evidencias').upload(path, data, { contentType: data.type || 'application/octet-stream', upsert: false });
  if (up.error) throw new Error(friendlyError(up.error));
  const { data: row, error } = await supabase.from('attachments').insert({
    branch_id: p.branchId,
    audit_id: p.auditId ?? null,
    question_id: p.questionId ?? null,
    nonconformity_id: p.nonconformityId ?? null,
    kind: p.kind ?? 'foto',
    storage_path: path,
    file_name: p.fileName ?? null,
    mime_type: data.type,
    caption: p.caption ?? null,
  }).select().single();
  if (error) {
    await supabase.storage.from('evidencias').remove([path]);
    throw new Error(friendlyError(error));
  }
  return row as Attachment;
}

const urlCache = new Map<string, { url: string; exp: number }>();

/** URL firmada temporal (1 h) para ver un archivo privado. */
export async function signedUrl(path: string, bucket = 'evidencias'): Promise<string | null> {
  const key = bucket + ':' + path;
  const hit = urlCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  urlCache.set(key, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function signedUrls(paths: string[], bucket = 'evidencias'): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing = paths.filter((p) => {
    const hit = urlCache.get(bucket + ':' + p);
    if (hit && hit.exp > Date.now()) { out[p] = hit.url; return false; }
    return true;
  });
  if (missing.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, 3600);
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) {
        out[d.path] = d.signedUrl;
        urlCache.set(bucket + ':' + d.path, { url: d.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
      }
    }
  }
  return out;
}

export async function deleteAttachment(a: Attachment) {
  const { error } = await supabase.from('attachments').delete().eq('id', a.id);
  if (error) throw new Error(friendlyError(error));
  await supabase.storage.from('evidencias').remove([a.storage_path]);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
