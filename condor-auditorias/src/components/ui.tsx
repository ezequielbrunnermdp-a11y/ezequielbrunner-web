import { useEffect, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { classificationTone, TONE_HEX, fmtScore, SEVERITY_HEX, SEVERITY_LABEL, NC_STATUS_LABEL } from '../lib/format';
import type { NcStatus, Severity } from '../lib/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="section-title">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-cafe-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('card p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-serif text-lg font-semibold text-cafe-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-cafe-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-[#a33b2b]">{error}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx('input resize-y', p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx('input appearance-none bg-[length:16px] bg-[right_.75rem_center] bg-no-repeat pr-9', p.className)}
  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a5c42' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", ...p.style }} />;

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-brand-accent', className)} aria-label="Cargando" />;
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-cafe-500">
      <Spinner /> {label}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cafe-800/15 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-cafe-400">{icon}</div>}
      <div className="font-serif text-lg font-semibold text-cafe-800">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-cafe-500">{children}</div>}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div role="alert" className="rounded-xl border border-[#a33b2b]/20 bg-[#a33b2b]/5 px-4 py-3 text-sm text-[#8e3224]">{children}</div>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const cls = tone === 'warn' ? 'border-[#b07a1e]/25 bg-[#b07a1e]/5 text-[#7a5410]' : tone === 'ok' ? 'border-[#2f6b4f]/25 bg-[#2f6b4f]/5 text-[#24533d]' : 'border-brand-accent/25 bg-brand-accent/5 text-cafe-700';
  return <div className={cx('rounded-xl border px-4 py-3 text-sm', cls)}>{children}</div>;
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  // Portal al <body>: evita que un ancestro animado/transformado desplace la ventana.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cafe-900/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('fade-in flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-crema-50 shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-cafe-800/10 px-5 py-4">
          <h2 className="font-serif text-xl font-semibold text-cafe-900">{title}</h2>
          <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-cafe-800/10 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ScorePill({ score, classification, size = 'md' }: { score: number | null | undefined; classification?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const tone = classificationTone(classification ?? null);
  const color = TONE_HEX[tone];
  if (score == null) return <span className="text-cafe-400">—</span>;
  return (
    <span className={cx('inline-flex items-baseline gap-1 font-semibold tabular-nums', size === 'lg' ? 'text-4xl font-serif' : size === 'sm' ? 'text-sm' : 'text-base')} style={{ color }}>
      {fmtScore(score)}
      {size === 'lg' && <span className="text-base font-sans font-medium text-cafe-400">/100</span>}
    </span>
  );
}

export function ClassBadge({ classification }: { classification: string | null | undefined }) {
  if (!classification) return <span className="chip bg-cafe-800/5 text-cafe-500">Sin calificar</span>;
  const color = TONE_HEX[classificationTone(classification)];
  return <span className="chip" style={{ background: color + '18', color }}>{classification}</span>;
}

export function SeverityBadge({ s }: { s: Severity }) {
  const c = SEVERITY_HEX[s];
  return <span className="chip" style={{ background: c + '18', color: c }}>{SEVERITY_LABEL[s]}</span>;
}

export function NcStatusBadge({ s, overdue }: { s: NcStatus; overdue?: boolean }) {
  const map: Record<NcStatus, string> = { pendiente: '#a33b2b', en_proceso: '#b07a1e', corregido: '#3d6a8a', cerrado: '#2f6b4f' };
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className="chip" style={{ background: map[s] + '18', color: map[s] }}>{NC_STATUS_LABEL[s]}</span>
      {overdue && <span className="chip bg-[#a33b2b] text-white">Vencida</span>}
    </span>
  );
}

export function Stat({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-medium uppercase tracking-wide text-cafe-500">{label}</div>
        {icon && <div className="text-brand-accent">{icon}</div>}
      </div>
      <div className="mt-2 font-serif text-3xl font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>{value}</div>
      {hint && <div className="mt-1 text-xs text-cafe-500">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-cafe-800/5 p-1">
      {items.map((i) => (
        <button key={i.value} onClick={() => onChange(i.value)}
          className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition', value === i.value ? 'bg-white text-cafe-900 shadow-sm' : 'text-cafe-500 hover:text-cafe-800')}>
          {i.label}{i.count != null && <span className="ml-1.5 text-xs text-cafe-400">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function isOverdue(due: string | null, status: NcStatus) {
  if (!due || status === 'cerrado' || status === 'corregido') return false;
  const today = new Date();
  const t = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return due < t;
}
