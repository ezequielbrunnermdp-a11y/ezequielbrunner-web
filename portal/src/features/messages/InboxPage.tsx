import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCirclePlus, Users, BellOff, MessageCircle, Search, Check } from 'lucide-react';
import { rpc } from '@/lib/supabase';
import { useAction } from '@/lib/hooks';
import { fullName, relativeTime } from '@/lib/format';
import { Avatar, Button, EmptyState, ErrorState, Field, Input, LoadingList, PageHeader, Sheet, cx } from '@/components/ui';
import { PeoplePicker, type Person } from '../community/Composer';
import { useAuth } from '@/auth/AuthProvider';

export interface Conv {
  id: string; kind: 'direct' | 'group'; title: string | null; other_user: string | null; other_first: string | null; other_last: string | null;
  other_avatar: string | null; last_message_at: string; last_body: string | null; last_sender: string | null; unread: number; muted: boolean; blocked: boolean;
}

export function InboxPage() {
  const nav = useNavigate();
  const { ctx } = useAuth();
  const [picker, setPicker] = useState(false);
  const [group, setGroup] = useState(false);
  const [filter, setFilter] = useState('');
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => rpc<Conv[]>('my_conversations'), refetchInterval: 30_000 });
  const start = useAction((u: string) => rpc<string>('start_direct_conversation', { p_user: u }), { onDone: (id) => nav(`/mensajes/${id}`) });
  const list = (q.data ?? []).filter((c) => !filter || (c.title ?? fullName({ first_name: c.other_first, last_name: c.other_last })).toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mensajes" subtitle="Conversaciones privadas con tus compañeros"
        actions={<>
          <Button variant="secondary" icon={<Users className="h-4 w-4" />} onClick={() => setGroup(true)}>Grupo</Button>
          <Button icon={<MessageCirclePlus className="h-4 w-4" />} onClick={() => setPicker(true)}>Nuevo</Button>
        </>} />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar conversación" className="pl-10" aria-label="Buscar conversación" />
      </div>
      {q.isLoading ? <LoadingList /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={<MessageCircle className="h-5 w-5" />} title="Sin conversaciones" description="Escribile a un compañero para empezar." action={<Button onClick={() => setPicker(true)}>Nuevo mensaje</Button>} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line/70 bg-surface shadow-card">
          {list.map((c) => {
            const name = c.kind === 'group' ? c.title ?? 'Grupo' : fullName({ first_name: c.other_first, last_name: c.other_last }) || 'Conversación';
            const unread = Number(c.unread) > 0;
            return (
              <li key={c.id} className="border-b border-line/60 last:border-0">
                <Link to={`/mensajes/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/60">
                  {c.kind === 'group' ? <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2"><Users className="h-5 w-5" /></span>
                    : <Avatar path={c.other_avatar} person={{ first_name: c.other_first, last_name: c.other_last }} size={48} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cx('truncate text-[15px]', unread ? 'font-semibold' : 'font-medium')}>{name}</p>
                      <span className={cx('shrink-0 text-xs', unread ? 'font-semibold text-accent' : 'text-ink-3')}>{c.last_body ? relativeTime(c.last_message_at) : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cx('min-w-0 flex-1 truncate text-sm', unread ? 'text-ink' : 'text-ink-3')}>
                        {c.last_sender === ctx?.user_id && <Check className="mr-1 inline h-3.5 w-3.5" />}{c.blocked ? 'Contacto bloqueado' : c.last_body ?? 'Sin mensajes todavía'}
                      </p>
                      {c.muted && <BellOff className="h-3.5 w-3.5 text-ink-3" aria-label="Silenciada" />}
                      {unread && <span className="rounded-full bg-accent px-1.5 text-2xs font-semibold leading-[18px] text-accent-ink">{c.unread}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <PeoplePicker open={picker} onClose={() => setPicker(false)} title="Nuevo mensaje" onPick={(p) => start.mutate(p.user_id)} />
      {group && <NewGroup onClose={() => setGroup(false)} />}
    </div>
  );
}

function NewGroup({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<Person[]>([]);
  const [picker, setPicker] = useState(false);
  const create = useAction(() => rpc<string>('create_group_conversation', { p_title: title.trim(), p_members: members.map((m) => m.user_id) }), { onDone: (id) => nav(`/mensajes/${id}`) });
  return (
    <Sheet open onClose={onClose} title="Nuevo grupo de chat"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!title.trim() || !members.length} loading={create.isPending} onClick={() => create.mutate(undefined)}>Crear</Button></>}>
      <div className="space-y-4">
        <Field label="Nombre del grupo"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></Field>
        <Field label="Participantes">
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => <span key={m.user_id} className="rounded-full bg-surface-2 px-3 py-1 text-sm">{fullName(m)}</span>)}
            <Button size="sm" variant="secondary" onClick={() => setPicker(true)}>Agregar</Button>
          </div>
        </Field>
      </div>
      <PeoplePicker open={picker} onClose={() => setPicker(false)} exclude={members.map((m) => m.user_id)} onPick={(p) => setMembers((x) => [...x, p])} />
    </Sheet>
  );
}
