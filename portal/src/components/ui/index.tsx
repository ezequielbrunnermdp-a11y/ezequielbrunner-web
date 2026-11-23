import { clsx } from 'clsx';
import {
  forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Loader2, X, WifiOff } from 'lucide-react';
import { useSignedUrl } from '@/lib/storage';
import { initials } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

export const cx = clsx;

// ---------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode; block?: boolean;
}
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-[1.06] active:brightness-95 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  subtle: 'bg-surface-2 text-ink hover:bg-line/60',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad text-white hover:brightness-110',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading}
      className={cx('inline-flex select-none items-center justify-center font-medium transition-[filter,background-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cx('inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink', className)} {...rest}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------
export function Field({ label, hint, error, children, htmlFor, optional }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-[13px] font-medium text-ink-2">
        <span>{label}</span>{optional && <span className="text-2xs font-normal text-ink-3">Opcional</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-bad" role="alert">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}
const inputBase = 'w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:opacity-60';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(inputBase, 'h-11', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-[96px] py-3 leading-relaxed', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cx(inputBase, 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238c847c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>;
});

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{description}</span>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink')}>
          {o.label}
          {o.count ? <span className="rounded-full bg-accent px-1.5 text-2xs font-semibold text-accent-ink">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Contenedores
// ---------------------------------------------------------------------
export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' } & Record<string, unknown>) {
  return <As className={cx('rounded-2xl border border-line/70 bg-surface shadow-card', className)} {...rest}>{children}</As>;
}
export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-ink-3">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="truncate text-[13px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info', accent: 'bg-accent-soft text-accent',
  } as const;
  return <span className={cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function Avatar({ path, person, size = 40, className }: { path?: string | null; person?: { first_name?: string | null; last_name?: string | null } | null; size?: number; className?: string }) {
  const { data } = useSignedUrl('media', path);
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent', className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }} aria-hidden>
      {data ? <img src={data} alt="" className="h-full w-full object-cover" loading="lazy" /> : initials(person)}
    </span>
  );
}

export function PrivateImage({ bucket = 'media', path, className, alt = '' }: { bucket?: string; path: string; className?: string; alt?: string }) {
  const { data, isLoading } = useSignedUrl(bucket, path);
  if (isLoading || !data) return <div className={cx('animate-pulse bg-surface-2', className)} />;
  return <img src={data} alt={alt} className={className} loading="lazy" />;
}

// ---------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-ink-3', className)} aria-label="Cargando" />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-2', className)} />;
}
export function LoadingList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
        </div>
      ))}
    </div>
  );
}
export function EmptyState({ icon, title, description, action, compact }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-bad-soft text-bad">
        {offline ? <WifiOff className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      </div>
      <p className="text-[15px] font-semibold">{offline ? 'Sin conexión' : 'No pudimos cargar esta sección'}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{errorMessage(error)}</p>
      {onRetry && <Button variant="secondary" className="mt-5" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}
export function Notice({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; title?: string; children?: ReactNode; icon?: ReactNode }) {
  const t = { info: 'bg-info-soft text-info', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', ok: 'bg-ok-soft text-ok' }[tone];
  return (
    <div className={cx('flex gap-3 rounded-xl px-4 py-3 text-sm', t)} role={tone === 'bad' ? 'alert' : 'status'}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[13px] opacity-90">{children}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Hoja / modal accesible (hoja inferior en móvil, diálogo en escritorio)
// ---------------------------------------------------------------------
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select,button[data-autofocus]')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div ref={ref} className={cx('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop animate-sheet-in sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line/70 px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line/70">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
          <dt className="text-ink-3">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'info'; hint?: string }) {
  const t = tone ? { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-info' }[tone] : 'text-ink';
  return (
    <div className="rounded-2xl border border-line/70 bg-surface px-4 py-3.5 shadow-card">
      <p className="text-[12px] font-medium text-ink-3">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular tracking-tight', t)}>{value}</p>
      {hint && <p className="mt-0.5 text-2xs text-ink-3">{hint}</p>}
    </div>
  );
}
