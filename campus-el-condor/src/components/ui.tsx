import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, AlertTriangle, Check, CheckCircle2, ChevronDown, Clock, FileClock, Info, Star, X, XCircle } from 'lucide-react';
import type { ContentMeta } from '../content/types';
import { APPROVAL_LABEL, PUBLICATION_LABEL } from '../content/meta';
import { formatCivil } from '../lib/format';
import { store, useProgress } from '../storage/store';

export function PageHeader({ eyebrow, title, lead, children, crumbs }: { eyebrow?: string; title: string; lead?: ReactNode; children?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="page-head fade-in">
      {crumbs && (
        <nav className="breadcrumb" aria-label="Ruta de navegación">
          {crumbs.map((c) => (
            <a key={c.href} href={c.href}><ArrowLeft size={15} aria-hidden="true" />{c.label}</a>
          ))}
        </nav>
      )}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children && <div className="actions row">{children}</div>}
    </header>
  );
}

type Tone = 'neutral' | 'proposed' | 'practice' | 'ok' | 'err' | 'warn' | 'dark';
export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{icon}{children}</span>;
}

export function ProposedBadge() {
  return <Badge tone="proposed" icon={<FileClock aria-hidden="true" />}>Contenido propuesto</Badge>;
}
export function PracticeBadge({ label = 'Práctica' }: { label?: string }) {
  return <Badge tone="practice">{label}</Badge>;
}

/** Muestra por separado el estado de publicación y el de aprobación empresarial. */
export function MetaBadges({ meta }: { meta: ContentMeta }) {
  return (
    <div className="badges" aria-label="Estado del contenido">
      <Badge tone="neutral">{PUBLICATION_LABEL[meta.publicationStatus]}</Badge>
      {meta.approvalStatus === 'aprobado' ? (
        <Badge tone="ok" icon={<CheckCircle2 aria-hidden="true" />}>
          Aprobado{meta.approvedBy ? ` por ${meta.approvedBy}` : ''}{meta.approvedAt ? ` · ${formatCivil(meta.approvedAt)}` : ''}
        </Badge>
      ) : meta.approvalStatus === 'en-revision' ? (
        <Badge tone="warn">{APPROVAL_LABEL['en-revision']}</Badge>
      ) : (
        <ProposedBadge />
      )}
    </div>
  );
}

export function Callout({ tone, title, children }: { tone: 'info' | 'warning' | 'pending' | 'ok' | 'err'; title?: string; children: ReactNode }) {
  const Icon = tone === 'warning' || tone === 'err' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : tone === 'pending' ? Clock : Info;
  return (
    <div className={`callout callout-${tone}`} role={tone === 'err' ? 'alert' : undefined}>
      <Icon aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ art, title, children, actions }: { art?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty fade-in">
      {art}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Meter({ value, label, detail, compact }: { value: number; label?: string; detail?: string; compact?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {compact ? (
        <div className="meter-label"><span className="sr-only">{label}</span><span>{v} %</span></div>
      ) : (label || detail) && (
        <div className="meter-label"><span>{label}</span><span>{detail ?? `${v} %`}</span></div>
      )}
      <div className={v === 100 ? 'meter ok' : 'meter'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label ?? 'Avance'}>
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Ring({ value }: { value: number }) {
  return (
    <div className="ring" style={{ ['--p' as string]: value }} role="img" aria-label={`${value} % de avance`}>
      <span>{value}%</span>
    </div>
  );
}

export function Disclosure({ number, title, children, defaultOpen = false }: { number?: number; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="disclosure" data-open={open}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {number !== undefined && <span className="num" aria-hidden="true">{number}</span>}
        <span className="ttl">{title}</span>
        <ChevronDown className="chev" aria-hidden="true" />
      </button>
      <div id={id} className="disclosure-body" hidden={!open}>{children}</div>
    </div>
  );
}

/** Modal accesible sobre <dialog>: atrapa el foco, cierra con Escape y devuelve el foco al disparador. */
export function Modal({ open, onClose, title, children, footer, wide, sheet }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean; sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<Element | null>(null);
  const headingId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement;
      d.showModal();
      const first = d.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button:not(.modal-close)');
      (first ?? d.querySelector<HTMLElement>('.modal-close'))?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => { e.preventDefault(); onClose(); };
    const onCloseEv = () => { (returnTo.current as HTMLElement | null)?.focus?.(); };
    d.addEventListener('cancel', onCancel);
    d.addEventListener('close', onCloseEv);
    return () => { d.removeEventListener('cancel', onCancel); d.removeEventListener('close', onCloseEv); };
  }, [onClose]);
  return (
    <dialog ref={ref} className={`modal${wide ? ' wide' : ''}${sheet ? ' sheet' : ''}`} aria-labelledby={headingId}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <>
          <div className="modal-head">
            <h2 id={headingId}>{title}</h2>
            <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Cerrar"><X aria-hidden="true" /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function ConfirmModal({ open, title, children, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </>
    }>
      {children}
    </Modal>
  );
}

export function FavoriteButton({ id, label }: { id: string; label: string }) {
  const favs = useProgress().favorites;
  const on = favs.includes(id);
  return (
    <button type="button" className="icon-btn" aria-pressed={on} aria-label={on ? `Quitar ${label} de favoritos` : `Agregar ${label} a favoritos`}
      title={on ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      onClick={() => {
        store.updateProgress((p) => ({ ...p, favorites: on ? p.favorites.filter((f) => f !== id) : [...p.favorites, id] }));
        toast(on ? 'Quitado de favoritos' : 'Guardado en favoritos');
      }}>
      <Star aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

export function Feedback({ tone, title, children }: { tone: 'ok' | 'err' | 'partial' | 'neutral'; title: string; children: ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'err' ? XCircle : tone === 'partial' ? AlertTriangle : Info;
  return (
    <div className={`feedback ${tone}`} role="status" aria-live="polite">
      <span className="fb-ico" aria-hidden="true"><Icon /></span>
      <h4>{title}</h4>
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children, full, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; full?: boolean; htmlFor?: string }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="error" role="alert"><AlertTriangle size={15} aria-hidden="true" />{error}</span>}
    </div>
  );
}

// ---- Avisos breves ----
type ToastMsg = { id: number; text: string };
let toasts: ToastMsg[] = [];
const toastSubs = new Set<(t: ToastMsg[]) => void>();
export function toast(text: string) {
  const t = { id: Date.now() + Math.random(), text };
  toasts = [...toasts.filter((x) => x.text !== text), t].slice(-2);
  toastSubs.forEach((s) => s(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); toastSubs.forEach((s) => s(toasts)); }, 3200);
}
export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>(toasts);
  useEffect(() => { toastSubs.add(setList); return () => { toastSubs.delete(setList); }; }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className="toast"><Check aria-hidden="true" />{t.text}</div>)}
    </div>
  );
}
