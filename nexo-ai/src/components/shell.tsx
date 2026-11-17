"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Upload, MessagesSquare, Inbox, ListChecks, Search, FileBarChart, Settings, Menu, X, LogOut, ChevronsUpDown, FlaskConical,
} from "lucide-react";
import { Logo } from "./logo";
import { cx } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/inbox", label: "Validación", icon: Inbox, badgeKey: "inbox" as const },
  { href: "/tasks", label: "Tareas", icon: ListChecks },
  { href: "/search", label: "Buscador", icon: Search },
  { href: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { href: "/imports", label: "Importar", icon: Upload },
  { href: "/reports", label: "Reportes", icon: FileBarChart },
  { href: "/admin", label: "Administración", icon: Settings },
];

export interface ShellProps {
  user: { name: string; email: string };
  companies: { id: string; name: string; isDemo: boolean; role: string }[];
  activeId: string;
  roleLabel: string;
  inboxCount: number;
  switchAction: (fd: FormData) => Promise<void>;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}

export function Shell(p: ShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const active = p.companies.find((c) => c.id === p.activeId);

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
              current ? "bg-white/[0.06] text-fg" : "text-muted hover:bg-white/[0.035] hover:text-fg",
            )}
          >
            {current && <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent shadow-[0_0_12px_rgb(94_234_212/0.8)]" aria-hidden />}
            <Icon className={cx("size-4 shrink-0 transition-colors", current ? "text-accent" : "text-faint group-hover:text-muted")} aria-hidden />
            <span className="truncate">{label}</span>
            {badgeKey === "inbox" && p.inboxCount > 0 && (
              <span className="ml-auto rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent tabular" aria-label={`${p.inboxCount} pendientes`}>
                {p.inboxCount > 99 ? "99+" : p.inboxCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const companySwitch = (
    <form action={p.switchAction} className="relative">
      <label htmlFor="company-switch" className="sr-only">Empresa activa</label>
      <select
        id="company-switch"
        name="company_id"
        defaultValue={p.activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-11 w-full appearance-none truncate rounded-xl bg-surface-2/80 pl-3 pr-9 text-left text-[13px] font-medium text-fg ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:outline-none focus:ring-2 focus:ring-accent/60"
      >
        {p.companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
      <noscript><button type="submit" className="mt-2 text-xs text-accent">Cambiar</button></noscript>
    </form>
  );

  const footer = (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/30 to-accent/5 text-xs font-semibold text-accent ring-1 ring-inset ring-accent/25" aria-hidden>
        {p.user.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{p.user.name}</p>
        <p className="truncate text-[11px] text-faint">{p.roleLabel}</p>
      </div>
      <form action={p.logoutAction}>
        <button type="submit" className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-white/5 hover:text-fg" aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Saltar al contenido
      </a>

      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-bg/60 px-3 py-5 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="px-2"><Logo /></Link>
        {companySwitch}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      {/* Móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <Link href="/dashboard"><Logo /></Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg"
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-up" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
          <div id="mobile-nav" className="absolute inset-y-0 right-0 flex w-[84%] max-w-xs flex-col gap-5 border-l border-line bg-surface px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5" aria-label="Cerrar menú">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {companySwitch}
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {footer}
          </div>
        </div>
      )}

      <div className="min-w-0">
        {active?.isDemo && (
          <div className="flex items-center justify-center gap-2 border-b border-violet/20 bg-violet/[0.07] px-4 py-2 text-center text-xs text-violet">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            <span><strong className="font-semibold">Empresa de demostración.</strong> Todas las conversaciones, personas y tareas son ficticias.</span>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">{p.children}</main>
      </div>
    </div>
  );
}
