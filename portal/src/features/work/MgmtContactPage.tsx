import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Plus, ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDateTime, relativeTime } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingList, PageHeader, Select, Sheet, Textarea, cx } from '@/components/ui';
import type { Recipient } from './MeetingsPage';

export interface Ticket { id: string; number: number; sender_id: string; recipient_id: string; category_id: string; subject: string; priority: string; status: string; created_at: string; updated_at: string }
export const TICKET_STATUS: Record<string, [string, 'warn' | 'ok' | 'info' | 'neutral']> = {
  received: ['Recibido', 'warn'], in_review: ['En revisión', 'info'], answered: ['Respondido', 'ok'], resolved: ['Resuelto', 'ok'], closed: ['Cerrado', 'neutral'],
};
export const PRIORITY: Record<string, string> = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };

export function MgmtContactPage() {
  const { ctx } = useAuth();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['my-tickets'], queryFn: async () => {
    const { data, error } = await supabase.from('mgmt_tickets').select('*').eq('sender_id', ctx!.user_id).order('updated_at', { ascending: false });
    if (error) throw error; return data as Ticket[];
  } });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Hablar con gerencia" subtitle="Canal institucional, separado de tus mensajes personales." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Nuevo mensaje</Button>} />
      <Card className="mb-4 flex gap-3 p-4 text-[13px] text-ink-2"><ShieldCheck className="h-5 w-5 shrink-0 text-accent" />Solo vos y la persona destinataria pueden leer esta conversación. Cada consulta tiene un número para su seguimiento.</Card>
      {q.isLoading ? <LoadingList /> : !q.data?.length ? (
        <EmptyState icon={<Inbox className="h-5 w-5" />} title="No enviaste consultas" action={<Button onClick={() => setOpen(true)}>Escribir a gerencia</Button>} />
      ) : (
        <ul className="space-y-2.5">
          {q.data.map((t) => <TicketRow key={t.id} t={t} to={`/gerencia-contacto/${t.id}`} />)}
        </ul>
      )}
      {open && <NewTicket onClose={() => setOpen(false)} />}
    </div>
  );
}

export function TicketRow({ t, to }: { t: Ticket; to: string }) {
  const [label, tone] = TICKET_STATUS[t.status]!;
  return (
    <Card as="li" className="transition-colors hover:bg-surface-2/50">
      <Link to={to} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate font-semibold">{t.subject}</p><Badge tone={tone}>{label}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-3">#{t.number} · {relativeTime(t.updated_at)}{t.priority !== 'normal' && ` · Prioridad ${PRIORITY[t.priority]?.toLowerCase()}`}</p>
      </Link>
    </Card>
  );
}

function NewTicket({ onClose }: { onClose: () => void }) {
  const { ctx } = useAuth();
  const cats = useQuery({ queryKey: ['mgmt-categories'], queryFn: async () => {
    const { data, error } = await supabase.from('mgmt_categories').select('*').eq('organization_id', ctx!.organization!.id).eq('active', true).order('sort');
    if (error) throw error; return data as { id: string; name: string; hr_only: boolean }[];
  } });
  const recipients = useQuery({ queryKey: ['recipients', 'ticket'], queryFn: () => rpc<Recipient[]>('allowed_recipients', { p_purpose: 'ticket' }) });
  const [cat, setCat] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const category = cats.data?.find((c) => c.id === cat);
  const allowed = (recipients.data ?? []).filter((r) => !category?.hr_only || r.kind === 'hr');
  const send = useAction(() => rpc<string>('create_mgmt_ticket', { p_recipient: to, p_category: cat, p_subject: subject.trim(), p_body: body.trim(), p_priority: priority }), {
    success: 'Mensaje enviado', invalidate: [['my-tickets']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Escribir a gerencia"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!cat || !to || subject.trim().length < 3 || !body.trim()} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar</Button></>}>
      <div className="space-y-4">
        <Field label="Categoría"><Select value={cat} onChange={(e) => { setCat(e.target.value); setTo(''); }}><option value="">Elegí una categoría</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Destinatario" hint={category?.hr_only ? 'Esta categoría se dirige solo a Recursos Humanos.' : undefined}>
          <Select value={to} onChange={(e) => setTo(e.target.value)} disabled={!cat}><option value="">Elegí a quién</option>{allowed.map((r) => <option key={r.user_id} value={r.user_id}>{r.first_name} {r.last_name} — {r.scope_label}</option>)}</Select>
        </Field>
        <Field label="Asunto"><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} /></Field>
        <Field label="Mensaje"><Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5} /></Field>
        <Field label="Prioridad"><Select value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      </div>
    </Sheet>
  );
}

interface TMsg { id: string; author_id: string; body: string; created_at: string }

/** Hilo de una consulta institucional (lo usan empleado y gerencia). */
export function TicketThreadPage({ manager }: { manager?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { ctx } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const t = useQuery({ queryKey: ['ticket', id], queryFn: async () => { const { data, error } = await supabase.from('mgmt_tickets').select('*').eq('id', id!).maybeSingle(); if (error) throw error; return data as Ticket | null; } });
  const msgs = useQuery({ queryKey: ['ticket-msgs', id], queryFn: async () => {
    const { data, error } = await supabase.from('mgmt_ticket_messages').select('*').eq('ticket_id', id!).order('created_at');
    if (error) throw error; return data as TMsg[];
  } });
  const people = useQuery({ queryKey: ['ticket-people', id], enabled: Boolean(t.data), queryFn: async () => {
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', [t.data!.sender_id, t.data!.recipient_id]);
    return new Map((data ?? []).map((p) => [p.user_id as string, `${p.first_name} ${p.last_name}`]));
  } });
  useEffect(() => {
    const ch = supabase.channel(`ticket:${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mgmt_ticket_messages', filter: `ticket_id=eq.${id}` },
      () => void qc.invalidateQueries({ queryKey: ['ticket-msgs', id] })).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, qc]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.data?.length]);
  const reply = useAction(() => rpc('reply_mgmt_ticket', { p_ticket: id, p_body: body.trim() }), { invalidate: [['ticket-msgs', id], ['ticket', id]], onDone: () => setBody('') });
  const setStatus = useAction((v: { status: string; priority?: string }) => rpc('set_mgmt_ticket_status', { p_ticket: id, p_status: v.status, p_priority: v.priority ?? null }), { success: 'Estado actualizado', invalidate: [['ticket', id], ['mgmt-inbox'], ['my-tickets']] });

  if (t.isLoading) return <LoadingList rows={2} />;
  if (t.isError) return <ErrorState error={t.error} />;
  if (!t.data) return <EmptyState title="Consulta no disponible" />;
  const tk = t.data;
  const isRecipient = tk.recipient_id === ctx?.user_id;
  const [label, tone] = TICKET_STATUS[tk.status]!;
  return (
    <div className="mx-auto max-w-2xl">
      <Link to={manager ? '/gerencia/comunicaciones' : '/gerencia-contacto'} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="h-4 w-4" />Volver</Link>
      <Card className="mb-4 p-5">
        <div className="flex items-start justify-between gap-3"><h1 className="text-xl font-semibold tracking-tight">{tk.subject}</h1><Badge tone={tone}>{label}</Badge></div>
        <p className="mt-1 text-[13px] text-ink-3">#{tk.number} · {fmtDateTime(tk.created_at)} · De {people.data?.get(tk.sender_id) ?? '…'} para {people.data?.get(tk.recipient_id) ?? '…'} · Prioridad {PRIORITY[tk.priority]?.toLowerCase()}</p>
        {isRecipient && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
            <Select aria-label="Estado" value={tk.status} onChange={(e) => setStatus.mutate({ status: e.target.value })} className="h-9 text-sm sm:w-44">
              {Object.entries(TICKET_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select aria-label="Prioridad" value={tk.priority} onChange={(e) => setStatus.mutate({ status: tk.status, priority: e.target.value })} className="h-9 text-sm sm:w-36">
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        )}
        {!isRecipient && tk.status !== 'closed' && <button className="mt-3 text-xs font-medium text-ink-3 hover:text-ink" onClick={() => setStatus.mutate({ status: 'closed' })}>Cerrar consulta</button>}
      </Card>
      <ul className="space-y-3">
        {msgs.data?.map((m) => {
          const mine = m.author_id === ctx?.user_id;
          return (
            <li key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[85%] rounded-2xl px-4 py-3', mine ? 'bg-accent-soft' : 'bg-surface border border-line/70')}>
                <p className="text-xs font-semibold text-ink-2">{people.data?.get(m.author_id) ?? ''}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[15px]">{m.body}</p>
                <p className="mt-1 text-2xs text-ink-3">{fmtDateTime(m.created_at)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={end} />
      {tk.status !== 'closed' ? (
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) reply.mutate(undefined); }} className="mt-5 flex items-end gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Escribí tu respuesta" className="min-h-[52px]" aria-label="Respuesta" />
          <Button type="submit" icon={<Send className="h-4 w-4" />} loading={reply.isPending} disabled={!body.trim()} aria-label="Enviar respuesta" />
        </form>
      ) : <p className="mt-5 text-center text-sm text-ink-3">La consulta está cerrada.</p>}
    </div>
  );
}
