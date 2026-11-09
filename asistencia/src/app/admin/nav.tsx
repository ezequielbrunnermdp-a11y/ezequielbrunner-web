"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, Building, Store, Users, UserCog, CalendarClock, ListChecks, FilePenLine, Bell, FileBarChart, MonitorSmartphone, ScrollText,
} from "lucide-react";

const ICONS = { LayoutDashboard, Building, Store, Users, UserCog, CalendarClock, ListChecks, FilePenLine, Bell, FileBarChart, MonitorSmartphone, ScrollText };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Nav({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const path = usePathname();
  return (
    <nav className={clsx(mobile ? "flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]" : "space-y-0.5")}>
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition whitespace-nowrap",
              active ? "bg-brand-500/10 font-medium text-brand-700 dark:text-blue-300" : "text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{it.label}</span>
            {!!it.badge && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{it.badge > 99 ? "99+" : it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
