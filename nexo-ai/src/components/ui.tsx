import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-accent/80">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Omit<ComponentProps<"section">, "className" | "ref">) {
  return (
    <As className={cx("grain rounded-2xl bg-surface/80 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset,0_20px_40px_-24px_rgb(0_0_0/0.6)] backdrop-blur-sm", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  neutral: "bg-white/[0.05] text-muted ring-white/10",
  accent: "bg-accent/10 text-accent ring-accent/25",
  ok: "bg-ok/10 text-ok ring-ok/25",
  warn: "bg-warn/10 text-warn ring-warn/25",
  danger: "bg-danger/10 text-danger ring-danger/25",
  info: "bg-info/10 text-info ring-info/25",
  violet: "bg-violet/10 text-violet ring-violet/25",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const BTN = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_0_0_1px_rgb(94_234_212/0.4),0_8px_24px_-8px_rgb(94_234_212/0.45)]",
  secondary: "bg-white/[0.06] text-fg ring-1 ring-inset ring-white/10 hover:bg-white/[0.1]",
  ghost: "text-muted hover:text-fg hover:bg-white/[0.05]",
  danger: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger/20",
} as const;

export function buttonClass(variant: keyof typeof BTN = "secondary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
    BTN[variant],
  );
}

export function Button({ variant = "secondary", size = "md", className, ...rest }: ComponentProps<"button"> & { variant?: keyof typeof BTN; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: keyof typeof BTN; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center animate-fade-up">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">{icon}</div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "neutral", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  const color = { neutral: "text-fg", accent: "text-accent", ok: "text-ok", warn: "text-warn", danger: "text-danger", info: "text-info", violet: "text-violet" }[tone];
  return (
    <Card className="p-4 sm:p-5" as="div">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="text-faint">{icon}</span>
      </div>
      <div className={cx("mt-2 text-[28px] font-semibold tracking-[-0.03em] tabular", color)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

const field = "w-full rounded-lg bg-bg/60 px-3 text-sm text-fg ring-1 ring-inset ring-white/10 placeholder:text-faint transition-shadow focus:outline-none focus:ring-2 focus:ring-accent/60";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-muted">
      <span>{children}</span>
      {hint && <span className="font-normal text-faint">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(field, "h-10", className)} {...rest} />;
}
export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx(field, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238d989f%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_10px_center] bg-no-repeat pr-8", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(field, "min-h-20 py-2 leading-relaxed", className)} {...rest} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const ring = { neutral: "ring-white/10", accent: "ring-accent/25 bg-accent/[0.06]", ok: "ring-ok/25 bg-ok/[0.06]", warn: "ring-warn/25 bg-warn/[0.06]", danger: "ring-danger/30 bg-danger/[0.06]", info: "ring-info/25 bg-info/[0.05]", violet: "ring-violet/25 bg-violet/[0.06]" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl px-4 py-3 text-sm ring-1 ring-inset", ring)}>
      {title && <p className="mb-0.5 font-medium text-fg">{title}</p>}
      <div className="leading-relaxed text-muted">{children}</div>
    </div>
  );
}
