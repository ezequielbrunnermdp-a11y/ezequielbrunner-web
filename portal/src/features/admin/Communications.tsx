import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, LoadingList, PageHeader, Segmented } from '@/components/ui';
import { TicketRow, type Ticket } from '../work/MgmtContactPage';

export default function Communications() {
  const { ctx } = useAuth();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const q = useQuery({ queryKey: ['mgmt-inbox'], queryFn: async () => {
    const { data, error } = await supabase.from('mgmt_tickets').select('*').eq('recipient_id', ctx!.user_id).order('updated_at', { ascending: false });
    if (error) throw error; return data as Ticket[];
  } });
  const open = q.data?.filter((t) => !['resolved', 'closed'].includes(t.status)) ?? [];
  const closed = q.data?.filter((t) => ['resolved', 'closed'].includes(t.status)) ?? [];
  const list = tab === 'open' ? open : closed;
  const order = { urgent: 0, high: 1, normal: 2, low: 3 } as Record<string, number>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Comunicaciones" subtitle="Mensajes de “Hablar con gerencia” dirigidos a vos" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'open', label: 'Abiertas', count: open.filter((t) => t.status === 'received').length }, { value: 'closed', label: 'Resueltas y cerradas' }]} />
      {q.isLoading ? <LoadingList /> : !list.length ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="Bandeja vacía" compact /> : (
        <ul className="space-y-2.5">{[...list].sort((a, b) => (order[a.priority]! - order[b.priority]!)).map((t) => <TicketRow key={t.id} t={t} to={`/gerencia/comunicaciones/${t.id}`} />)}</ul>
      )}
    </div>
  );
}
