import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Search, Mail, Unlock, Users } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction, useDebounced } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, KeyValue, LoadingList, Notice, PageHeader, Select, Sheet } from '@/components/ui';
import { useBranches, useBranchesWith, useSectors } from './scope';

interface Emp {
  employment_id: string; user_id: string; first_name: string; last_name: string; avatar_path: string | null; email: string | null; job_title: string;
  employee_code: string; status: string; branch_id: string; branch_name: string; brand_name: string; legal_entity: string; sector_name: string | null;
  hire_date: string | null; has_kiosk_pin: boolean; kiosk_locked: boolean;
}
const STATUS: Record<string, [string, 'ok' | 'info' | 'warn' | 'neutral']> = { active: ['Activo', 'ok'], invited: ['Invitado', 'info'], suspended: ['Suspendido', 'warn'], terminated: ['Baja', 'neutral'] };

export default function Employees() {
  const { can } = useAuth();
  const branches = useBranchesWith('employees.view');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [inviting, setInviting] = useState(false);
  const [sel, setSel] = useState<Emp | null>(null);
  const list = useQuery({ queryKey: ['admin-employees', branch, dq, status], queryFn: () => rpc<Emp[]>('admin_employees', { p_branch: branch || null, p_query: dq, p_status: status || null }) });
  return (
    <div className="space-y-5">
      <PageHeader title="Personal" subtitle="Altas por invitación, asignaciones y estados"
        actions={can('employees.manage') && <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviting(true)}>Invitar persona</Button>} />
      <div className="grid gap-3 sm:grid-cols-[1fr_220px_160px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><Input className="pl-10" placeholder="Nombre o código" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
        <Select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Sucursal"><option value="">Todas las sucursales</option>{branches.data.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado"><option value="">Todos los estados</option>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select>
      </div>
      {list.isLoading ? <LoadingList /> : list.isError ? <ErrorState error={list.error} /> : !list.data?.length ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No hay personas con estos filtros" action={can('employees.manage') && <Button onClick={() => setInviting(true)}>Invitar persona</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line/70">
            {list.data.map((e) => (
              <li key={e.employment_id}>
                <button onClick={() => setSel(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
                  <Avatar path={e.avatar_path} person={e} size={40} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{e.last_name}, {e.first_name}</p><p className="truncate text-[13px] text-ink-3">{e.job_title} · {e.branch_name} · <span className="font-mono">{e.employee_code}</span></p></div>
                  {e.kiosk_locked && <Badge tone="warn">PIN bloqueado</Badge>}
                  <Badge tone={STATUS[e.status]![1]}>{STATUS[e.status]![0]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {inviting && <InviteSheet onClose={() => setInviting(false)} />}
      {sel && <EmployeeSheet emp={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function InviteSheet({ onClose }: { onClose: () => void }) {
  const branches = useBranchesWith('employees.manage');
  const sectors = useSectors();
  const [f, setF] = useState({ email: '', first: '', last: '', position: 'Colaborador', code: '', branch: '', sector: '', hire: '' });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const b = f.branch || branches.data[0]?.id || '';
  const send = useAction(async () => {
    // Paso 1: la base valida permisos y registra la invitación con la sesión de quien invita.
    const invitation = await rpc<string>('create_employee_invitation', {
      p_branch: b, p_email: f.email, p_first_name: f.first, p_last_name: f.last, p_position: f.position, p_employee_code: f.code, p_hire_date: f.hire || null, p_sector: f.sector || null,
    });
    // Paso 2: la Edge Function (con clave de servicio, solo en servidor) envía el correo y vincula la identidad.
    const { data, error } = await supabase.functions.invoke('invite-employee', { body: { invitation_id: invitation, redirect_to: `${location.origin}/activar` } });
    if (error) throw new Error('La invitación quedó registrada pero no se pudo enviar el correo. Verificá la configuración de la función "invite-employee".');
    return data as { status: string };
  }, { success: (r) => (r.status === 'linked' ? 'La persona ya tenía cuenta: se agregó la relación laboral' : 'Invitación enviada por correo'), invalidate: [['admin-employees']], onDone: onClose });
  const valid = /\S+@\S+\.\S+/.test(f.email) && f.first.trim() && f.last.trim() && /^[A-Za-z0-9-]{3,20}$/.test(f.code) && b;
  return (
    <Sheet open onClose={onClose} title="Invitar persona" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon={<Mail className="h-4 w-4" />} disabled={!valid} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar invitación</Button></>}>
      <div className="space-y-4">
        <Notice tone="info">La persona recibe un enlace seguro para crear su contraseña. No existe registro público.</Notice>
        <Field label="Correo electrónico"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Nombre"><Input value={f.first} onChange={(e) => set('first', e.target.value)} /></Field><Field label="Apellido"><Input value={f.last} onChange={(e) => set('last', e.target.value)} /></Field></div>
        <Field label="Sucursal principal"><Select value={b} onChange={(e) => set('branch', e.target.value)}>{branches.data.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Puesto"><Input value={f.position} onChange={(e) => set('position', e.target.value)} /></Field>
          <Field label="Sector" optional><Select value={f.sector} onChange={(e) => set('sector', e.target.value)}><option value="">—</option>{sectors.data?.filter((s) => !s.branch_id || s.branch_id === b).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código / legajo" hint="Se usa en la tablet de fichaje"><Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={20} /></Field>
          <Field label="Fecha de ingreso" optional><Input type="date" value={f.hire} onChange={(e) => set('hire', e.target.value)} /></Field>
        </div>
      </div>
    </Sheet>
  );
}

function EmployeeSheet({ emp, onClose }: { emp: Emp; onClose: () => void }) {
  const { can } = useAuth();
  const all = useBranches();
  const sectors = useSectors();
  const [position, setPosition] = useState(emp.job_title);
  const [status, setStatus] = useState(emp.status);
  const [branch, setBranch] = useState(emp.branch_id);
  const [sector, setSector] = useState('');
  const current = all.data?.find((b) => b.id === emp.branch_id);
  const sameLe = all.data?.filter((b) => b.legal_entity_id === current?.legal_entity_id) ?? [];
  const extra = useQuery({ queryKey: ['emp-branches', emp.employment_id], queryFn: async () => {
    const { data } = await supabase.from('employment_branches').select('branch_id').eq('employment_id', emp.employment_id); return (data ?? []).map((r) => r.branch_id as string);
  } });
  const priv = useQuery({ queryKey: ['emp-private', emp.user_id], enabled: can('employees.view_private'), queryFn: async () => {
    const { data } = await supabase.from('employee_private').select('*').eq('user_id', emp.user_id).maybeSingle(); return data;
  } });
  const save = useAction(async () => {
    const patch: Record<string, unknown> = { position, status, primary_branch_id: branch };
    if (sector) patch.sector_id = sector;
    const { error } = await supabase.from('employments').update(patch).eq('id', emp.employment_id);
    if (error) throw error;
  }, { success: 'Cambios guardados (auditados)', invalidate: [['admin-employees']], onDone: onClose });
  const toggleBranch = useAction(async (bid: string) => {
    const has = extra.data?.includes(bid);
    const { error } = has ? await supabase.from('employment_branches').delete().eq('employment_id', emp.employment_id).eq('branch_id', bid)
      : await supabase.from('employment_branches').insert({ employment_id: emp.employment_id, branch_id: bid });
    if (error) throw error;
  }, { invalidate: [['emp-branches', emp.employment_id]] });
  const unlock = useAction(() => rpc('admin_unlock_kiosk_pin', { p_employment: emp.employment_id }), { success: 'PIN desbloqueado', invalidate: [['admin-employees']] });
  const manage = can('employees.manage');
  return (
    <Sheet open onClose={onClose} title={`${emp.first_name} ${emp.last_name}`} wide
      footer={manage ? <><Button variant="ghost" onClick={onClose}>Cerrar</Button><Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button></> : undefined}>
      <div className="space-y-5">
        <KeyValue items={[['Correo', emp.email ?? '—'], ['Código', <span key="c" className="font-mono">{emp.employee_code}</span>], ['Razón social', emp.legal_entity], ['Marca', emp.brand_name], ['Ingreso', emp.hire_date ? fmtDate(emp.hire_date + 'T12:00:00') : '—'], ['PIN de tablet', emp.has_kiosk_pin ? (emp.kiosk_locked ? 'Bloqueado' : 'Configurado') : 'Sin configurar']]} />
        {emp.kiosk_locked && can('attendance.manage') && <Button size="sm" variant="secondary" icon={<Unlock className="h-4 w-4" />} onClick={() => unlock.mutate(undefined)}>Desbloquear PIN</Button>}
        {manage && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Puesto"><Input value={position} onChange={(e) => setPosition(e.target.value)} /></Field>
            <Field label="Estado"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Sucursal principal" hint="Misma razón social"><Select value={branch} onChange={(e) => setBranch(e.target.value)}>{sameLe.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Sector"><Select value={sector} onChange={(e) => setSector(e.target.value)}><option value="">{emp.sector_name ?? 'Sin cambios'}</option>{sectors.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </div>
        )}
        {manage && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Sucursales adicionales autorizadas (trabajo ocasional)</p>
            <div className="flex flex-wrap gap-2">{sameLe.filter((b) => b.id !== emp.branch_id).map((b) => (
              <button key={b.id} onClick={() => toggleBranch.mutate(b.id)} aria-pressed={extra.data?.includes(b.id)} className={`rounded-full border px-3 py-1.5 text-[13px] ${extra.data?.includes(b.id) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2'}`}>{b.name}</button>
            ))}</div>
          </div>
        )}
        {can('employees.view_private') && (
          <div className="rounded-xl bg-surface-2 p-4">
            <p className="mb-2 text-[13px] font-semibold">Datos personales (acceso restringido)</p>
            {priv.data ? <KeyValue items={[['DNI', priv.data.dni ?? '—'], ['CUIL', priv.data.cuil ?? '—'], ['Teléfono', priv.data.phone ?? '—'], ['Domicilio', priv.data.address ?? '—']]} /> : <p className="text-sm text-ink-3">Sin datos cargados.</p>}
          </div>
        )}
        {status === 'terminated' && emp.status !== 'terminated' && <Notice tone="warn">La baja administrativa desactiva el acceso a funciones laborales. No reemplaza los procedimientos legales de desvinculación.</Notice>}
      </div>
    </Sheet>
  );
}
