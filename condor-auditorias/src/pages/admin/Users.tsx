import { useEffect, useState } from 'react';
import { UserPlus, Pencil, Mail } from 'lucide-react';
import { supabase, friendlyError } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { ROLE_LABEL, fmtDate } from '../../lib/format';
import type { Profile, Role } from '../../lib/types';
import { Card, ErrorBox, Field, Input, Loading, Modal, Notice, PageHeader, Select, cx } from '../../components/ui';

async function callAdmin(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));
  if (!res.ok) throw new Error(out.error ?? 'Error del servidor');
  return out;
}

export default function Users() {
  const { branches, profile: me } = useSession();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [assign, setAssign] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState<{ open: boolean; u: Partial<Profile> & { password?: string; mode?: 'password' | 'invite'; branch_ids?: string[] } }>({ open: false, u: {} });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: ub }] = await Promise.all([
      supabase.from('profiles').select('*').order('role').order('full_name'),
      supabase.from('user_branches').select('user_id, branch_id'),
    ]);
    setUsers((p as Profile[]) ?? []);
    const m: Record<string, string[]> = {};
    (ub ?? []).forEach((r: { user_id: string; branch_id: string }) => { (m[r.user_id] ??= []).push(r.branch_id); });
    setAssign(m);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      const u = form.u;
      if (u.id) await callAdmin({ action: 'update', user_id: u.id, role: u.role, active: u.active, full_name: u.full_name, branch_ids: u.branch_ids ?? [] });
      else await callAdmin({ action: 'create', email: u.email, full_name: u.full_name, role: u.role, mode: u.mode, password: u.password, branch_ids: u.branch_ids ?? [] });
      setForm({ open: false, u: {} });
      setMsg(u.id ? 'Usuario actualizado.' : u.mode === 'invite' ? 'Invitación enviada por correo.' : 'Usuario creado. Comunique la contraseña inicial por un canal seguro.');
      load();
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };
  const sendReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/restablecer` });
    setMsg(error ? friendlyError(error) : `Se envió un enlace de recuperación a ${email}.`);
  };

  if (!users) return <Loading />;
  const u = form.u;
  const toggleBranch = (id: string) => setForm((f) => ({ ...f, u: { ...f.u, branch_ids: f.u.branch_ids?.includes(id) ? f.u.branch_ids.filter((x) => x !== id) : [...(f.u.branch_ids ?? []), id] } }));

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Administración" title="Usuarios y permisos" subtitle="Administradores, auditores y franquiciados. Los auditores acceden a sus sucursales asignadas; los franquiciados, solo a la suya."
        actions={<button className="btn-primary" onClick={() => { setErr(null); setForm({ open: true, u: { role: 'auditor', mode: 'password', active: true, branch_ids: [] } }); }}><UserPlus className="h-4 w-4" /> Nuevo usuario</button>} />
      {msg && <div className="mb-4"><Notice tone="ok">{msg}</Notice></div>}
      <Card>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="table-base min-w-[760px]">
            <thead><tr><th>Usuario</th><th>Perfil</th><th>Sucursales</th><th>Estado</th><th>Alta</th><th /></tr></thead>
            <tbody>
              {users.map((x) => (
                <tr key={x.id} className={cx(!x.active && 'opacity-60')}>
                  <td><div className="font-semibold">{x.full_name || '—'}</div><div className="text-xs text-cafe-500">{x.email}</div></td>
                  <td className="text-sm">{ROLE_LABEL[x.role]}</td>
                  <td className="text-xs">{x.role === 'admin' ? 'Todas' : (assign[x.id] ?? []).map((b) => branches.find((y) => y.id === b)?.name).filter(Boolean).join(', ') || <span className="text-[#a33b2b]">Sin asignar</span>}
                    {x.role === 'auditor' && branches.some((b) => b.assigned_auditor_id === x.id) && <div className="text-cafe-400">Auditor asignado en ficha: {branches.filter((b) => b.assigned_auditor_id === x.id).map((b) => b.name).join(', ')}</div>}</td>
                  <td>{x.active ? <span className="chip bg-[#2f6b4f]/10 text-[#2f6b4f]">Activo</span> : <span className="chip bg-cafe-800/10 text-cafe-600">Inactivo</span>}</td>
                  <td className="text-xs">{fmtDate(x.created_at)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost p-2" title="Enviar enlace de recuperación" onClick={() => sendReset(x.email)}><Mail className="h-4 w-4" /></button>
                      <button className="btn-ghost p-2" title="Editar" onClick={() => { setErr(null); setForm({ open: true, u: { ...x, branch_ids: assign[x.id] ?? [] } }); }}><Pencil className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={form.open} onClose={() => setForm({ open: false, u: {} })} title={u.id ? 'Editar usuario' : 'Nuevo usuario'} wide
        footer={<><button className="btn-ghost" onClick={() => setForm({ open: false, u: {} })}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre y apellido *"><Input value={u.full_name ?? ''} onChange={(e) => setForm({ ...form, u: { ...u, full_name: e.target.value } })} /></Field>
          <Field label="Correo *"><Input type="email" disabled={!!u.id} value={u.email ?? ''} onChange={(e) => setForm({ ...form, u: { ...u, email: e.target.value } })} /></Field>
          <Field label="Perfil">
            <Select value={u.role} disabled={u.id === me!.id} onChange={(e) => setForm({ ...form, u: { ...u, role: e.target.value as Role } })}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
          {u.id ? (
            <Field label="Estado">
              <Select value={u.active ? '1' : '0'} disabled={u.id === me!.id} onChange={(e) => setForm({ ...form, u: { ...u, active: e.target.value === '1' } })}><option value="1">Activo</option><option value="0">Inactivo (sin acceso)</option></Select>
            </Field>
          ) : (
            <Field label="Alta">
              <Select value={u.mode} onChange={(e) => setForm({ ...form, u: { ...u, mode: e.target.value as 'password' | 'invite' } })}><option value="password">Definir contraseña inicial</option><option value="invite">Enviar invitación por correo</option></Select>
            </Field>
          )}
          {!u.id && u.mode === 'password' && <Field label="Contraseña inicial" hint="Mínimo 10 caracteres. El usuario puede cambiarla con «¿Olvidó su contraseña?»."><Input type="text" autoComplete="off" value={u.password ?? ''} onChange={(e) => setForm({ ...form, u: { ...u, password: e.target.value } })} /></Field>}
          {u.role !== 'admin' && (
            <div className="sm:col-span-2">
              <span className="label">{u.role === 'franquiciado' ? 'Sucursal del franquiciado' : 'Sucursales asignadas al auditor'}</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {branches.map((b) => (
                  <label key={b.id} className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', u.branch_ids?.includes(b.id) ? 'border-brand-accent bg-brand-accent/5' : 'border-cafe-800/10')}>
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand-accent))]" checked={!!u.branch_ids?.includes(b.id)} onChange={() => toggleBranch(b.id)} />{b.name}{!b.active && ' (inactiva)'}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>
      </Modal>
    </div>
  );
}
