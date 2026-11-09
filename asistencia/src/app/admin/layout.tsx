import { redirect } from "next/navigation";
import { LogOut, Smartphone } from "lucide-react";
import { requireActor } from "@/lib/session";
import { can, isStaff, ROLE_LABEL, scopeSql } from "@/lib/permissions";
import { one } from "@/lib/db";
import { ThemeToggle } from "@/components/theme";
import { logoutAction } from "../actions";
import { Nav, type NavItem } from "./nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await requireActor();
  if (!isStaff(a)) redirect("/mi");
  if (a.must_change_password) redirect("/cuenta?primer-ingreso=1");
  const p: unknown[] = [];
  const counts = await one(
    `select (select count(*)::int from alerts al where al.acknowledged_at is null and al.created_at > now() - interval '7 days'
               and al.severity <> 'info' and ${scopeSql(a, "al.company_id", "al.branch_id", p)}) as alerts,
            (select count(*)::int from correction_requests cr where cr.status = 'pending' and ${scopeSql(a, "cr.company_id", "cr.branch_id", p)}) as corrections`,
    p,
  );
  const items: NavItem[] = [
    { href: "/admin", label: "Tablero", icon: "LayoutDashboard" },
    { href: "/admin/fichadas", label: "Fichadas", icon: "ListChecks" },
    { href: "/admin/alertas", label: "Alertas", icon: "Bell", badge: counts?.alerts },
    { href: "/admin/correcciones", label: "Correcciones", icon: "FilePenLine", badge: can(a, "corrections.review") ? counts?.corrections : 0 },
    { href: "/admin/horarios", label: "Horarios y novedades", icon: "CalendarClock" },
    { href: "/admin/reportes", label: "Reportes", icon: "FileBarChart" },
    { href: "/admin/empleados", label: "Empleados", icon: "Users" },
    ...(can(a, "branches.manage") ? [{ href: "/admin/sucursales", label: "Sucursales", icon: "Store" } as NavItem] : []),
    ...(can(a, "companies.manage") ? [{ href: "/admin/empresas", label: "Empresas", icon: "Building" } as NavItem] : []),
    ...(can(a, "terminals.manage") ? [{ href: "/admin/terminales", label: "Terminales", icon: "MonitorSmartphone" } as NavItem] : []),
    ...(can(a, "users.manage") ? [{ href: "/admin/usuarios", label: "Usuarios y permisos", icon: "UserCog" } as NavItem] : []),
    ...(can(a, "audit.view") ? [{ href: "/admin/auditoria", label: "Auditoría", icon: "ScrollText" } as NavItem] : []),
  ];
  const user = (
    <div className="flex items-center gap-1">
      <ThemeToggle />
      {a.employee_id && <a href="/mi" className="rounded-lg p-2 text-muted hover:bg-[var(--surface-2)]" title="Mi fichaje"><Smartphone className="size-4" /></a>}
      <form action={logoutAction}><button className="rounded-lg p-2 text-muted hover:bg-[var(--surface-2)]" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut className="size-4" /></button></form>
    </div>
  );
  return (
    <div className="lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-app bg-[var(--surface)] p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
          <div className="leading-tight"><div className="text-sm font-semibold">Asistencia</div><div className="text-xs text-muted">Panel de gestión</div></div>
        </div>
        <div className="flex-1 overflow-y-auto"><Nav items={items} /></div>
        <div className="mt-4 border-t border-app pt-3">
          <a href="/cuenta" className="block truncate px-1 text-sm font-medium">{a.full_name}</a>
          <div className="flex items-center justify-between px-1"><span className="truncate text-xs text-muted">{ROLE_LABEL[a.role]}</span>{user}</div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-app bg-[var(--surface)]/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2"><img src="/icon.svg" alt="" className="size-7 rounded-lg" /><span className="text-sm font-semibold">Asistencia</span></div>
            {user}
          </div>
          <Nav items={items} mobile />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
