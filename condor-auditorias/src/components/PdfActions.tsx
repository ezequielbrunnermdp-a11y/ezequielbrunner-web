import { useEffect, useState } from 'react';
import { Download, Eye, ExternalLink, Loader2 } from 'lucide-react';
import { downloadBlob } from '../lib/files';
import { friendlyError } from '../lib/supabase';
import { ErrorBox, Modal, cx } from './ui';

export type PdfJob = () => Promise<{ blob: Blob; fileName: string }>;

/** Genera el PDF bajo demanda; permite previsualizar y descargar. */
export function usePdf() {
  const [busy, setBusy] = useState<'ver' | 'descargar' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; fileName: string } | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const run = async (job: PdfJob, mode: 'ver' | 'descargar') => {
    setErr(null);
    setBusy(mode);
    try {
      const out = await job();
      if (mode === 'descargar') downloadBlob(out.blob, out.fileName);
      else setPreview({ url: URL.createObjectURL(out.blob), ...out });
    } catch (e) {
      console.error(e);
      setErr(`No se pudo generar el PDF: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const modal = (
    <Modal open={!!preview} onClose={() => setPreview(null)} title="Vista previa del informe" wide
      footer={preview && <>
        <a className="btn-outline" href={preview.url} target="_blank" rel="noopener"><ExternalLink className="h-4 w-4" /> Abrir en pestaña</a>
        <button className="btn-primary" onClick={() => downloadBlob(preview.blob, preview.fileName)}><Download className="h-4 w-4" /> Descargar PDF</button>
      </>}>
      {preview && (
        <div>
          <iframe title="Vista previa PDF" src={preview.url} className="h-[70vh] w-full rounded-xl border border-cafe-800/10 bg-white" />
          <p className="mt-2 text-xs text-cafe-500">{preview.fileName}</p>
        </div>
      )}
    </Modal>
  );
  return { busy, err, run, modal };
}

export function PdfButtons({ job, size = 'md', label = 'PDF' }: { job: PdfJob; size?: 'sm' | 'md'; label?: string }) {
  const { busy, err, run, modal } = usePdf();
  const cls = size === 'sm' ? 'px-3 py-1.5 text-xs' : '';
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button className={cx('btn-outline', cls)} onClick={() => run(job, 'ver')} disabled={!!busy}>
          {busy === 'ver' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Ver {label}
        </button>
        <button className={cx('btn-primary', cls)} onClick={() => run(job, 'descargar')} disabled={!!busy}>
          {busy === 'descargar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Descargar {label}
        </button>
      </div>
      {err && <div className="mt-2"><ErrorBox>{err}</ErrorBox></div>}
      {modal}
    </>
  );
}

export const auditPdfJob = (auditId: string): PdfJob => async () => (await import('../pdf/generate')).renderAuditPdf(auditId);
