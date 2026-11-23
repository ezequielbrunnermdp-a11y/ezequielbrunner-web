import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, Send, MoreVertical, BellOff, Bell, Ban, LogOut, Users, FileText, CheckCheck, Check, Trash2, Flag, Lock } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { ALLOWED_DOCS, compressImage, uploadPrivate, uid, useSignedUrl } from '@/lib/storage';
import { fmtDayLong, fmtTime, fullName, localDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { Avatar, Button, EmptyState, PrivateImage, Sheet, Spinner, cx } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ReportSheet } from '../community/PostCard';
import type { Conv } from './InboxPage';

interface Msg { id: string; conversation_id: string; sender_id: string; body: string | null; attachment_path: string | null; attachment_type: string | null; attachment_name: string | null; deleted_at: string | null; created_at: string; client_id: string | null; pending?: boolean; failed?: boolean }
interface Member { user_id: string; first_name: string; last_name: string; avatar_path: string | null; role: string }
const PAGE = 40;

export function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { ctx } = useAuth();
  const me = ctx!.user_id;
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [text, setText] = useState('');
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const [menu, setMenu] = useState(false);
  const [msgMenu, setMsgMenu] = useState<Msg | null>(null);
  const [report, setReport] = useState<Msg | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const conv = useQuery({ queryKey: ['conversations'], queryFn: () => rpc<Conv[]>('my_conversations'), select: (all) => all.find((c) => c.id === id) });
  const members = useQuery({ queryKey: ['conv-members', id], queryFn: () => rpc<Member[]>('conversation_members', { p_conv: id }) });
  const reads = useQuery({ queryKey: ['conv-reads', id], queryFn: () => rpc<{ user_id: string; last_read_at: string | null }[]>('conversation_read_state', { p_conv: id }), refetchInterval: 20_000 });
  const msgs = useInfiniteQuery({
    queryKey: ['messages', id],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('messages').select('*').eq('conversation_id', id!).order('created_at', { ascending: false }).limit(PAGE);
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return data as Msg[];
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.created_at : undefined),
  });

  // Tiempo real: Supabase Realtime aplica RLS, solo llegan mensajes de conversaciones propias.
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`conv:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        const m = payload.new as Msg;
        qc.setQueryData<{ pages: Msg[][]; pageParams: unknown[] }>(['messages', id], (old) => {
          if (!old) return old;
          const pages = old.pages.map((p) => p.filter((x) => x.id !== m.id));
          pages[0] = [m, ...(pages[0] ?? [])];
          return { ...old, pages };
        });
        if (payload.eventType === 'INSERT') {
          setOptimistic((o) => o.filter((x) => x.client_id !== m.client_id));
          if (m.sender_id !== me) void rpc('mark_conversation_read', { p_conv: id });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, me, qc]);

  useEffect(() => {
    if (!id) return;
    void rpc('mark_conversation_read', { p_conv: id }).then(() => {
      void qc.invalidateQueries({ queryKey: ['badge'] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [id, qc]);

  const all = useMemo(() => {
    const server = (msgs.data?.pages.flat() ?? []).slice().reverse();
    const ids = new Set(server.map((m) => m.client_id));
    return [...server, ...optimistic.filter((o) => !ids.has(o.client_id))];
  }, [msgs.data, optimistic]);

  useLayoutEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [all.length]);

  const sendMessage = async (payload: Partial<Msg>) => {
    const client_id = uid();
    const temp: Msg = { id: `tmp-${client_id}`, conversation_id: id!, sender_id: me, body: null, attachment_path: null, attachment_type: null, attachment_name: null,
      deleted_at: null, created_at: new Date().toISOString(), client_id, pending: true, ...payload };
    setOptimistic((o) => [...o, temp]);
    const { error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: me, client_id, body: payload.body ?? null,
      attachment_path: payload.attachment_path ?? null, attachment_type: payload.attachment_type ?? null, attachment_name: payload.attachment_name ?? null });
    if (error) {
      setOptimistic((o) => o.map((x) => (x.client_id === client_id ? { ...x, pending: false, failed: true } : x)));
      toast(errorMessage(error), 'bad');
    } else {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    void sendMessage({ body });
  };
  const attach = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const isImg = file.type.startsWith('image/');
      if (!isImg && !ALLOWED_DOCS.includes(file.type)) throw new Error('Solo se permiten imágenes y PDF');
      if (file.size > 15 * 1024 * 1024) throw new Error('El archivo supera 15 MB');
      const blob = isImg ? await compressImage(file) : file;
      const ext = isImg ? 'jpg' : 'pdf';
      const path = await uploadPrivate('chat', `conv/${id}/${uid()}.${ext}`, blob, isImg ? 'image/jpeg' : file.type);
      await sendMessage({ attachment_path: path, attachment_type: isImg ? 'image' : 'document', attachment_name: file.name.slice(0, 120), body: null });
    } catch (e) { toast(errorMessage(e), 'bad'); } finally { setUploading(false); }
  };

  const mute = useAction((until: string | null) => rpc('mute_conversation', { p_conv: id, p_until: until }), { success: 'Listo', invalidate: [['conversations']] });
  const block = useAction(() => rpc('block_user', { p_user: conv.data?.other_user }), { success: 'Contacto bloqueado', invalidate: [['conversations']] });
  const unblock = useAction(() => rpc('unblock_user', { p_user: conv.data?.other_user }), { success: 'Contacto desbloqueado', invalidate: [['conversations']] });
  const leave = useAction(() => rpc('leave_conversation', { p_conv: id }), { onDone: () => nav('/mensajes'), invalidate: [['conversations']] });
  const del = useAction((mid: string) => rpc('delete_message', { p_id: mid }), { invalidate: [['messages', id]] });

  const c = conv.data;
  const isGroup = c?.kind === 'group';
  const title = isGroup ? c?.title : fullName({ first_name: c?.other_first, last_name: c?.other_last });
  const memberMap = new Map(members.data?.map((m) => [m.user_id, m]));
  const othersRead = reads.data ?? [];
  const seenBy = (m: Msg) => othersRead.some((r) => r.last_read_at && r.last_read_at >= m.created_at);

  if (msgs.isError) return <EmptyState title="Conversación no disponible" description="No tenés acceso o fue eliminada." action={<Link to="/mensajes"><Button variant="secondary">Volver</Button></Link>} />;

  let lastDay = '';
  return (
    <div className="-mx-4 -mb-28 -mt-5 flex h-[calc(100dvh-3.5rem-4rem-env(safe-area-inset-bottom))] flex-col lg:mx-0 lg:-mb-12 lg:-mt-8 lg:h-[calc(100dvh-3.5rem)]">
      <div className="flex items-center gap-3 border-b border-line/70 bg-surface px-3 py-2.5 lg:rounded-none">
        <Link to="/mensajes" className="rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></Link>
        {isGroup ? <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2"><Users className="h-5 w-5 text-ink-2" /></span>
          : <Avatar path={c?.other_avatar} person={{ first_name: c?.other_first, last_name: c?.other_last }} />}
        <div className="min-w-0 flex-1">
          {isGroup ? <p className="truncate font-semibold">{title}</p> : <Link to={`/perfil/${c?.other_user}`} className="block truncate font-semibold">{title || '…'}</Link>}
          <p className="truncate text-xs text-ink-3">{isGroup ? `${members.data?.length ?? '…'} participantes` : <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Privado: solo ustedes pueden leerlo</span>}</p>
        </div>
        <button onClick={() => setMenu(true)} className="rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label="Opciones"><MoreVertical className="h-5 w-5" /></button>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto bg-bg px-3 py-4 sm:px-6" aria-live="polite">
        {msgs.hasNextPage && <div className="mb-3 text-center"><Button size="sm" variant="ghost" loading={msgs.isFetchingNextPage} onClick={() => void msgs.fetchNextPage()}>Ver mensajes anteriores</Button></div>}
        {msgs.isLoading && <div className="flex justify-center py-10"><Spinner /></div>}
        {!msgs.isLoading && all.length === 0 && <p className="py-10 text-center text-sm text-ink-3">Escribí el primer mensaje.</p>}
        <div className="space-y-1">
          {all.map((m, i) => {
            const mine = m.sender_id === me;
            const day = localDate(m.created_at);
            const showDay = day !== lastDay; lastDay = day;
            const prev = all[i - 1];
            const grouped = prev && prev.sender_id === m.sender_id && !showDay && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60_000;
            const sender = memberMap.get(m.sender_id);
            return (
              <div key={m.id}>
                {showDay && <div className="my-4 text-center"><span className="rounded-full bg-surface-2 px-3 py-1 text-2xs font-medium capitalize text-ink-3">{fmtDayLong(m.created_at)}</span></div>}
                <div className={cx('flex', mine ? 'justify-end' : 'justify-start', !grouped && 'mt-2.5')}>
                  <button type="button" onClick={() => !m.deleted_at && !m.pending && setMsgMenu(m)}
                    className={cx('max-w-[82%] rounded-[18px] px-3.5 py-2 text-left text-[15px] leading-snug shadow-[0_1px_0_rgb(0_0_0/0.03)] sm:max-w-[65%]',
                      mine ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-surface text-ink',
                      m.deleted_at && 'italic opacity-60', m.failed && 'ring-2 ring-bad')}>
                    {isGroup && !mine && !grouped && <p className="mb-0.5 text-xs font-semibold text-accent">{sender ? fullName(sender) : 'Participante'}</p>}
                    {m.deleted_at ? 'Mensaje eliminado' : (
                      <>
                        {m.attachment_type === 'image' && m.attachment_path && <PrivateImage bucket="chat" path={m.attachment_path} className="mb-1 max-h-72 rounded-xl object-cover" />}
                        {m.attachment_type === 'document' && m.attachment_path && <ChatDoc path={m.attachment_path} name={m.attachment_name} mine={mine} />}
                        {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
                      </>
                    )}
                    <span className={cx('ml-2 inline-flex items-center gap-0.5 align-bottom text-[10.5px]', mine ? 'text-accent-ink/70' : 'text-ink-3')}>
                      {m.failed ? 'No enviado' : fmtTime(m.created_at)}
                      {mine && !m.deleted_at && !m.failed && (m.pending ? <Check className="h-3 w-3 opacity-60" /> : seenBy(m) ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3 w-3" />)}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottom} />
      </div>

      {c?.blocked ? (
        <div className="border-t border-line/70 bg-surface px-4 py-4 text-center text-sm text-ink-3">Bloqueaste este contacto. <button className="font-medium text-accent" onClick={() => unblock.mutate(undefined)}>Desbloquear</button></div>
      ) : (
        <form onSubmit={submit} className="pb-safe flex items-end gap-2 border-t border-line/70 bg-surface px-3 py-2.5">
          <input ref={fileRef} type="file" hidden accept="image/*,application/pdf" onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Adjuntar imagen o PDF">
            {uploading ? <Spinner className="h-4 w-4" /> : <Paperclip className="h-5 w-5" />}
          </button>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder="Mensaje" aria-label="Mensaje"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); submit(e as unknown as FormEvent); } }}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-[20px] border border-line bg-bg px-4 py-2.5 text-[15px] focus:border-accent focus:outline-none" />
          <button type="submit" disabled={!text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-40" aria-label="Enviar">
            <Send className="h-[18px] w-[18px]" />
          </button>
        </form>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={title || 'Conversación'}>
        {isGroup && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Participantes</p>
            <ul className="space-y-2">{members.data?.map((m) => <li key={m.user_id} className="flex items-center gap-2.5"><Avatar path={m.avatar_path} person={m} size={30} /><span className="text-sm">{fullName(m)}</span></li>)}</ul>
          </div>
        )}
        <div className="space-y-1">
          {c?.muted
            ? <button onClick={() => { mute.mutate(null); setMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><Bell className="h-4 w-4" />Reactivar notificaciones</button>
            : <>
                <button onClick={() => { mute.mutate(new Date(Date.now() + 8 * 3600e3).toISOString()); setMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><BellOff className="h-4 w-4" />Silenciar por 8 horas</button>
                <button onClick={() => { mute.mutate(new Date(Date.now() + 365 * 864e5).toISOString()); setMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><BellOff className="h-4 w-4" />Silenciar siempre</button>
              </>}
          {isGroup
            ? <button onClick={() => { if (confirm('¿Salir del grupo?')) leave.mutate(undefined); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-bad hover:bg-bad-soft"><LogOut className="h-4 w-4" />Salir del grupo</button>
            : <button onClick={() => { setMenu(false); if (confirm('No podrán escribirse ni verse en la comunidad. ¿Bloquear?')) block.mutate(undefined); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-bad hover:bg-bad-soft"><Ban className="h-4 w-4" />Bloquear contacto</button>}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">Estas conversaciones no son visibles para la gerencia ni para la administración desde la plataforma. Se guardan en el servidor con cifrado en tránsito y en reposo del proveedor; <strong>no</strong> tienen cifrado de extremo a extremo.</p>
      </Sheet>
      <Sheet open={Boolean(msgMenu)} onClose={() => setMsgMenu(null)} title="Mensaje">
        <div className="space-y-1">
          {msgMenu?.sender_id === me
            ? <button onClick={() => { del.mutate(msgMenu.id); setMsgMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-bad hover:bg-bad-soft"><Trash2 className="h-4 w-4" />Eliminar para todos</button>
            : <button onClick={() => { setReport(msgMenu); setMsgMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><Flag className="h-4 w-4" />Denunciar mensaje</button>}
          {msgMenu?.body && <button onClick={() => { void navigator.clipboard?.writeText(msgMenu.body!); setMsgMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">Copiar texto</button>}
        </div>
      </Sheet>
      {report && <ReportSheet entity="message" entityId={report.id} excerpt={report.body ?? undefined} onClose={() => setReport(null)} />}
    </div>
  );
}

function ChatDoc({ path, name, mine }: { path: string; name: string | null; mine: boolean }) {
  const { data } = useSignedUrl('chat', path, 600);
  return (
    <a href={data} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      className={cx('mb-1 flex items-center gap-2 rounded-xl px-3 py-2', mine ? 'bg-black/10' : 'bg-surface-2')}>
      <FileText className="h-5 w-5 shrink-0" /><span className="truncate text-sm font-medium">{name || 'Documento'}</span>
    </a>
  );
}
