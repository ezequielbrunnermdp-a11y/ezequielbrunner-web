import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift, PartyPopper, Lightbulb, MapPin, Plus, BarChart2, Info } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, Notice, PageHeader, Segmented, Sheet, Textarea, cx } from '@/components/ui';

interface Benefit { id: string; title: string; description: string | null; provider: string | null; how_to_use: string | null; valid_until: string | null }
export function BenefitsPage() {
  const q = useQuery({ queryKey: ['benefits'], queryFn: async () => {
    const { data, error } = await supabase.from('benefits').select('*').eq('active', true).order('created_at', { ascending: false });
    if (error) throw error; return data as Benefit[];
  } });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Beneficios" subtitle="Ventajas disponibles para el equipo" />
      {q.isLoading ? <LoadingList /> : !q.data?.length ? <EmptyState icon={<Gift className="h-5 w-5" />} title="Todavía no hay beneficios publicados" compact /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((b) => (
            <Card key={b.id} className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Gift className="h-5 w-5" /></span>
              <p className="mt-3 font-semibold">{b.title}</p>
              {b.provider && <p className="text-xs text-ink-3">{b.provider}</p>}
              {b.description && <p className="mt-2 text-sm text-ink-2">{b.description}</p>}
              {b.how_to_use && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]"><span className="font-medium">Cómo usarlo:</span> {b.how_to_use}</p>}
              {b.valid_until && <p className="mt-2 text-xs text-ink-3">Vigente hasta {fmtDate(b.valid_until + 'T12:00:00')}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface Event { id: string; title: string; description: string | null; kind: string; starts_at: string; ends_at: string | null; location: string | null }
interface Poll { id: string; question: string; options: string[]; closes_at: string | null }
export function EventsPage() {
  const { ctx } = useAuth();
  const [tab, setTab] = useState<'events' | 'polls'>('events');
  const events = useQuery({ queryKey: ['events'], queryFn: async () => {
    const { data, error } = await supabase.from('events').select('*').gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at');
    if (error) throw error; return data as Event[];
  } });
  const rsvps = useQuery({ queryKey: ['rsvps'], queryFn: async () => {
    const { data } = await supabase.from('event_rsvps').select('event_id, user_id, response');
    return data ?? [];
  } });
  const polls = useQuery({ queryKey: ['polls'], queryFn: async () => { const { data, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false }); if (error) throw error; return data as Poll[]; } });
  const rsvp = useAction(async (v: { id: string; r: string }) => {
    const { error } = await supabase.from('event_rsvps').upsert({ event_id: v.id, user_id: ctx!.user_id, response: v.r, updated_at: new Date().toISOString() });
    if (error) throw error;
  }, { invalidate: [['rsvps']], success: 'Respuesta guardada' });
  const KIND: Record<string, string> = { social: 'Social', meeting: 'Reunión', training: 'Capacitación', celebration: 'Celebración' };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Eventos y encuestas" />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'events', label: 'Eventos' }, { value: 'polls', label: 'Encuestas' }]} />
      {tab === 'events' ? (events.isLoading ? <LoadingList /> : !events.data?.length ? <EmptyState icon={<PartyPopper className="h-5 w-5" />} title="No hay eventos próximos" compact /> : (
        <ul className="space-y-3">
          {events.data.map((e) => {
            const mine = rsvps.data?.find((r) => r.event_id === e.id && r.user_id === ctx?.user_id)?.response;
            const going = rsvps.data?.filter((r) => r.event_id === e.id && r.response === 'going').length ?? 0;
            return (
              <Card as="li" key={e.id} className="p-4">
                <div className="flex gap-4">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-accent-soft py-2 text-accent">
                    <span className="text-2xs font-semibold uppercase">{new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(e.starts_at))}</span>
                    <span className="text-xl font-semibold leading-none">{new Intl.DateTimeFormat('es-AR', { day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(e.starts_at))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><p className="font-semibold">{e.title}</p><Badge>{KIND[e.kind]}</Badge></div>
                    <p className="text-[13px] text-ink-3">{fmtDateTime(e.starts_at)}{e.location && <> · <MapPin className="inline h-3 w-3" /> {e.location}</>}</p>
                    {e.description && <p className="mt-2 text-sm text-ink-2">{e.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {[['going', 'Voy'], ['maybe', 'Tal vez'], ['not_going', 'No voy']].map(([v, l]) => (
                        <button key={v} onClick={() => rsvp.mutate({ id: e.id, r: v! })} aria-pressed={mine === v}
                          className={cx('h-8 rounded-lg border px-3 text-[13px] font-medium', mine === v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2')}>{l}</button>
                      ))}
                      <span className="text-xs text-ink-3">{going} confirmados</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )) : polls.isLoading ? <LoadingList /> : !polls.data?.length ? <EmptyState icon={<BarChart2 className="h-5 w-5" />} title="No hay encuestas" compact /> : (
        <div className="space-y-3">
          <Notice tone="info" icon={<Info className="h-4 w-4" />}>Los resultados se muestran agregados y ningún rol de la aplicación ve votos individuales. Los votos no son anónimos a nivel técnico: se registra quién votó para evitar duplicados.</Notice>
          {polls.data.map((p) => <PollCard key={p.id} poll={p} />)}
        </div>
      )}
    </div>
  );
}

function PollCard({ poll }: { poll: Poll }) {
  const r = useQuery({ queryKey: ['poll', poll.id], queryFn: () => rpc<{ total: number; my_vote: number | null; counts: number[] }>('poll_results', { p_poll: poll.id }) });
  const vote = useAction((i: number) => rpc('vote_poll', { p_poll: poll.id, p_option: i }), { invalidate: [['poll', poll.id]] });
  const closed = poll.closes_at ? new Date(poll.closes_at) < new Date() : false;
  const total = r.data?.total ?? 0;
  return (
    <Card className="p-5">
      <p className="font-semibold">{poll.question}</p>
      <p className="text-xs text-ink-3">{total} votos{poll.closes_at && ` · ${closed ? 'Cerró' : 'Cierra'} ${fmtDateTime(poll.closes_at)}`}</p>
      <div className="mt-3 space-y-2">
        {poll.options.map((o, i) => {
          const n = r.data?.counts?.[i] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const mine = r.data?.my_vote === i;
          return (
            <button key={i} disabled={closed} onClick={() => vote.mutate(i)} className={cx('relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm', mine ? 'border-accent' : 'border-line')}>
              {r.data?.my_vote != null && <span className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${pct}%` }} />}
              <span className="relative flex justify-between"><span className={mine ? 'font-semibold' : ''}>{o}</span>{r.data?.my_vote != null && <span className="tabular text-ink-3">{pct}%</span>}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

interface Sugg { id: string; title: string; body: string; status: string; response: string | null; created_at: string }
export function SuggestionsPage() {
  const { ctx } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const q = useQuery({ queryKey: ['my-suggestions'], queryFn: async () => {
    const { data, error } = await supabase.from('suggestions').select('*').eq('user_id', ctx!.user_id).order('created_at', { ascending: false });
    if (error) throw error; return data as Sugg[];
  } });
  const send = useAction(async () => {
    const { error } = await supabase.from('suggestions').insert({ organization_id: ctx!.organization!.id, user_id: ctx!.user_id, title: title.trim(), body: body.trim() });
    if (error) throw error;
  }, { success: '¡Gracias por tu idea!', invalidate: [['my-suggestions']], onDone: () => { setOpen(false); setTitle(''); setBody(''); } });
  const ST: Record<string, string> = { received: 'Recibida', under_review: 'En análisis', planned: 'Planificada', done: 'Implementada', declined: 'Descartada' };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Sugerencias" subtitle="Ideas para mejorar el trabajo y la atención" actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Nueva idea</Button>} />
      <div className="mb-4"><Notice tone="info" icon={<Lightbulb className="h-4 w-4" />}>Las sugerencias se envían con tu nombre. No ofrecemos anonimato porque no podríamos garantizarlo técnicamente.</Notice></div>
      {q.isLoading ? <LoadingList /> : !q.data?.length ? <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="Todavía no enviaste sugerencias" compact /> : (
        <ul className="space-y-2.5">{q.data.map((s) => (
          <Card as="li" key={s.id} className="p-4">
            <div className="flex justify-between gap-2"><p className="font-semibold">{s.title}</p><Badge>{ST[s.status]}</Badge></div>
            <p className="mt-1 text-sm text-ink-2">{s.body}</p>
            {s.response && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]"><span className="font-medium">Respuesta:</span> {s.response}</p>}
          </Card>
        ))}</ul>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Nueva sugerencia"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={title.trim().length < 3 || body.trim().length < 5} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar</Button></>}>
        <div className="space-y-4">
          <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} /></Field>
          <Field label="Tu idea"><Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={6} /></Field>
        </div>
      </Sheet>
    </div>
  );
}
