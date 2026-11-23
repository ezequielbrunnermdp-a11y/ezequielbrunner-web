import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

/** URL firmada de corta duración para archivos privados (nunca públicos). */
export function useSignedUrl(bucket: string, path?: string | null, expiresIn = 3600) {
  return useQuery({
    queryKey: ['signed', bucket, path],
    enabled: Boolean(path),
    staleTime: (expiresIn - 120) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

const MAX_IMAGE = 8 * 1024 * 1024;
export const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ALLOWED_DOCS = ['application/pdf', 'image/jpeg', 'image/png'];

/** Reduce y recodifica imágenes en el dispositivo (también elimina metadatos EXIF/GPS). */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!ALLOWED_IMAGES.includes(file.type)) throw new Error('Formato de imagen no admitido');
  if (file.size > MAX_IMAGE * 3) throw new Error('La imagen es demasiado grande');
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality));
}

export async function uploadPrivate(bucket: string, path: string, body: Blob, contentType: string) {
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return path;
}

export const uid = () => crypto.randomUUID();
