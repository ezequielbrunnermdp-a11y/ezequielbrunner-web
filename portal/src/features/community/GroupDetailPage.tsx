import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, LogOut, Check, X } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fullName } from '@/lib/format';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, LoadingList } from '@/components/ui';
import { Feed } from './CommunityPage';
import { PeoplePicker } from './Composer';

interface Member { user_id: string; first_name: string; last_name: string; avatar_path: string | null; role: string; status: string }

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ctx } = useAuth();
  const [picker, setPicker] = useState(false);
  const g = useQuery({ queryKey: ['group', id], queryFn: async () => { const { data, error } = await supabase.from('groups').select('*').eq('id', id!).maybeSingle(); if (error) throw error; return data; } });
  const members = useQuery({ queryKey: ['group-members', id], queryFn: () => rpc<Member[]>('group_members_list', { p_group: id }) });
  const me = members.data?.find((m) => m.user_id === ctx?.user_id);
  const isAdmin = me?.role === 'admin' && me.status === 'active';
  const isMember = me?.status === 'active';
  const inv = [['group-members', id], ['groups']];
  const join = useAction(() => rpc('join_group', { p_group: id }), { invalidate: inv, success: 'Listo' });
  const leave = useAction(() => rpc('leave_group', { p_group: id }), { invalidate: inv, success: 'Saliste del grupo' });
  const add = useAction((u: string) => rpc('group_add_member', { p_group: id, p_user: u }), { invalidate: inv, success: 'Persona agregada' });
  const approve = useAction((v: { u: string; ok: boolean }) => rpc('approve_group_member', { p_group: id, p_user: v.u, p_approve: v.ok }), { invalidate: inv });

  if (g.isLoading) return <LoadingList />;
  if (g.isError) return <ErrorState error={g.error} />;
  if (!g.data) return <EmptyState title="Grupo no disponible" />;
  const active = members.data?.filter((m) => m.status === 'active') ?? [];
  const pending = members.data?.filter((m) => m.status === 'pending') ?? [];
  return (
    <div>
      <Link to="/comunidad/grupos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="h-4 w-4" />Grupos</Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[26px] font-semibold tracking-tight">{g.data.name}</h1>{g.data.description && <p className="mt-1 text-sm text-ink-2">{g.data.description}</p>}</div>
        <div className="flex gap-2">
          {isAdmin && <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setPicker(true)}>Agregar</Button>}
          {isMember ? <Button variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={() => leave.mutate(undefined)}>Salir</Button>
            : !me && g.data.join_policy !== 'invite' && <Button onClick={() => join.mutate(undefined)}>Unirme</Button>}
          {me?.status === 'pending' && <Badge>Solicitud pendiente</Badge>}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {isMember ? <Feed groupId={id} /> : <EmptyState title="Unite para ver las publicaciones del grupo" compact />}
        <div className="space-y-4">
          {isAdmin && pending.length > 0 && (
            <Card><CardHeader title="Solicitudes" />
              <ul className="px-5 pb-3">{pending.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2 py-2">
                  <Avatar path={m.avatar_path} person={m} size={30} /><span className="flex-1 truncate text-sm">{fullName(m)}</span>
                  <button className="rounded-full p-1.5 text-ok hover:bg-ok-soft" aria-label="Aprobar" onClick={() => approve.mutate({ u: m.user_id, ok: true })}><Check className="h-4 w-4" /></button>
                  <button className="rounded-full p-1.5 text-bad hover:bg-bad-soft" aria-label="Rechazar" onClick={() => approve.mutate({ u: m.user_id, ok: false })}><X className="h-4 w-4" /></button>
                </li>))}</ul>
            </Card>
          )}
          <Card><CardHeader title={`Miembros (${active.length})`} />
            <ul className="px-5 pb-3">{active.map((m) => (
              <li key={m.user_id}><Link to={`/perfil/${m.user_id}`} className="flex items-center gap-2.5 py-2">
                <Avatar path={m.avatar_path} person={m} size={30} /><span className="flex-1 truncate text-sm">{fullName(m)}</span>{m.role === 'admin' && <Badge>Admin</Badge>}
              </Link></li>))}</ul>
          </Card>
        </div>
      </div>
      <PeoplePicker open={picker} onClose={() => setPicker(false)} exclude={members.data?.map((m) => m.user_id)} onPick={(p) => add.mutate(p.user_id)} />
    </div>
  );
}
