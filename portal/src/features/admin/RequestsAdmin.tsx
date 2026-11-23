import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Repeat } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAction } from '@/lib/hooks';
import { fmtDate, fmtDateTime, fmtDayShort, fmtTime } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Input, LoadingList, PageHeader, Segmented } from '@/components/ui';
import { HR_STATUS, HR_TYPES, type HrRequest, type Swap } from '../work/RequestsPage';

export default function RequestsAdmin() {
  const [tab, setTab] = useState<'pending' | 'resolved' | 'swaps'>('pending');
  const q = useQuery({ queryKey: ['admin-hr', tab], enabled: tab !== 'swaps', queryFn: async () => {
    let r = supabase.from('hr_requests').select('*').order('created_at', { ascending: tab === 'pending' }).limit(100);
    r = tab === 'pending' ? r.eq('status', 'pending') : r.neq('status', 'pending');
    const { data, error } = await r; if (error) throw error; return data as (HrRequest & { branch_id: string })[];
  } });
  const swaps = useQuery({ queryKey: ['admin-swaps'], queryFn: async () => (await rpc<Swap[]>('my_swaps')).filter((s) => s.status === 'pending_manager') });
  const names = useQuery({ queryKey: ['names', 'hr', q.data?.map((r) => r.user_id).join(',')], enabled: Boolean(q.data?.length), queryFn: async () => {
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', [...new Set(q.data!.map((r) => r.user_id))]);
    return new Map((data ?? []).map((p) => [p.user_id as string, `${p.first_name} ${p.last_name}`]));
  } });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useAction((v: { id: string; ok: boolean }) => rpc('review_hr_request', { p_id: v.id, p_approve: v.ok, p_note: notes[v.id] || null }), { success: 'Solicitud resuelta y notificada', invalidate: [['admin-hr'], ['admin-overview']] });
  const reviewSwap = useAction((v: { id: string; ok: boolean }) => rpc('review_shift_swap', { p_id: v.id, p_approve: v.ok, p_note: notes[v.id] || null }), { success: 'Cambio resuelto', invalidate: [['admin-swaps'], ['admin-overview']] });
  return (
    <div className="space-y-5">
      <PageHeader title="Solicitudes" subtitle="Vacaciones, permisos, certificados y cambios de turno" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pendientes', count: tab === 'pending' ? q.data?.length : undefined }, { value: 'resolved', label: 'Resueltas' }, { value: 'swaps', label: 'Cambios de turno', count: swaps.data?.length }]} />
      {tab === 'swaps' ? (swaps.isLoading ? <LoadingList /> : !swaps.data?.length ? <EmptyState icon={<Repeat className="h-5 w-5" />} title="No hay cambios de turno por aprobar" compact /> : (
        <ul className="space-y-3">{swaps.data.map((s) => (
          <Card as="li" key={s.id} className="p-4">
            <p className="font-semibold">{s.requester_name} ⇄ {s.target_name} <span className="font-normal text-ink-3">· {s.branch_name}</span></p>
            <p className="mt-1 text-sm tabular text-ink-2">{fmtDayShort(s.requester_starts)} {fmtTime(s.requester_starts)}–{fmtTime(s.requester_ends)}{s.target_starts && ` ⇄ ${fmtDayShort(s.target_starts)} ${fmtTime(s.target_starts)}–${fmtTime(s.target_ends!)}`}</p>
            {s.reason && <p className="mt-1 text-sm text-ink-3">{s.reason}</p>}
            <p className="mt-1 text-xs text-ink-3">El compañero ya aceptó. Al aprobar, el sistema verifica superposiciones y descansos.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input className="h-9 text-sm" placeholder="Nota (opcional)" value={notes[s.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} />
              <div className="flex gap-2"><Button size="sm" onClick={() => reviewSwap.mutate({ id: s.id, ok: true })}>Aprobar</Button><Button size="sm" variant="secondary" onClick={() => reviewSwap.mutate({ id: s.id, ok: false })}>Rechazar</Button></div></div>
          </Card>
        ))}</ul>
      )) : q.isLoading ? <LoadingList /> : !q.data?.length ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={tab === 'pending' ? 'No hay solicitudes pendientes' : 'Sin solicitudes resueltas'} compact /> : (
        <ul className="space-y-3">{q.data.map((r) => (
          <Card as="li" key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold">{names.data?.get(r.user_id) ?? '…'} · {HR_TYPES[r.type]} <span className="font-normal text-ink-3">#{r.number}</span></p>
                {r.start_date && <p className="text-sm text-ink-2">{fmtDate(r.start_date + 'T12:00:00')}{r.end_date && r.end_date !== r.start_date && ` al ${fmtDate(r.end_date + 'T12:00:00')}`}</p>}</div>
              <Badge tone={HR_STATUS[r.status]![1]}>{HR_STATUS[r.status]![0]}</Badge>
            </div>
            <p className="mt-2 text-sm">{r.details}</p>
            <p className="mt-1 text-xs text-ink-3">Recibida {fmtDateTime(r.created_at)}{r.reviewed_at && ` · Resuelta ${fmtDateTime(r.reviewed_at)}`}</p>
            {r.review_note && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">{r.review_note}</p>}
            {r.status === 'pending' && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input className="h-9 text-sm" placeholder="Respuesta (opcional)" value={notes[r.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                <div className="flex gap-2"><Button size="sm" onClick={() => review.mutate({ id: r.id, ok: true })}>Aprobar</Button><Button size="sm" variant="secondary" onClick={() => review.mutate({ id: r.id, ok: false })}>Rechazar</Button></div></div>
            )}
          </Card>
        ))}</ul>
      )}
    </div>
  );
}
