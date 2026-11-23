import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Check, X, Clock, Search, Sparkles, Plus, Award } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction, useDebounced } from '@/lib/hooks';
import { fullName, relativeTime } from '@/lib/format';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingList, PageHeader, Segmented, Select, Sheet, Textarea } from '@/components/ui';
import { PostCard, type FeedPost } from './PostCard';
import { Composer, PeoplePicker, type Person } from './Composer';

type Tab = 'feed' | 'personas' | 'solicitudes' | 'grupos' | 'reconocimientos';

export function CommunityPage() {
  const { tab = 'feed' } = useParams<{ tab: Tab }>();
  const nav = useNavigate();
  const { ctx } = useAuth();
  const requests = useQuery({ queryKey: ['friend-requests'], queryFn: () => rpc<FriendReq[]>('friend_requests_inbox') });
  const received = requests.data?.filter((r) => r.direction === 'received').length ?? 0;
  if (ctx?.profile && !ctx.profile.social_enabled) {
    return (
      <div>
        <PageHeader title="Comunidad" />
        <EmptyState icon={<Users className="h-5 w-5" />} title="La comunidad está desactivada en tu perfil"
          description="Participar es voluntario. Podés activarla cuando quieras desde Configuración."
          action={<Link to="/configuracion"><Button variant="secondary">Ir a Configuración</Button></Link>} />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Comunidad" subtitle="Lo que comparte tu equipo" />
      <Segmented<Tab> className="mb-5" value={tab as Tab} onChange={(t) => nav(t === 'feed' ? '/comunidad' : `/comunidad/${t}`)}
        options={[{ value: 'feed', label: 'Novedades' }, { value: 'personas', label: 'Compañeros' }, { value: 'solicitudes', label: 'Solicitudes', count: received },
                  { value: 'grupos', label: 'Grupos' }, { value: 'reconocimientos', label: 'Reconocimientos' }]} />
      {tab === 'feed' && <Feed />}
      {tab === 'personas' && <People />}
      {tab === 'solicitudes' && <FriendRequests q={requests} />}
      {tab === 'grupos' && <Groups />}
      {tab === 'reconocimientos' && <Recognitions />}
    </div>
  );
}

export function Feed({ groupId, authorId, composer = true }: { groupId?: string; authorId?: string; composer?: boolean }) {
  const q = useInfiniteQuery({
    queryKey: ['feed', groupId ?? null, authorId ?? null],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => rpc<FeedPost[]>('feed', { p_before: pageParam, p_limit: 15, p_group: groupId ?? null, p_author: authorId ?? null }),
    getNextPageParam: (last) => (last.length === 15 ? last[last.length - 1]!.created_at : undefined),
  });
  const posts = q.data?.pages.flat() ?? [];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {composer && <Composer groupId={groupId} />}
      {q.isLoading ? <LoadingList /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : posts.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Todavía no hay publicaciones" description="Sé la primera persona en compartir algo con el equipo." compact />
      ) : (
        <>
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
          {q.hasNextPage && <Button variant="secondary" block loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Ver publicaciones anteriores</Button>}
        </>
      )}
    </div>
  );
}

export function FriendButton({ person, size = 'sm' }: { person: { user_id: string; relation?: string; pending_request_id?: string | null }; size?: 'sm' | 'md' }) {
  const inv = [['people'], ['friend-requests'], ['person', person.user_id]];
  const send = useAction(() => rpc<{ status: string }>('send_friend_request', { p_to: person.user_id }), {
    success: (r) => (r.status === 'accepted' ? '¡Ahora son amigos!' : 'Solicitud enviada'), invalidate: inv });
  const cancel = useAction(() => rpc('cancel_friend_request', { p_id: person.pending_request_id }), { success: 'Solicitud cancelada', invalidate: inv });
  const accept = useAction(() => rpc('respond_friend_request', { p_id: person.pending_request_id, p_accept: true }), { success: '¡Ahora son amigos!', invalidate: inv });
  switch (person.relation) {
    case 'friend': return <Badge tone="ok"><Check className="h-3 w-3" />Amigos</Badge>;
    case 'sent': return person.pending_request_id
      ? <Button size={size} variant="secondary" icon={<Clock className="h-3.5 w-3.5" />} loading={cancel.isPending} onClick={() => cancel.mutate(undefined)}>Cancelar solicitud</Button>
      : <Badge><Clock className="h-3 w-3" />Pendiente</Badge>;
    case 'received': return person.pending_request_id
      ? <Button size={size} icon={<Check className="h-3.5 w-3.5" />} loading={accept.isPending} onClick={() => accept.mutate(undefined)}>Aceptar</Button>
      : <Badge tone="info">Te envió solicitud</Badge>;
    case 'self': return null;
    default: return <Button size={size} variant="secondary" icon={<UserPlus className="h-3.5 w-3.5" />} loading={send.isPending} onClick={() => send.mutate(undefined)}>Agregar</Button>;
  }
}

function People() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const people = useQuery({ queryKey: ['people', dq], queryFn: () => rpc<Person[]>('people_search', { p_query: dq, p_limit: 60 }) });
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input placeholder="Buscar compañeros por nombre, sucursal o puesto" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" aria-label="Buscar compañeros" />
      </div>
      {people.isLoading ? <LoadingList /> : people.isError ? <ErrorState error={people.error} /> : people.data!.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No encontramos compañeros" description="Solo ves personas de tu comunidad que tienen el perfil social activo." compact />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {people.data!.map((p) => (
            <Card key={p.user_id} className="flex items-center gap-3 p-3.5">
              <Link to={`/perfil/${p.user_id}`}><Avatar path={p.avatar_path} person={p} size={44} /></Link>
              <Link to={`/perfil/${p.user_id}`} className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{fullName(p)}</p>
                <p className="truncate text-[13px] text-ink-3">{p.job_title} · {p.branch_name}</p>
              </Link>
              <FriendButton person={p} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface FriendReq { id: string; direction: 'received' | 'sent'; user_id: string; first_name: string; last_name: string; avatar_path: string | null; created_at: string }

function FriendRequests({ q }: { q: { data?: FriendReq[]; isLoading: boolean } }) {
  const inv = [['friend-requests'], ['people']];
  const respond = useAction((v: { id: string; ok: boolean }) => rpc('respond_friend_request', { p_id: v.id, p_accept: v.ok }), { invalidate: inv, success: 'Listo' });
  const cancel = useAction((id: string) => rpc('cancel_friend_request', { p_id: id }), { invalidate: inv, success: 'Solicitud cancelada' });
  if (q.isLoading) return <LoadingList />;
  const rec = q.data?.filter((r) => r.direction === 'received') ?? [];
  const sent = q.data?.filter((r) => r.direction === 'sent') ?? [];
  if (!rec.length && !sent.length) return <EmptyState icon={<UserPlus className="h-5 w-5" />} title="No tenés solicitudes pendientes" description="Buscá compañeros en la pestaña Compañeros." compact />;
  const Row = ({ r, actions }: { r: FriendReq; actions: React.ReactNode }) => (
    <Card className="flex items-center gap-3 p-3.5">
      <Link to={`/perfil/${r.user_id}`}><Avatar path={r.avatar_path} person={r} size={44} /></Link>
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{fullName(r)}</p><p className="text-xs text-ink-3">{relativeTime(r.created_at)}</p></div>
      <div className="flex gap-2">{actions}</div>
    </Card>
  );
  return (
    <div className="space-y-6">
      {rec.length > 0 && <section className="space-y-2.5"><h2 className="text-sm font-semibold text-ink-2">Recibidas</h2>
        {rec.map((r) => <Row key={r.id} r={r} actions={<>
          <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => respond.mutate({ id: r.id, ok: true })}>Aceptar</Button>
          <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => respond.mutate({ id: r.id, ok: false })} aria-label="Rechazar">Rechazar</Button></>} />)}
      </section>}
      {sent.length > 0 && <section className="space-y-2.5"><h2 className="text-sm font-semibold text-ink-2">Enviadas</h2>
        {sent.map((r) => <Row key={r.id} r={r} actions={<Button size="sm" variant="secondary" onClick={() => cancel.mutate(r.id)}>Cancelar</Button>} />)}
      </section>}
    </div>
  );
}

interface Group { id: string; name: string; description: string | null; kind: string; join_policy: string; members: number; membership: string | null }

function Groups() {
  const { ctx } = useAuth();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['groups'], queryFn: () => rpc<Group[]>('my_groups') });
  const join = useAction((id: string) => rpc<string>('join_group', { p_group: id }), { invalidate: [['groups']], success: (r) => (r === 'active' ? 'Te uniste al grupo' : 'Solicitud enviada al grupo') });
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Crear grupo</Button></div>
      {q.isLoading ? <LoadingList /> : (q.data?.length ?? 0) === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Todavía no hay grupos" description="Creá un grupo para tu sector o para un interés compartido." compact />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data!.map((g) => {
            const member = g.membership?.startsWith('active');
            return (
              <Card key={g.id} className="flex flex-col p-4">
                <Link to={`/comunidad/grupos/${g.id}`} className="flex-1">
                  <p className="font-semibold">{g.name}</p>
                  {g.description && <p className="mt-1 line-clamp-2 text-sm text-ink-3">{g.description}</p>}
                </Link>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-ink-3">{g.members} {Number(g.members) === 1 ? 'miembro' : 'miembros'}</span>
                  {member ? <Badge tone="ok">Miembro</Badge> : g.membership?.startsWith('pending') ? <Badge>Pendiente</Badge>
                    : g.join_policy === 'invite' ? <Badge>Por invitación</Badge>
                    : <Button size="sm" variant="secondary" onClick={() => join.mutate(g.id)}>Unirme</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {creating && <CreateGroup orgId={ctx!.organization!.id} brandId={ctx!.employments[0]?.brand_id} onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateGroup({ orgId, brandId, onClose }: { orgId: string; brandId?: string; onClose: () => void }) {
  const { ctx } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('interest');
  const [join, setJoin] = useState('open');
  const create = useAction(async () => {
    const { error } = await supabase.from('groups').insert({ organization_id: orgId, brand_id: brandId ?? null, name: name.trim(), description: description || null, kind, join_policy: join, created_by: ctx!.user_id });
    if (error) throw error;
  }, { success: 'Grupo creado', invalidate: [['groups']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Crear grupo" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={name.trim().length < 3} loading={create.isPending} onClick={() => create.mutate(undefined)}>Crear</Button></>}>
      <div className="space-y-4">
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
        <Field label="Descripción" optional><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></Field>
        <Field label="Tipo"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="interest">Intereses</option><option value="sector">Sector</option></Select></Field>
        <Field label="Ingreso"><Select value={join} onChange={(e) => setJoin(e.target.value)}><option value="open">Abierto</option><option value="approval">Con aprobación</option><option value="invite">Solo por invitación</option></Select></Field>
      </div>
    </Sheet>
  );
}

interface Recog { id: string; from_user: string; from_name: string; to_user: string; to_name: string; to_avatar: string | null; kind: string; badge: string; message: string; created_at: string }
const BADGES: Record<string, string> = { thanks: 'Gracias', teamwork: 'Trabajo en equipo', service: 'Gran atención', leadership: 'Liderazgo', initiative: 'Iniciativa' };

export function Recognitions() {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<Person | null>(null);
  const [picker, setPicker] = useState(false);
  const [badge, setBadge] = useState('thanks');
  const [msg, setMsg] = useState('');
  const q = useQuery({ queryKey: ['recognitions'], queryFn: () => rpc<Recog[]>('recognitions_feed', { p_limit: 50 }) });
  const give = useAction(() => rpc('give_recognition', { p_to: to!.user_id, p_badge: badge, p_message: msg.trim() }), {
    success: 'Reconocimiento enviado', invalidate: [['recognitions']], onDone: () => { setOpen(false); setTo(null); setMsg(''); } });
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-4 p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Award className="h-5 w-5" /></span>
        <div className="flex-1"><p className="font-medium">Reconocé a un compañero</p><p className="text-sm text-ink-3">Un gracias a tiempo hace la diferencia.</p></div>
        <Button onClick={() => setOpen(true)}>Reconocer</Button>
      </Card>
      {q.isLoading ? <LoadingList /> : (q.data?.length ?? 0) === 0 ? <EmptyState title="Todavía no hay reconocimientos" compact /> : (
        <ul className="space-y-3">
          {q.data!.map((r) => (
            <Card as="li" key={r.id} className="flex gap-3 p-4">
              <Avatar path={r.to_avatar} person={{ first_name: r.to_name }} />
              <div className="min-w-0">
                <p className="text-sm"><Link to={`/perfil/${r.from_user}`} className="font-semibold">{r.from_name}</Link> reconoció a <Link to={`/perfil/${r.to_user}`} className="font-semibold">{r.to_name}</Link></p>
                <div className="mt-1 flex gap-1.5"><Badge tone="accent">{BADGES[r.badge]}</Badge>{r.kind === 'manager' && <Badge>De gerencia</Badge>}</div>
                <p className="mt-2 text-[15px]">{r.message}</p>
                <p className="mt-1 text-xs text-ink-3">{relativeTime(r.created_at)}</p>
              </div>
            </Card>
          ))}
        </ul>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo reconocimiento"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!to || msg.trim().length < 3} loading={give.isPending} onClick={() => give.mutate(undefined)}>Enviar</Button></>}>
        <div className="space-y-4">
          <Field label="Para">
            <button onClick={() => setPicker(true)} className="flex h-11 w-full items-center gap-2 rounded-xl border border-line px-3.5 text-left text-[15px]">
              {to ? <><Avatar path={to.avatar_path} person={to} size={26} />{fullName(to)}</> : <span className="text-ink-3">Elegir compañero</span>}
            </button>
          </Field>
          <Field label="Motivo"><Select value={badge} onChange={(e) => setBadge(e.target.value)}>{Object.entries(BADGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Mensaje"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} placeholder="Contá qué hizo y por qué lo valorás" /></Field>
        </div>
      </Sheet>
      <PeoplePicker open={picker} onClose={() => setPicker(false)} onPick={setTo} />
    </div>
  );
}
