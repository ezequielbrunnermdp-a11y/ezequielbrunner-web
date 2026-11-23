import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { relativeTime } from '@/lib/format';
import { Button, EmptyState, ErrorState, LoadingList, PageHeader, cx } from '@/components/ui';

interface N { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export function NotificationsPage() {
  const { ctx } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useInfiniteQuery({
    queryKey: ['notifications'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let r = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
      if (pageParam) r = r.lt('created_at', pageParam);
      const { data, error } = await r;
      if (error) throw error; return data as N[];
    },
    getNextPageParam: (l) => (l.length === 30 ? l[l.length - 1]!.created_at : undefined),
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); void qc.invalidateQueries({ queryKey: ['badge'] }); };
  const markAll = async () => { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', ctx!.user_id).is('read_at', null); refresh(); };
  const open = async (n: N) => {
    if (!n.read_at) { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id); refresh(); }
    if (n.link) nav(n.link);
  };
  const items = q.data?.pages.flat() ?? [];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notificaciones" actions={items.some((n) => !n.read_at) && <Button variant="secondary" size="sm" icon={<CheckCheck className="h-4 w-4" />} onClick={() => void markAll()}>Marcar todo como leído</Button>} />
      {q.isLoading ? <LoadingList /> : q.isError ? <ErrorState error={q.error} /> : !items.length ? <EmptyState icon={<Bell className="h-5 w-5" />} title="Estás al día" description="Acá vas a ver solicitudes, mensajes, cambios de horario y novedades." /> : (
        <ul className="overflow-hidden rounded-2xl border border-line/70 bg-surface shadow-card">
          {items.map((n) => (
            <li key={n.id} className="border-b border-line/60 last:border-0">
              <button onClick={() => void open(n)} className={cx('flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60', !n.read_at && 'bg-accent-soft/40')}>
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-accent')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cx('text-[15px]', !n.read_at && 'font-semibold')}>{n.title}</p>
                  {n.body && <p className="truncate text-sm text-ink-3">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-ink-3">{relativeTime(n.created_at)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage && <Button className="mt-3" variant="ghost" block onClick={() => void q.fetchNextPage()}>Ver anteriores</Button>}
    </div>
  );
}
