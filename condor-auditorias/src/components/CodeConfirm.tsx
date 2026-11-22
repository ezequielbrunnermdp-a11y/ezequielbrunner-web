import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { friendlyError } from '../lib/supabase';
import { ErrorBox, Field, Input, Modal } from './ui';

/** Confirmación de una acción destructiva con la clave de administración (validada en el servidor). */
export function CodeConfirm({ open, onClose, title, children, confirmLabel, onConfirm }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setCode(''); setErr(null); } }, [open]);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(code);
    } catch (e) {
      setErr(friendlyError(e));
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title}
      footer={<>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn-danger" onClick={run} disabled={busy || code.length < 4}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {confirmLabel}
        </button>
      </>}>
      <div className="space-y-4 text-sm text-cafe-700">
        {children}
        <p className="font-semibold text-[#a33b2b]">Esta acción no se puede deshacer.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (code.length >= 4) run(); }}>
          <Field label="Clave de administración">
            <Input id="clave-borrado" type="password" inputMode="numeric" autoComplete="off" autoFocus value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="••••" />
          </Field>
        </form>
        <ErrorBox>{err}</ErrorBox>
      </div>
    </Modal>
  );
}
