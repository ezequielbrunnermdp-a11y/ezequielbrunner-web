import clsx from "clsx";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={clsx("surface rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,.04)] animate-in", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      )}
      <div className={clsx(padded && "px-5 pb-5", !title && padded && "pt-5")}>{children}</div>
    </section>
  );
}

const tones = {
  gray: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  red: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  blue: "bg-brand-500/12 text-brand-700 dark:text-blue-300",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "surface hover:bg-[var(--surface-2)]",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "hover:bg-[var(--surface-2)]",
};
export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      {...p}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant], className,
      )}
    />
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx("input", p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx("input", p.className)} />;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="surface rounded-2xl p-4 animate-in">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={clsx("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight",
        tone === "good" && "text-emerald-600 dark:text-emerald-400", tone === "bad" && "text-rose-600 dark:text-rose-400", tone === "warn" && "text-amber-600 dark:text-amber-400")}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-app py-10 text-center text-sm text-muted">{children}</div>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto"><div className="min-w-full px-2">{children}</div></div>;
}
