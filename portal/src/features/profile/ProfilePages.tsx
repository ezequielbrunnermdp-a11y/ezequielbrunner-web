import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil, MessageCircle, MapPin, Briefcase, Cake, Ban, UserMinus, Camera, CalendarClock, MoreHorizontal, Flag } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { compressImage, uploadPrivate, uid } from '@/lib/storage';
import { fmtDate, fullName } from '@/lib/format';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingList, PageHeader, Sheet, Switch, Textarea } from '@/components/ui';
import { Feed, FriendButton } from '../community/CommunityPage';
import { ReportSheet } from '../community/PostCard';

interface Card_ {
  user_id: string; first_name: string; last_name: string; avatar_path: string | null; bio: string | null; interests: string[];
  birthday: { month: number; day: number } | null; job_title: string; branch: string; brand: string; sector: string | null; hire_date: string | null;
  friends_count: number; mutual_friends: number; relation: string; pending_request_id: string | null;
}
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function ProfilePage() {
  const { id } = useParams();
  const { ctx } = useAuth();
  const nav = useNavigate();
  const userId = id ?? ctx?.user_id;
  const self = userId === ctx?.user_id;
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const q = useQuery({ queryKey: ['person', userId], queryFn: () => rpc<Card_>('person_card', { p_user: userId }) });
  const inv = [['person', userId], ['people']];
  const chat = useAction(() => rpc<string>('start_direct_conversation', { p_user: userId }), { onDone: (cid) => nav(`/mensajes/${cid}`) });
  const unfriend = useAction(() => rpc('remove_friend', { p_user: userId }), { success: 'Amistad eliminada', invalidate: inv });
  const block = useAction(() => rpc('block_user', { p_user: userId }), { success: 'Persona bloqueada', onDone: () => nav('/comunidad') });

  if (q.isLoading) return <LoadingList rows={2} />;
  if (q.isError) return <ErrorState error={q.error} />;
  if (!q.data) return <EmptyState title="Perfil no disponible" />;
  const p = q.data;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <Avatar path={p.avatar_path} person={p} size={84} />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-2xl font-semibold tracking-tight">{fullName(p)}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{p.job_title}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.branch}</span>
            </p>
            <p className="mt-1 text-[13px] text-ink-3">{p.brand}{p.sector ? ` · ${p.sector}` : ''}</p>
          </div>
          {!self && <button onClick={() => setMenu(true)} className="rounded-full p-2 text-ink-3 hover:bg-surface-2" aria-label="Más opciones"><MoreHorizontal className="h-5 w-5" /></button>}
        </div>
        {p.bio && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{p.bio}</p>}
        {p.interests?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{p.interests.map((i) => <Badge key={i}>{i}</Badge>)}</div>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-3">
          <span><strong className="text-ink">{p.friends_count}</strong> amigos</span>
          {!self && p.mutual_friends > 0 && <span><strong className="text-ink">{p.mutual_friends}</strong> en común</span>}
          {p.birthday && <span className="inline-flex items-center gap-1"><Cake className="h-3.5 w-3.5" />{p.birthday.day} de {MONTHS[p.birthday.month - 1]}</span>}
          {p.hire_date && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />En el equipo desde {fmtDate(p.hire_date)}</span>}
        </div>
        <div className="mt-5 flex gap-2">
          {self ? <Link to="/perfil/editar"><Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Editar perfil</Button></Link> : (
            <>
              <FriendButton person={p} size="md" />
              <Button variant="secondary" icon={<MessageCircle className="h-4 w-4" />} loading={chat.isPending} onClick={() => chat.mutate(undefined)}>Mensaje</Button>
            </>
          )}
        </div>
      </Card>
      <h2 className="px-1 text-sm font-semibold text-ink-2">Publicaciones</h2>
      <Feed authorId={userId} composer={false} />
      <Sheet open={menu} onClose={() => setMenu(false)} title={fullName(p)}>
        <div className="space-y-1">
          {p.relation === 'friend' && <button onClick={() => { setMenu(false); if (confirm('¿Eliminar de tus amigos?')) unfriend.mutate(undefined); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><UserMinus className="h-4 w-4" />Eliminar amistad</button>}
          <button onClick={() => { setMenu(false); setReport(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><Flag className="h-4 w-4" />Denunciar perfil</button>
          <button onClick={() => { setMenu(false); if (confirm('Al bloquear, dejarán de verse y de poder escribirse. ¿Continuar?')) block.mutate(undefined); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-bad hover:bg-bad-soft"><Ban className="h-4 w-4" />Bloquear</button>
        </div>
      </Sheet>
      {report && <ReportSheet entity="user" entityId={p.user_id} onClose={() => setReport(false)} />}
    </div>
  );
}

export function EditProfilePage() {
  const { ctx, refreshCtx } = useAuth();
  const nav = useNavigate();
  const p = ctx!.profile!;
  const [form, setForm] = useState({
    first_name: p.first_name, last_name: p.last_name, bio: p.bio ?? '', interests: p.interests.join(', '),
    show_birthday: p.show_birthday, birth_month: p.birth_month ?? '', birth_day: p.birth_day ?? '', show_hire_date: p.show_hire_date,
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = useAction(async () => {
    let avatar_path = p.avatar_path;
    if (avatar) {
      const blob = await compressImage(avatar, 600, 0.85);
      avatar_path = await uploadPrivate('media', `org/${ctx!.organization!.id}/u/${ctx!.user_id}/avatar-${uid()}.jpg`, blob, 'image/jpeg');
    }
    const { error } = await supabase.from('profiles').update({
      first_name: form.first_name.trim(), last_name: form.last_name.trim(), bio: form.bio.trim() || null,
      interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
      show_birthday: form.show_birthday, birth_month: form.birth_month ? Number(form.birth_month) : null, birth_day: form.birth_day ? Number(form.birth_day) : null,
      show_hire_date: form.show_hire_date, avatar_path,
    }).eq('user_id', ctx!.user_id);
    if (error) throw error;
    await refreshCtx();
  }, { success: 'Perfil actualizado', invalidate: [['person', ctx!.user_id]], onDone: () => nav('/perfil') });
  const preview = avatar ? URL.createObjectURL(avatar) : null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Editar perfil" subtitle="Lo que completes acá es voluntario y solo lo ve tu comunidad." />
      <Card className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          {preview ? <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" /> : <Avatar path={p.avatar_path} person={p} size={80} />}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Cambiar foto</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre"><Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={80} /></Field>
          <Field label="Apellido"><Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} /></Field>
        </div>
        <Field label="Sobre mí" optional hint={`${form.bio.length}/500`}><Textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} maxLength={500} /></Field>
        <Field label="Intereses" optional hint="Separados por comas, por ejemplo: café de especialidad, fútbol, música"><Input value={form.interests} onChange={(e) => set('interests', e.target.value)} /></Field>
        <div className="divide-y divide-line/70 border-t border-line/70">
          <Switch label="Mostrar mi cumpleaños" description="Solo día y mes. Tus compañeros podrán saludarte." checked={form.show_birthday} onChange={(v) => set('show_birthday', v)} />
          {form.show_birthday && (
            <div className="grid grid-cols-2 gap-3 py-3">
              <Field label="Día"><Input type="number" min={1} max={31} value={form.birth_day} onChange={(e) => set('birth_day', e.target.value)} /></Field>
              <Field label="Mes"><Input type="number" min={1} max={12} value={form.birth_month} onChange={(e) => set('birth_month', e.target.value)} /></Field>
            </div>
          )}
          <Switch label="Mostrar mi fecha de ingreso" checked={form.show_hire_date} onChange={(v) => set('show_hire_date', v)} />
        </div>
        <p className="text-xs leading-relaxed text-ink-3">Tus datos laborales (puesto, sucursal) los administra tu empresa. Para corregirlos, usá <Link to="/solicitudes" className="underline">Solicitudes → Actualización de datos</Link>.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => nav(-1)}>Cancelar</Button><Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button></div>
      </Card>
    </div>
  );
}
