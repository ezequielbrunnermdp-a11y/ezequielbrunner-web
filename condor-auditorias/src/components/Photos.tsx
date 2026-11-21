import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, CloudOff, FileText } from 'lucide-react';
import { signedUrls } from '../lib/files';
import type { Attachment } from '../lib/types';
import { cx, Modal } from './ui';

export interface LocalPhoto { id: string; blob: Blob }
const NO_LOCAL: LocalPhoto[] = [];

export function useObjectUrls(items: LocalPhoto[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const m: Record<string, string> = {};
    items.forEach((i) => { m[i.id] = URL.createObjectURL(i.blob); });
    setUrls(m);
    return () => Object.values(m).forEach((u) => URL.revokeObjectURL(u));
  }, [items]);
  return urls;
}

export function PhotoPickerButtons({ onFiles, disabled, accept = 'image/*', compact }: { onFiles: (f: File[]) => void; disabled?: boolean; accept?: string; compact?: boolean }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) onFiles(files);
  };
  return (
    <div className="flex gap-2">
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={gal} type="file" accept={accept} multiple className="hidden" onChange={handle} />
      <button type="button" disabled={disabled} className={cx('btn-outline', compact ? 'px-3 py-2 text-xs' : '')} onClick={() => cam.current?.click()}>
        <Camera className="h-4 w-4" /> Cámara
      </button>
      <button type="button" disabled={disabled} className={cx('btn-outline', compact ? 'px-3 py-2 text-xs' : '')} onClick={() => gal.current?.click()}>
        <ImagePlus className="h-4 w-4" /> {accept.includes('pdf') ? 'Archivo' : 'Galería'}
      </button>
    </div>
  );
}

export function PhotoGrid({ attachments, local = NO_LOCAL, onDelete, size = 'md' }: {
  attachments: Attachment[]; local?: LocalPhoto[]; onDelete?: (a: Attachment) => void; size?: 'sm' | 'md';
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; caption?: string | null; pdf?: boolean } | null>(null);
  const localUrls = useObjectUrls(local);
  useEffect(() => {
    const paths = attachments.map((a) => a.storage_path);
    if (paths.length) signedUrls(paths).then(setUrls);
  }, [attachments]);
  if (!attachments.length && !local.length) return null;
  const dim = size === 'sm' ? 'h-16 w-16' : 'h-24 w-24';
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => {
          const isPdf = a.mime_type === 'application/pdf';
          const url = urls[a.storage_path];
          return (
            <div key={a.id} className={cx('group relative overflow-hidden rounded-xl bg-crema-200 ring-1 ring-cafe-800/10', dim)}>
              <button type="button" className="h-full w-full" onClick={() => url && (isPdf ? window.open(url, '_blank', 'noopener') : setPreview({ url, caption: a.caption }))}>
                {isPdf ? <div className="flex h-full flex-col items-center justify-center p-1 text-[10px] text-cafe-600"><FileText className="h-6 w-6" /><span className="line-clamp-2 text-center">{a.file_name ?? 'PDF'}</span></div>
                  : url ? <img src={url} alt={a.caption ?? 'Fotografía'} className="h-full w-full object-cover" loading="lazy" /> : null}
              </button>
              {onDelete && (
                <button type="button" onClick={() => onDelete(a)} className="absolute right-1 top-1 rounded-full bg-cafe-900/70 p-1 text-white opacity-90" aria-label="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {local.map((l) => (
          <div key={l.id} className={cx('relative overflow-hidden rounded-xl ring-1 ring-[#b07a1e]/40', dim)}>
            {localUrls[l.id] && <img src={localUrls[l.id]} alt="Foto pendiente de sincronizar" className="h-full w-full object-cover opacity-80" />}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-[#b07a1e]/90 py-0.5 text-[9px] font-semibold text-white"><CloudOff className="h-3 w-3" /> Pendiente</span>
          </div>
        ))}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.caption || 'Fotografía'} wide>
        {preview && <img src={preview.url} alt={preview.caption ?? ''} className="mx-auto max-h-[70vh] rounded-xl" />}
      </Modal>
    </>
  );
}
