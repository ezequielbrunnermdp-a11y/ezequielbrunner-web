import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, AtSign, X, Globe2, Lock } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { rpc } from '@/lib/supabase';
import { useAction, useDebounced } from '@/lib/hooks';
import { compressImage, uploadPrivate, uid } from '@/lib/storage';
import { fullName } from '@/lib/format';
import { Avatar, Button, Card, Input, Sheet, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/Toast';

export interface Person { user_id: string; first_name: string; last_name: string; avatar_path: string | null; job_title?: string; branch_name?: string; relation?: string }

export function PeoplePicker({ open, onClose, onPick, title = 'Elegir persona', exclude = [] }: { open: boolean; onClose: () => void; onPick: (p: Person) => void; title?: string; exclude?: string[] }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const people = useQuery({ queryKey: ['people', dq], enabled: open, queryFn: () => rpc<Person[]>('people_search', { p_query: dq, p_limit: 30 }) });
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Input placeholder="Buscar por nombre, sucursal o puesto" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="mt-3 divide-y divide-line/70">
        {people.data?.filter((p) => !exclude.includes(p.user_id)).map((p) => (
          <li key={p.user_id}>
            <button onClick={() => { onPick(p); onClose(); }} className="flex w-full items-center gap-3 py-2.5 text-left">
              <Avatar path={p.avatar_path} person={p} size={36} />
              <div className="min-w-0"><p className="truncate text-sm font-medium">{fullName(p)}</p><p className="truncate text-xs text-ink-3">{p.job_title} · {p.branch_name}</p></div>
            </button>
          </li>
        ))}
        {people.data?.length === 0 && <li className="py-6 text-center text-sm text-ink-3">Sin resultados</li>}
      </ul>
    </Sheet>
  );
}

export function Composer({ groupId, onPosted }: { groupId?: string; onPosted?: () => void }) {
  const { ctx } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'community' | 'friends'>('community');
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [mentions, setMentions] = useState<Person[]>([]);
  const [picker, setPicker] = useState(false);
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const post = useAction(async () => {
    const org = ctx!.organization!.id;
    const paths: string[] = [];
    for (const f of files) {
      const blob = await compressImage(f.file);
      paths.push(await uploadPrivate('media', `org/${org}/u/${ctx!.user_id}/${uid()}.jpg`, blob, 'image/jpeg'));
    }
    return rpc<string>('create_post', {
      p_body: body.trim(), p_visibility: visibility, p_media_paths: paths, p_group_id: groupId ?? null, p_mentions: mentions.map((m) => m.user_id),
    });
  }, {
    success: 'Publicado', invalidate: [['feed']],
    onDone: () => { setBody(''); setFiles([]); setMentions([]); setFocused(false); onPosted?.(); },
  });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).slice(0, 4 - files.length).filter((f) => f.type.startsWith('image/'));
    if (next.length < (list.length ?? 0)) toast('Solo se admiten hasta 4 imágenes', 'info');
    setFiles((x) => [...x, ...next.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const expanded = focused || body.length > 0 || files.length > 0;

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Avatar path={ctx?.profile?.avatar_path} person={ctx?.profile} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} onFocus={() => setFocused(true)} maxLength={5000}
          placeholder={groupId ? 'Escribí algo para el grupo…' : '¿Qué querés compartir con el equipo?'} aria-label="Nueva publicación"
          className={expanded ? 'min-h-[96px] border-transparent bg-surface-2 focus:bg-surface' : 'min-h-[44px] h-11 resize-none border-transparent bg-surface-2 py-2.5'} />
      </div>
      {files.length > 0 && (
        <div className="mt-3 flex gap-2 pl-[52px]">
          {files.map((f, i) => (
            <div key={f.url} className="relative">
              <img src={f.url} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-1 text-bg" aria-label="Quitar imagen"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      {mentions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
          {mentions.map((m) => (
            <span key={m.user_id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              @{m.first_name} {m.last_name}
              <button onClick={() => setMentions((x) => x.filter((y) => y.user_id !== m.user_id))} aria-label="Quitar mención"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      {expanded && (
        <div className="mt-3 flex items-center gap-1 pl-[52px]">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <Button variant="ghost" size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={files.length >= 4}>Foto</Button>
          <Button variant="ghost" size="sm" icon={<AtSign className="h-4 w-4" />} onClick={() => setPicker(true)}>Mencionar</Button>
          {!groupId && (
            <label className="ml-1 flex items-center gap-1 text-[13px] text-ink-2">
              {visibility === 'community' ? <Globe2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <Select aria-label="Visibilidad" value={visibility} onChange={(e) => setVisibility(e.target.value as 'community' | 'friends')} className="h-8 w-auto border-0 bg-transparent pl-1 pr-7 text-[13px]">
                <option value="community">Comunidad</option><option value="friends">Solo amigos</option>
              </Select>
            </label>
          )}
          <Button className="ml-auto" size="sm" loading={post.isPending} disabled={!body.trim() && files.length === 0}
            onClick={() => post.mutate(undefined)}>Publicar</Button>
        </div>
      )}
      <PeoplePicker open={picker} onClose={() => setPicker(false)} title="Mencionar a un compañero" exclude={mentions.map((m) => m.user_id)} onPick={(p) => setMentions((x) => [...x, p])} />
    </Card>
  );
}
