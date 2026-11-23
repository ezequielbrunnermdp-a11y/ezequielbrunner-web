import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pin, Cake, CalendarCheck, Inbox, ClipboardList, Megaphone, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { rpc, supabase } from '@/lib/supabase';
import { Avatar, Card, CardHeader, cx } from '@/components/ui';
import { fmtDayLong, relativeTime } from '@/lib/format';
import { ClockCard } from '../clock/ClockCard';

interface Pinned { id: string; body: string; inst_type: string | null; created_at: string }
interface Bday { user_id: string; first_name: string; last_name: string; avatar_path: string | null; in_days: number }

function greeting() {
  const h = Number(new Intl.DateTimeFormat('es-AR', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()));
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export function HomePage() {
  const { ctx, isManager } = useAuth();
  const pinned = useQuery({ queryKey: ['pinned'], queryFn: () => rpc<Pinned[]>('pinned_posts') });
  const bdays = useQuery({ queryKey: ['birthdays'], queryFn: () => rpc<Bday[]>('upcoming_birthdays', { p_days: 14 }) });
  const pending = useQuery({
    queryKey: ['my-requests-pending'],
    queryFn: async () => {
      const [hr, mt] = await Promise.all([
        supabase.from('hr_requests').select('id', { count: 'exact', head: true }).eq('user_id', ctx!.user_id).eq('status', 'pending'),
        supabase.from('meeting_requests').select('id', { count: 'exact', head: true }).eq('requester_id', ctx!.user_id).in('status', ['requested', 'proposed']),
      ]);
      return { hr: hr.count ?? 0, meetings: mt.count ?? 0 };
    },
    enabled: Boolean(ctx),
  });

  const quick = [
    { to: '/reuniones', label: 'Pedir reunión', icon: <CalendarCheck className="h-5 w-5" /> },
    { to: '/gerencia-contacto', label: 'Hablar con gerencia', icon: <Inbox className="h-5 w-5" /> },
    { to: '/solicitudes', label: 'Solicitudes', icon: <ClipboardList className="h-5 w-5" />, count: pending.data?.hr },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-sm capitalize text-ink-3">{fmtDayLong(new Date())}</p>
        <h1 className="mt-0.5 text-[26px] font-semibold tracking-[-0.02em]">{greeting()}, {ctx?.profile?.first_name}</h1>
      </div>

      <ClockCard />

      {isManager && (
        <Link to="/gerencia" className="flex items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-bg">
          <LayoutDashboard className="h-5 w-5" /><span className="flex-1 text-[15px] font-medium">Panel de gerencia</span><ChevronRight className="h-4 w-4 opacity-60" />
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {quick.map((q) => (
          <Link key={q.to} to={q.to} className="relative flex flex-col items-start gap-3 rounded-2xl border border-line/70 bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-2">
            <span className="text-accent">{q.icon}</span>
            <span className="text-[13px] font-medium leading-tight">{q.label}</span>
            {q.count ? <span className="absolute right-3 top-3 rounded-full bg-accent px-1.5 text-2xs font-semibold text-accent-ink">{q.count}</span> : null}
          </Link>
        ))}
      </div>

      {(pinned.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title="Comunicados" icon={<Pin className="h-4 w-4" />} />
          <ul className="divide-y divide-line/70 px-5 pb-2">
            {pinned.data!.map((p) => (
              <li key={p.id}>
                <Link to={`/comunidad/post/${p.id}`} className="flex gap-3 py-3">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm text-ink">{p.body}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{relativeTime(p.created_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(bdays.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title="Cumpleaños" subtitle="Compañeros que eligieron compartirlo" icon={<Cake className="h-4 w-4" />} />
          <div className="scrollbar-none flex gap-4 overflow-x-auto px-5 pb-4 pt-2">
            {bdays.data!.map((b) => (
              <Link key={b.user_id} to={`/perfil/${b.user_id}`} className="flex w-16 shrink-0 flex-col items-center text-center">
                <Avatar path={b.avatar_path} person={b} size={52} className={cx(b.in_days === 0 && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')} />
                <span className="mt-1.5 w-full truncate text-xs font-medium">{b.first_name}</span>
                <span className="text-2xs text-ink-3">{b.in_days === 0 ? '¡Hoy!' : b.in_days === 1 ? 'Mañana' : `En ${b.in_days} días`}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Link to="/comunidad" className="flex items-center justify-between rounded-2xl border border-line/70 bg-surface px-5 py-4 shadow-card">
        <div><p className="text-[15px] font-medium">Novedades del equipo</p><p className="text-sm text-ink-3">Mirá lo que comparten tus compañeros</p></div>
        <ChevronRight className="h-4 w-4 text-ink-3" />
      </Link>
    </div>
  );
}
