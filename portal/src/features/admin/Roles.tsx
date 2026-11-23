import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { Badge, Button, Card, CardHeader, EmptyState, Field, LoadingList, Notice, PageHeader, Select, Sheet } from '@/components/ui';
import { useBranches, useLegalEntities } from './scope';

interface Assignment { id: string; user_id: string; first_name: string; last_name: string; role_id: string; role_key: string; role_name: string; scope_type: string; scope_id: string; scope_name: string }
interface Role { id: string; key: string; name: string; description: string | null; organization_id: string | null }
const SCOPE: Record<string, string> = { organization: 'Organización', legal_entity: 'Razón social', branch: 'Sucursal' };

export default function Roles() {
  const { ctx } = useAuth();
  const org = ctx!.organization!.id;
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: ['role-assignments'], queryFn: () => rpc<Assignment[]>('org_role_assignments', { p_org: org }) });
  const roles = useQuery({ queryKey: ['roles'], queryFn: async () => { const { data, error } = await supabase.from('roles').select('*').order('name'); if (error) throw error; return data as Role[]; } });
  const perms = useQuery({ queryKey: ['role-perms'], queryFn: async () => {
    const [rp, p] = await Promise.all([supabase.from('role_permissions').select('*'), supabase.from('permissions').select('*').order('category')]);
    return { rp: rp.data ?? [], p: (p.data ?? []) as { key: string; category: string; description: string }[] };
  } });
  const revoke = useAction((id: string) => rpc('revoke_role', { p_assignment: id }), { success: 'Rol quitado (auditado)', invalidate: [['role-assignments']] });
  return (
    <div className="space-y-5">
      <PageHeader title="Roles y permisos" subtitle="Los permisos se verifican en la base de datos. Ocultar un botón no es seguridad."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Asignar rol</Button>} />
      <Notice tone="info">Nadie puede otorgar permisos que no posee. La superadministración técnica no accede a mensajes privados ni a contenido social restringido.</Notice>
      {list.isLoading ? <LoadingList /> : !list.data?.length ? <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="Sin asignaciones" compact /> : (
        <Card className="overflow-hidden"><ul className="divide-y divide-line/70">{list.data.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><p className="font-medium">{a.last_name}, {a.first_name}</p><p className="text-[13px] text-ink-3">{a.role_name} · {SCOPE[a.scope_type]}: {a.scope_name}</p></div>
            <Button size="sm" variant="ghost" aria-label="Quitar rol" icon={<Trash2 className="h-4 w-4" />} onClick={() => { if (confirm('¿Quitar este rol?')) revoke.mutate(a.id); }} />
          </li>
        ))}</ul></Card>
      )}
      <Card><CardHeader title="Roles disponibles" />
        <div className="space-y-4 p-5 pt-2">{roles.data?.map((r) => (
          <div key={r.id}>
            <p className="font-medium">{r.name} {!r.organization_id && <Badge className="ml-1">Del sistema</Badge>}</p>
            {r.description && <p className="text-[13px] text-ink-3">{r.description}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">{perms.data?.rp.filter((x) => x.role_id === r.id).map((x) => <span key={x.permission_key} title={perms.data.p.find((p) => p.key === x.permission_key)?.description} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-2">{x.permission_key}</span>)}</div>
          </div>
        ))}<p className="text-xs text-ink-3">Empleado: rol implícito de toda persona con relación laboral activa (sus propios datos, comunidad y mensajes).</p></div>
      </Card>
      {open && <AssignSheet roles={roles.data ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AssignSheet({ roles, onClose }: { roles: Role[]; onClose: () => void }) {
  const { ctx } = useAuth();
  const branches = useBranches();
  const les = useLegalEntities();
  const people = useQuery({ queryKey: ['admin-employees', 'roles'], queryFn: () => rpc<{ user_id: string; first_name: string; last_name: string; status: string }[]>('admin_employees', {}) });
  const [user, setUser] = useState('');
  const [role, setRole] = useState('');
  const [scope, setScope] = useState('branch');
  const [scopeId, setScopeId] = useState('');
  const go = useAction(() => rpc('assign_role', { p_user: user, p_role: role, p_scope_type: scope, p_scope_id: scope === 'organization' ? ctx!.organization!.id : scopeId }), { success: 'Rol asignado', invalidate: [['role-assignments']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Asignar rol" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!user || !role || (scope !== 'organization' && !scopeId)} loading={go.isPending} onClick={() => go.mutate(undefined)}>Asignar</Button></>}>
      <div className="space-y-4">
        <Field label="Persona"><Select value={user} onChange={(e) => setUser(e.target.value)}><option value="">Elegir</option>{[...new Map(people.data?.map((p) => [p.user_id, p])).values()].map((p) => <option key={p.user_id} value={p.user_id}>{p.last_name}, {p.first_name}</option>)}</Select></Field>
        <Field label="Rol"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="">Elegir</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
        <Field label="Alcance"><Select value={scope} onChange={(e) => { setScope(e.target.value); setScopeId(''); }}><option value="branch">Una sucursal</option><option value="legal_entity">Una razón social</option><option value="organization">Toda la organización</option></Select></Field>
        {scope === 'branch' && <Field label="Sucursal"><Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}><option value="">Elegir</option>{branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>}
        {scope === 'legal_entity' && <Field label="Razón social"><Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}><option value="">Elegir</option>{les.data?.map((l) => <option key={l.id} value={l.id}>{l.legal_name}</option>)}</Select></Field>}
        <p className="text-xs text-ink-3">Si la organización exige MFA, la persona deberá configurar la verificación en dos pasos para usar estos permisos.</p>
      </div>
    </Sheet>
  );
}
