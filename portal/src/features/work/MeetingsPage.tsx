import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Plus, Video, Building, MapPin } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, LoadingList, PageHeader, Select, Sheet, Textarea } from '@/components/ui';

export interface Meeting {
  id: string; requester_id: string; responder_id: string; responder_kind: string; reason: string; description: string | null; preferred_date: string | null;
  preferred_time: string | null; modality: string; status: string; scheduled_at: string | null; duration_min: number; location: string | null; response_note: string | null; created_at: string;
}
export interface Recipient { user_id: string; first_name: string; last_name: string; avatar_path: string | null; kind: string; scope_label: string }
export const MEETING_STATUS: Record<string, [string, 'warn' | 'ok' | 'bad' | 'neutral' | 'info']> = {
  requested: ['Solicitada', 'warn'], accepted: ['Confirmada', 'ok'], proposed: ['Nueva fecha propuesta', 'info'], rejected: ['Rechazada', 'bad'], done: ['Realizada', 'neutral'], cancelled: ['Cancelada', 'neutral'],
};
const KIND: Record<string, string> = { manager: 'Gerencia', branch_manager: 'Responsable de sucursal', hr: 'Recursos Humanos', other: 'Responsable' };

export function MeetingsPage() {
  const { ctx } = useAuth();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['my-meetings'], queryFn: async () => {
    const { data, error } = await supabase.from('meeting_requests').select('*').eq('requester_id', ctx!.user_id).order('created_at', { ascending: false });
    if (error) throw error; return data as Meeting[];
  } });
  const recipients = useQuery({ queryKey: ['recipients', 'meeting'], queryFn: () => rpc<Recipient[]>('allowed_recipients', { p_purpose: 'meeting' }) });
  const names = new Map(recipients.data?.map((r) => [r.user_id, r]));
  const act = useAction((v: { id: string; action: string }) => rpc('respond_meeting', { p_id: v.id, p_action: v.action }), { success: 'Listo', invalidate: [['my-meetings']] });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Reuniones" subtitle="Pedí una entrevista con gerencia, tu responsable o RR. HH." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Solicitar reunión</Button>} />
      {q.isLoading ? <LoadingList /> : !q.data?.length ? (
        <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="No tenés reuniones" description="Las solicitudes y su contenido solo los ven vos y la persona responsable." action={<Button onClick={() => setOpen(true)}>Solicitar reunión</Button>} />
      ) : (
        <ul className="space-y-3">
          {q.data.map((m) => {
            const r = names.get(m.responder_id);
            const [label, tone] = MEETING_STATUS[m.status]!;
            return (
              <Card as="li" key={m.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar path={r?.avatar_path} person={r} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><p className="font-semibold">{m.reason}</p><Badge tone={tone}>{label}</Badge></div>
                    <p className="text-[13px] text-ink-3">Con {r ? `${r.first_name} ${r.last_name}` : KIND[m.responder_kind]} · {m.modality === 'virtual' ? 'Virtual' : 'Presencial'}</p>
                    {m.scheduled_at && <p className="mt-2 flex items-center gap-1.5 text-sm font-medium"><CalendarCheck className="h-4 w-4 text-accent" />{fmtDateTime(m.scheduled_at)}{m.location && <span className="flex items-center gap-1 font-normal text-ink-3"><MapPin className="h-3.5 w-3.5" />{m.location}</span>}</p>}
                    {!m.scheduled_at && m.preferred_date && <p className="mt-1 text-sm text-ink-2">Preferencia: {fmtDate(m.preferred_date + 'T12:00:00')}{m.preferred_time ? ` · ${m.preferred_time.slice(0, 5)}` : ''}</p>}
                    {m.response_note && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">{m.response_note}</p>}
                    <div className="mt-3 flex gap-2">
                      {m.status === 'proposed' && <Button size="sm" onClick={() => act.mutate({ id: m.id, action: 'accept' })}>Aceptar fecha</Button>}
                      {['requested', 'proposed', 'accepted'].includes(m.status) && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: m.id, action: 'cancel' })}>Cancelar</Button>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
      {open && <NewMeeting recipients={recipients.data ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewMeeting({ recipients, onClose }: { recipients: Recipient[]; onClose: () => void }) {
  const [to, setTo] = useState(recipients[0]?.user_id ?? '');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [modality, setModality] = useState('in_person');
  const send = useAction(() => rpc('request_meeting', { p_responder: to, p_reason: reason.trim(), p_description: description.trim() || null, p_date: date || null, p_time: time || null, p_modality: modality }), {
    success: 'Solicitud enviada', invalidate: [['my-meetings']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Solicitar reunión"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!to || reason.trim().length < 3} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar</Button></>}>
      {recipients.length === 0 ? <EmptyState title="No hay responsables disponibles" description="Tu organización todavía no asignó responsables para reuniones." compact /> : (
        <div className="space-y-4">
          <Field label="Con quién"><Select value={to} onChange={(e) => setTo(e.target.value)}>{recipients.map((r) => <option key={r.user_id} value={r.user_id}>{r.first_name} {r.last_name} — {r.scope_label}</option>)}</Select></Field>
          <Field label="Motivo"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Ej.: hablar sobre mis horarios" /></Field>
          <Field label="Descripción" optional><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha preferida" optional><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Horario preferido" optional><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          <Field label="Modalidad">
            <div className="grid grid-cols-2 gap-2">
              {[['in_person', 'Presencial', <Building key="b" className="h-4 w-4" />], ['virtual', 'Virtual', <Video key="v" className="h-4 w-4" />]].map(([v, l, i]) => (
                <button key={v as string} type="button" onClick={() => setModality(v as string)} aria-pressed={modality === v}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${modality === v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2'}`}>{i}{l}</button>
              ))}
            </div>
          </Field>
        </div>
      )}
    </Sheet>
  );
}
