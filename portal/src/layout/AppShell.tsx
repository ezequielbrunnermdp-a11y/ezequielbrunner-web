import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Home, Users, MessageCircle, CalendarDays, UserRound, Bell, Menu, Fingerprint, FileText, GraduationCap, Gift,
  CalendarCheck, Inbox, ClipboardList, Settings, LayoutDashboard, Building2, CalendarClock, ShieldCheck, BarChart3,
  Megaphone, FolderLock, BookOpen, Lightbulb, PartyPopper, WifiOff, LogOut, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, rpc } from '@/lib/supabase';
import { useOnline } from '@/lib/hooks';
import { Avatar, Sheet, cx } from '@/components/ui';
import { BrandMark } from '@/components/BrandMark';

interface Item { to: string; label: string; icon: ReactNode; perm?: string; end?: boolean }

const primary: Item[] = [
  { to: '/', label: 'Inicio', icon: <Home className="h-[22px] w-[22px]" />, end: true },
  { to: '/comunidad', label: 'Comunidad', icon: <Users className="h-[22px] w-[22px]" /> },
  { to: '/mensajes', label: 'Mensajes', icon: <MessageCircle className="h-[22px] w-[22px]" /> },
  { to: '/horarios', label: 'Horarios', icon: <CalendarDays className="h-[22px] w-[22px]" /> },
  { to: '/perfil', label: 'Mi perfil', icon: <UserRound className="h-[22px] w-[22px]" /> },
];
const secondary: Item[] = [
  { to: '/fichaje', label: 'Fichar', icon: <Fingerprint className="h-[18px] w-[18px]" /> },
  { to: '/solicitudes', label: 'Solicitudes', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { to: '/reuniones', label: 'Reuniones', icon: <CalendarCheck className="h-[18px] w-[18px]" /> },
  { to: '/gerencia-contacto', label: 'Hablar con gerencia', icon: <Inbox className="h-[18px] w-[18px]" /> },
  { to: '/documentos', label: 'Documentos', icon: <FileText className="h-[18px] w-[18px]" /> },
  { to: '/capacitaciones', label: 'Capacitaciones', icon: <GraduationCap className="h-[18px] w-[18px]" /> },
  { to: '/beneficios', label: 'Beneficios', icon: <Gift className="h-[18px] w-[18px]" /> },
  { to: '/eventos', label: 'Eventos y encuestas', icon: <PartyPopper className="h-[18px] w-[18px]" /> },
  { to: '/sugerencias', label: 'Sugerencias', icon: <Lightbulb className="h-[18px] w-[18px]" /> },
  { to: '/configuracion', label: 'Configuración', icon: <Settings className="h-[18px] w-[18px]" /> },
];
export const managerItems: Item[] = [
  { to: '/gerencia', label: 'Panel', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true, perm: 'employees.view' },
  { to: '/gerencia/asistencia', label: 'Asistencia', icon: <ClipboardCheck className="h-[18px] w-[18px]" />, perm: 'attendance.view' },
  { to: '/gerencia/horarios', label: 'Planificador', icon: <CalendarClock className="h-[18px] w-[18px]" />, perm: 'schedules.manage' },
  { to: '/gerencia/empleados', label: 'Personal', icon: <Users className="h-[18px] w-[18px]" />, perm: 'employees.view' },
  { to: '/gerencia/solicitudes', label: 'Solicitudes', icon: <ClipboardList className="h-[18px] w-[18px]" />, perm: 'requests.review' },
  { to: '/gerencia/agenda', label: 'Agenda', icon: <CalendarCheck className="h-[18px] w-[18px]" />, perm: 'meetings.manage' },
  { to: '/gerencia/comunicaciones', label: 'Comunicaciones', icon: <Inbox className="h-[18px] w-[18px]" />, perm: 'tickets.receive' },
  { to: '/gerencia/comunidad', label: 'Comunidad', icon: <Megaphone className="h-[18px] w-[18px]" />, perm: 'community.publish' },
  { to: '/gerencia/documentos', label: 'Documentos', icon: <FolderLock className="h-[18px] w-[18px]" />, perm: 'docs.manage' },
  { to: '/gerencia/capacitaciones', label: 'Capacitaciones', icon: <BookOpen className="h-[18px] w-[18px]" />, perm: 'trainings.manage' },
  { to: '/gerencia/reportes', label: 'Reportes', icon: <BarChart3 className="h-[18px] w-[18px]" />, perm: 'reports.view' },
  { to: '/gerencia/sucursales', label: 'Sucursales', icon: <Building2 className="h-[18px] w-[18px]" />, perm: 'branches.manage' },
  { to: '/gerencia/roles', label: 'Roles y permisos', icon: <ShieldCheck className="h-[18px] w-[18px]" />, perm: 'roles.manage' },
  { to: '/gerencia/configuracion', label: 'Configuración', icon: <Settings className="h-[18px] w-[18px]" />, perm: 'org.manage' },
];

function useBadges() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const unreadMsgs = useQuery({
    queryKey: ['badge', 'messages'], enabled: Boolean(uid), refetchInterval: 60_000,
    queryFn: async () => (await rpc<{ unread: number; muted: boolean }[]>('my_conversations')).reduce((a, c) => a + (c.muted ? 0 : Number(c.unread)), 0),
  });
  const unreadNotif = useQuery({
    queryKey: ['badge', 'notifications'], enabled: Boolean(uid), refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  // Tiempo real: las notificaciones nuevas actualizan los indicadores al instante.
  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(`notif:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        void qc.invalidateQueries({ queryKey: ['badge'] });
        void qc.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid, qc]);
  return { messages: unreadMsgs.data ?? 0, notifications: unreadNotif.data ?? 0 };
}

const Count = ({ n, className }: { n: number; className?: string }) =>
  n > 0 ? <span className={cx('min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-[18px] text-accent-ink', className)}>{n > 99 ? '99+' : n}</span> : null;

export function AppShell() {
  const { ctx, can, signOut } = useAuth();
  const online = useOnline();
  const badges = useBadges();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setMenu(false), [loc.pathname]);
  const mgr = managerItems.filter((i) => !i.perm || can(i.perm));
  const emp = ctx?.employments[0];

  const sideLink = (i: Item, count?: number) => (
    <NavLink key={i.to} to={i.to} end={i.end}
      className={({ isActive }) => cx('flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors',
        isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2/60 hover:text-ink')}>
      {i.icon}<span className="flex-1 truncate">{i.label}</span>{count ? <Count n={count} /> : null}
    </NavLink>
  );

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line/70 bg-surface lg:flex">
        <div className="flex h-16 items-center gap-3 px-5"><BrandMark /></div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Principal">
          <div className="space-y-0.5">
            {primary.map((i) => sideLink({ ...i, icon: <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{i.icon}</span> }, i.to === '/mensajes' ? badges.messages : undefined))}
          </div>
          <div className="space-y-0.5">
            <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">Trabajo</p>
            {secondary.map((i) => sideLink(i))}
          </div>
          {mgr.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">Gerencia</p>
              {mgr.map((i) => sideLink(i))}
            </div>
          )}
        </nav>
        <div className="flex items-center gap-3 border-t border-line/70 px-4 py-3">
          <Avatar path={ctx?.profile?.avatar_path} person={ctx?.profile} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{ctx?.profile?.first_name} {ctx?.profile?.last_name}</p>
            <p className="truncate text-xs text-ink-3">{emp ? `${emp.position} · ${emp.branch}` : 'Sin asignación'}</p>
          </div>
          <button className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Barra superior */}
      <header className="pt-safe sticky top-0 z-20 border-b border-line/60 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 lg:px-8">
          <div className="lg:hidden"><BrandMark compact /></div>
          <div className="hidden text-sm text-ink-3 lg:block">{ctx?.organization?.name}</div>
          <div className="flex items-center gap-1">
            <button onClick={() => nav('/notificaciones')} className="relative rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label={`Notificaciones${badges.notifications ? `, ${badges.notifications} sin leer` : ''}`}>
              <Bell className="h-5 w-5" />
              <Count n={badges.notifications} className="absolute -right-0.5 -top-0.5" />
            </button>
            <button onClick={() => setMenu(true)} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Más opciones">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-1.5 text-xs font-medium text-warn" role="status">
            <WifiOff className="h-3.5 w-3.5" /> Sin conexión. Los datos pueden no estar actualizados y nada se confirma hasta reconectar.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
        <Outlet />
      </main>

      {/* Barra inferior (móvil) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/95 backdrop-blur-md lg:hidden" aria-label="Principal">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {primary.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}
              className={({ isActive }) => cx('relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors', isActive ? 'text-accent' : 'text-ink-3')}>
              {i.icon}
              <span>{i.label}</span>
              {i.to === '/mensajes' && <Count n={badges.messages} className="absolute left-1/2 top-1.5 ml-2" />}
            </NavLink>
          ))}
        </div>
      </nav>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Más opciones">
        <div className="grid grid-cols-2 gap-2">
          {secondary.map((i) => (
            <NavLink key={i.to} to={i.to} className="flex items-center gap-2.5 rounded-xl border border-line/70 px-3 py-3 text-sm font-medium text-ink hover:bg-surface-2">
              <span className="text-accent">{i.icon}</span>{i.label}
            </NavLink>
          ))}
        </div>
        {mgr.length > 0 && (
          <>
            <p className="mb-2 mt-6 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">Gerencia</p>
            <div className="grid grid-cols-2 gap-2">
              {mgr.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-3 text-sm font-medium text-ink">
                  <span className="text-ink-2">{i.icon}</span>{i.label}
                </NavLink>
              ))}
            </div>
          </>
        )}
        <button onClick={() => void signOut()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-bad hover:bg-bad-soft">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </Sheet>
    </div>
  );
}
