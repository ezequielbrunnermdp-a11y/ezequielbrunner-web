import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardPlus, Store, FileText, AlertTriangle, ListChecks, BarChart3, BookOpen,
  Users, SlidersHorizontal, Palette, LogOut, Bell, Menu, X, History, KeyRound,
} from 'lucide-react';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { ROLE_LABEL, fmtDateTime } from '../lib/format';
import type { NotificationRow } from '../lib/types';
import { BrandMark } from './Brand';
import { cx } from './ui';

interface NavItem { to: string; label: string; icon: ReactNode; roles: string[]; mobile?: boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Panel', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'], mobile: true },
  { to: '/auditorias/nueva', label: 'Nueva auditoría', icon: <ClipboardPlus className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor'], mobile: true },
  { to: '/reportes', label: 'Reportes', icon: <FileText className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'], mobile: true },
  { to: '/sucursales', label: 'Sucursales', icon: <Store className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'] },
  { to: '/incumplimientos', label: 'Seguimiento', icon: <ListChecks className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'], mobile: true },
  { to: '/alertas', label: 'Alertas', icon: <AlertTriangle className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'] },
  { to: '/indicadores', label: 'Indicadores comerciales', icon: <BarChart3 className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'] },
  { to: '/manual', label: 'Manual y estándares', icon: <BookOpen className="h-[18px] w-[18px]" />, roles: ['admin', 'auditor', 'franquiciado'] },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: <Users className="h-[18px] w-[18px]" />, roles: ['admin'] },
  { to: '/admin/cuestionario', label: 'Cuestionario', icon: <SlidersHorizontal className="h-[18px] w-[18px]" />, roles: ['admin'] },
  { to: '/admin/marca', label: 'Identidad visual', icon: <Palette className="h-[18px] w-[18px]" />, roles: ['admin'] },
  { to: '/admin/registro', label: 'Registro de operaciones', icon: <History className="h-[18px] w-[18px]" />, roles: ['admin'] },
];

function SideLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} onClick={onClick}
      className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
        isActive ? 'bg-crema-50/10 text-crema-50' : 'text-crema-200/70 hover:bg-crema-50/5 hover:text-crema-50')}>
      {item.icon}<span>{item.label}</span>
    </NavLink>
  );
}

function Notifications() {
  const { profile } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const navigate = useNavigate();
  const load = async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
    setItems((data as NotificationRow[]) ?? []);
  };
  useEffect(() => {
    if (!profile) return;
    load();
    const iv = window.setInterval(load, 60000);
    return () => window.clearInterval(iv);
  }, [profile]);
  const unread = items.filter((i) => !i.read_at).length;
  const markAll = async () => {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (ids.length) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    load();
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost relative p-2" aria-label={`Notificaciones${unread ? `: ${unread} sin leer` : ''}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#a33b2b] px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="fade-in absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-cafe-800/10">
            <div className="flex items-center justify-between border-b border-cafe-800/10 px-4 py-3">
              <span className="font-serif text-lg font-semibold">Notificaciones</span>
              {unread > 0 && <button className="text-xs font-semibold text-brand-accent" onClick={markAll}>Marcar todas como leídas</button>}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 && <div className="px-4 py-8 text-center text-sm text-cafe-500">Sin notificaciones.</div>}
              {items.map((n) => (
                <button key={n.id} className={cx('block w-full border-b border-cafe-800/5 px-4 py-3 text-left hover:bg-crema-100', !n.read_at && 'bg-brand-accent/5')}
                  onClick={async () => {
                    if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                    setOpen(false);
                    load();
                    if (n.link) navigate(n.link);
                  }}>
                  <div className="text-sm font-semibold text-cafe-900">{n.title}</div>
                  {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-cafe-500">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-cafe-400">{fmtDateTime(n.created_at)}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Layout() {
  const { profile, signOut } = useSession();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  useEffect(() => setDrawer(false), [loc.pathname]);
  if (!profile) return null;
  const items = NAV.filter((i) => i.roles.includes(profile.role));
  const admin = profile.role === 'admin' ? ADMIN_NAV : [];

  const sidebar = (
    <div className="flex h-full flex-col bg-brand px-4 py-6">
      <BrandMark compact light className="px-2" />
      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        {items.map((i) => <SideLink key={i.to} item={i} />)}
        {admin.length > 0 && (
          <>
            <div className="px-3 pb-1 pt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-oro-300/80">Administración</div>
            {admin.map((i) => <SideLink key={i.to} item={i} />)}
          </>
        )}
      </nav>
      <div className="mt-4 border-t border-crema-50/10 px-2 pt-4">
        <div className="truncate text-sm font-semibold text-crema-50">{profile.full_name || profile.email}</div>
        <div className="text-xs text-crema-200/60">{ROLE_LABEL[profile.role]}</div>
        <a href="/restablecer" className="mt-3 flex items-center gap-2 text-sm text-crema-200/70 hover:text-crema-50">
          <KeyRound className="h-4 w-4" /> Cambiar contraseña
        </a>
        <button onClick={signOut} className="mt-2 flex items-center gap-2 text-sm text-crema-200/70 hover:text-crema-50">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-cafe-900/50" onClick={() => setDrawer(false)} />
          <div className="fade-in absolute inset-y-0 left-0 w-72 max-w-[85vw]">
            {sidebar}
            <button className="absolute right-3 top-5 p-2 text-crema-50" onClick={() => setDrawer(false)} aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cafe-800/5 bg-[rgb(var(--brand-bg)/0.85)] px-4 py-2.5 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2 lg:hidden">
          <button className="btn-ghost -ml-2 p-2" onClick={() => setDrawer(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <BrandMark compact />
        </div>
        <div className="hidden text-sm text-cafe-500 lg:block">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <Notifications />
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <Outlet />
      </main>

      <nav className="mobile-nav safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-cafe-800/10 bg-white/95 backdrop-blur lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0,1fr))` }}>
          {mobileItems.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium', isActive ? 'text-brand' : 'text-cafe-400')}>
              {i.icon}<span className="truncate">{i.label === 'Nueva auditoría' ? 'Auditar' : i.label}</span>
            </NavLink>
          ))}
          <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium text-cafe-400">
            <Menu className="h-[18px] w-[18px]" /><span>Más</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
