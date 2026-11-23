import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDate, fmtDateTime, fmtDayLong, localDate, zonedToUtc } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, PageHeader, Segmented, Sheet, Textarea } from '@/components/ui';
import { MEETING_STATUS, type Meeting } from '../work/MeetingsPage';

export default function Agenda() {
  const { ctx } = useAuth();
  const [tab, setTab] = useState<'pending' | 'agenda' | 'history'>('pending');
  const [sel, setSel] = useState<{ m: Meeting; action: string } | null>(null);
  const q = useQuery({ queryKey: ['agenda'], queryFn: async () => {
    const { data, error } = await supabase.from('meeting_requests').select('*').eq('responder_id', ctx!.user_id).order('created_at', { ascending: false });
    if (error) throw error; return data as Meeting[];
  } });
  const names = useQuery({ queryKey: ['names', 'agenda', q.data?.length], enabled: Boolean(q.data?.length), queryFn: async () => {
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', [...new Set(q.data!.map((m) => m.requester_id))]);
    return new Map((data ?? []).map((p) => [p.user_id as string, `${p.first_name} ${p.last_name}`]));
  } });
  const done = useAction((id: string) => rpc('respond_meeting', { p_id: id, p_action: 'done' }), { success: 'Marcada como realizada', invalidate: [['agenda']] });
  const list = (q.data ?? []).filter((m) => tab === 'pending' ? m.status === 'requested'
    : tab === 'agenda' ? ['accepted', 'proposed'].includes(m.status) : ['done', 'rejected', 'cancelled'].includes(m.status))
    .sort((a, b) => (tab === 'agenda' ? (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') : 0));
  let lastDay = '';
  return (
    <div className="space-y-5">
      <PageHeader title="Agenda gerencial" subtitle="Solicitudes de reunión dirigidas a vos. El contenido es visible solo para las personas participantes." />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Por responder', count: q.data?.filter((m) => m.status === 'requested').length }, { value: 'agenda', label: 'Agenda' }, { value: 'history', label: 'Historial' }]} />
      {q.isLoading ? <LoadingList /> : !list.length ? <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="Nada por acá" compact /> : (
        <ul className="space-y-3">{list.map((m) => {
          const day = m.scheduled_at ? localDate(m.scheduled_at) : '';
          const header = tab === 'agenda' && day !== lastDay ? (lastDay = day) : null;
          return (
            <li key={m.id}>
              {header && <p className="mb-2 mt-4 text-sm font-semibold capitalize text-ink-2">{fmtDayLong(m.scheduled_at!)}</p>}
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold">{names.data?.get(m.requester_id) ?? '…'} · {m.reason}</p><Badge tone={MEETING_STATUS[m.status]![1]}>{MEETING_STATUS[m.status]![0]}</Badge></div>
                {m.description && <p className="mt-1 text-sm text-ink-2">{m.description}</p>}
                <p className="mt-1 text-xs text-ink-3">{m.modality === 'virtual' ? 'Virtual' : 'Presencial'}{m.preferred_date && ` · Prefiere ${fmtDate(m.preferred_date + 'T12:00:00')}${m.preferred_time ? ' ' + m.preferred_time.slice(0, 5) : ''}`}{m.scheduled_at && ` · ${fmtDateTime(m.scheduled_at)}`}{m.location && ` · ${m.location}`}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.status === 'requested' && <><Button size="sm" onClick={() => setSel({ m, action: 'accept' })}>Aceptar</Button><Button size="sm" variant="secondary" onClick={() => setSel({ m, action: 'propose' })}>Proponer otra fecha</Button><Button size="sm" variant="ghost" onClick={() => setSel({ m, action: 'reject' })}>Rechazar</Button></>}
                  {['accepted', 'proposed'].includes(m.status) && <><Button size="sm" variant="secondary" onClick={() => setSel({ m, action: 'propose' })}>Reprogramar</Button><Button size="sm" variant="ghost" onClick={() => done.mutate(m.id)}>Marcar realizada</Button></>}
                </div>
              </Card>
            </li>
          );
        })}</ul>
      )}
      {sel && <Respond {...sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function Respond({ m, action, onClose }: { m: Meeting; action: string; onClose: () => void }) {
  const [date, setDate] = useState(m.preferred_date ?? localDate());
  const [time, setTime] = useState(m.preferred_time?.slice(0, 5) ?? '10:00');
  const [duration, setDuration] = useState('30');
  const [location, setLocation] = useState(m.location ?? '');
  const [note, setNote] = useState('');
  const go = useAction(() => rpc('respond_meeting', { p_id: m.id, p_action: action, p_scheduled_at: action === 'reject' ? null : zonedToUtc(date, time), p_note: note.trim() || null, p_location: location.trim() || null, p_duration: Number(duration) }), {
    success: 'Respuesta enviada', invalidate: [['agenda'], ['admin-overview']], onDone: onClose });
  const title = { accept: 'Confirmar reunión', propose: 'Proponer fecha', reject: 'Rechazar solicitud' }[action];
  return (
    <Sheet open onClose={onClose} title={title!}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={go.isPending} disabled={action === 'reject' && note.trim().length < 3} onClick={() => go.mutate(undefined)}>Enviar</Button></>}>
      <div className="space-y-4">
        {action !== 'reject' && <>
          <div className="grid grid-cols-3 gap-3"><Field label="Fecha"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Hora"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field><Field label="Minutos"><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field></div>
          <Field label={m.modality === 'virtual' ? 'Enlace de la videollamada' : 'Lugar'} optional><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        </>}
        <Field label={action === 'reject' ? 'Motivo (obligatorio)' : 'Mensaje'} optional={action !== 'reject'}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}
