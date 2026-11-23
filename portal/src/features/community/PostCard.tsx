import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, MoreHorizontal, Megaphone, Users, Lock, Flag, Pencil, Trash2, Pin, Send } from 'lucide-react';
import { supabase, rpc } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { relativeTime, fullName } from '@/lib/format';
import { Avatar, Badge, Button, Card, PrivateImage, Sheet, Textarea, Field, Select, cx } from '@/components/ui';

export interface FeedPost {
  id: string; author_id: string; author_first: string | null; author_last: string | null; author_avatar: string | null; author_position: string | null;
  kind: 'social' | 'institutional'; inst_type: string | null; visibility: string; group_id: string | null; group_name: string | null; branch_name: string | null;
  body: string; media_paths: string[]; pinned: boolean; created_at: string; edited_at: string | null; likes: number; comments: number; liked: boolean;
}

const INST: Record<string, string> = {
  announcement: 'Comunicado', birthday: 'Cumpleaños', event: 'Evento', new_hire: 'Nuevo ingreso', recognition: 'Reconocimiento',
  benefit: 'Beneficio', training: 'Capacitación', branch_news: 'Novedad de sucursal',
};

/** Resalta menciones @Nombre y vínculos de forma segura (sin HTML crudo: React escapa el texto). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline-offset-2 hover:underline">{p.replace(/^https?:\/\//, '').slice(0, 48)}</a>
        : <span key={i}>{p}</span>)}
    </p>
  );
}

export function PostCard({ post, detail }: { post: FeedPost; detail?: boolean }) {
  const { ctx, can } = useAuth();
  const qc = useQueryClient();
  const mine = post.author_id === ctx?.user_id;
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showComments, setShowComments] = useState(Boolean(detail));
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(Number(post.likes));
  const institutional = post.kind === 'institutional';

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    const { error } = next
      ? await supabase.from('post_reactions').insert({ post_id: post.id, user_id: ctx!.user_id })
      : await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', ctx!.user_id);
    if (error) { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
  };
  const del = useAction(() => rpc('delete_post', { p_id: post.id }), { success: 'Publicación eliminada', invalidate: [['feed'], ['pinned']] });
  const pin = useAction((until: string | null) => rpc('set_post_pin', { p_id: post.id, p_until: until }), { success: 'Listo', invalidate: [['feed'], ['pinned']] });

  const visIcon: ReactNode = post.visibility === 'friends' ? <Lock className="h-3 w-3" /> : post.visibility === 'group' ? <Users className="h-3 w-3" /> : null;

  return (
    <Card as="article" className={cx('animate-fade-in', institutional && 'border-accent/25')}>
      <div className="flex items-start gap-3 px-4 pt-4">
        {institutional
          ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"><Megaphone className="h-[18px] w-[18px]" /></span>
          : <Link to={`/perfil/${post.author_id}`}><Avatar path={post.author_avatar} person={{ first_name: post.author_first, last_name: post.author_last }} /></Link>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {institutional
              ? <span className="text-[15px] font-semibold">{ctx?.organization?.name ?? 'Empresa'}</span>
              : <Link to={`/perfil/${post.author_id}`} className="text-[15px] font-semibold hover:underline">{fullName({ first_name: post.author_first, last_name: post.author_last }) || 'Compañero'}</Link>}
            {institutional && post.inst_type && <Badge tone="accent">{INST[post.inst_type] ?? 'Institucional'}</Badge>}
            {post.pinned && <Badge><Pin className="h-3 w-3" />Fijado</Badge>}
          </div>
          <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
            {!institutional && post.author_position && <span>{post.author_position} ·</span>}
            {post.group_name && <span>{post.group_name} ·</span>}
            {post.branch_name && <span>{post.branch_name} ·</span>}
            <Link to={`/comunidad/post/${post.id}`} className="hover:underline">{relativeTime(post.created_at)}</Link>
            {post.edited_at && <span>· editado</span>}
            {visIcon}
          </p>
        </div>
        <button onClick={() => setMenu(true)} className="-mr-1 rounded-full p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Opciones de la publicación"><MoreHorizontal className="h-5 w-5" /></button>
      </div>

      {post.body && <div className="px-4 pt-3"><RichText text={post.body} /></div>}
      {post.media_paths.length > 0 && (
        <div className={cx('mt-3 grid gap-0.5', post.media_paths.length > 1 && 'grid-cols-2')}>
          {post.media_paths.slice(0, 4).map((m) => <PrivateImage key={m} path={m} className="aspect-[4/3] w-full object-cover" />)}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 px-2 pb-2">
        <button onClick={toggleLike} aria-pressed={liked} className={cx('flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-surface-2', liked ? 'text-bad' : 'text-ink-2')}>
          <Heart className={cx('h-[18px] w-[18px]', liked && 'fill-current')} />{likes > 0 ? likes : ''}<span className="sr-only">Me gusta</span>
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">
          <MessageSquare className="h-[18px] w-[18px]" />{Number(post.comments) > 0 ? post.comments : ''}<span className="sr-only">Comentarios</span>
        </button>
      </div>
      {showComments && <Comments postId={post.id} onCount={() => void qc.invalidateQueries({ queryKey: ['feed'] })} />}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Publicación">
        <div className="space-y-1">
          {mine && !institutional && <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { setMenu(false); setEditing(true); }}>Editar</MenuItem>}
          {(mine || (institutional && can('community.publish'))) && <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { if (confirm('¿Eliminar la publicación?')) del.mutate(undefined); setMenu(false); }}>Eliminar</MenuItem>}
          {institutional && can('community.publish') && (
            <MenuItem icon={<Pin className="h-4 w-4" />} onClick={() => { pin.mutate(post.pinned ? null : new Date(Date.now() + 7 * 864e5).toISOString()); setMenu(false); }}>
              {post.pinned ? 'Desfijar del inicio' : 'Fijar en el inicio por 7 días'}
            </MenuItem>
          )}
          {!mine && <MenuItem icon={<Flag className="h-4 w-4" />} onClick={() => { setMenu(false); setReporting(true); }}>Denunciar contenido</MenuItem>}
        </div>
      </Sheet>
      {editing && <EditPost post={post} onClose={() => setEditing(false)} />}
      {reporting && <ReportSheet entity="post" entityId={post.id} onClose={() => setReporting(false)} />}
    </Card>
  );
}

function MenuItem({ children, icon, onClick, danger }: { children: ReactNode; icon: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-surface-2', danger && 'text-bad')}>{icon}{children}</button>;
}

function EditPost({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const [body, setBody] = useState(post.body);
  const save = useAction(() => rpc('edit_post', { p_id: post.id, p_body: body }), { success: 'Publicación actualizada', invalidate: [['feed']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Editar publicación" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} disabled={!body.trim()} onClick={() => save.mutate(undefined)}>Guardar</Button></>}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={6} />
    </Sheet>
  );
}

export function ReportSheet({ entity, entityId, onClose, excerpt }: { entity: 'post' | 'comment' | 'message' | 'user'; entityId: string; onClose: () => void; excerpt?: string }) {
  const { ctx } = useAuth();
  const [reason, setReason] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const [share, setShare] = useState(Boolean(excerpt));
  const send = useAction(async () => {
    const { error } = await supabase.from('content_reports').insert({
      organization_id: ctx!.organization!.id, reporter_id: ctx!.user_id, entity, entity_id: entityId, reason, details: details || null,
      reporter_excerpt: share && excerpt ? excerpt.slice(0, 2000) : null,
    });
    if (error) throw error;
  }, { success: 'Denuncia enviada. Gracias por avisar.', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Denunciar" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar denuncia</Button></>}>
      <div className="space-y-4">
        <Field label="Motivo">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="harassment">Acoso o maltrato</option><option value="inappropriate">Contenido inapropiado</option>
            <option value="privacy">Expone datos privados</option><option value="spam">Spam</option><option value="other">Otro</option>
          </Select>
        </Field>
        <Field label="Detalle" optional><Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} /></Field>
        {entity === 'message' && excerpt && (
          <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-1" />
            <span>Compartir el texto de este mensaje con moderación. La gerencia <strong>no</strong> puede leer tus conversaciones: solo verá lo que elijas compartir.</span>
          </label>
        )}
      </div>
    </Sheet>
  );
}

interface Comment { id: string; author_id: string; first_name: string | null; last_name: string | null; avatar_path: string | null; body: string; created_at: string }

function Comments({ postId, onCount }: { postId: string; onCount: () => void }) {
  const { ctx } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const q = useQuery({ queryKey: ['comments', postId], queryFn: () => rpc<Comment[]>('post_comments_list', { p_post: postId }) });
  const add = useAction(async () => {
    const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: ctx!.user_id, body: body.trim() });
    if (error) throw error;
  }, { onDone: () => { setBody(''); void qc.invalidateQueries({ queryKey: ['comments', postId] }); onCount(); } });
  const del = useAction((id: string) => rpc('delete_comment', { p_id: id }), { invalidate: [['comments', postId]] });
  const [reporting, setReporting] = useState<string | null>(null);
  return (
    <div className="border-t border-line/70 px-4 py-3">
      <ul className="space-y-3">
        {q.data?.map((c) => (
          <li key={c.id} className="group flex gap-2.5">
            <Avatar path={c.avatar_path} person={c} size={30} />
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl bg-surface-2 px-3.5 py-2">
                <Link to={`/perfil/${c.author_id}`} className="text-[13px] font-semibold">{fullName(c) || 'Compañero'}</Link>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              <div className="mt-0.5 flex gap-3 px-3 text-2xs text-ink-3">
                <span>{relativeTime(c.created_at)}</span>
                {c.author_id === ctx?.user_id
                  ? <button onClick={() => del.mutate(c.id)} className="hover:text-bad">Eliminar</button>
                  : <button onClick={() => setReporting(c.id)} className="hover:text-ink">Denunciar</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(undefined); }}>
        <Avatar path={ctx?.profile?.avatar_path} person={ctx?.profile} size={30} />
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Escribí un comentario…" aria-label="Comentario"
          className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm focus:border-accent focus:outline-none" />
        <button type="submit" disabled={!body.trim() || add.isPending} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40" aria-label="Enviar comentario">
          <Send className="h-4 w-4" />
        </button>
      </form>
      {reporting && <ReportSheet entity="comment" entityId={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
