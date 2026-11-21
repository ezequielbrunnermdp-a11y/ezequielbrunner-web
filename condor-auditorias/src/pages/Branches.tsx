import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, User, Pencil } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { branchOverview, listStaff } from '../lib/api';
import { fmtDate, fmtScore } from '../lib/format';
import type { Branch, BranchOverview } from '../lib/types';
import { Card, ErrorBox, Field, Input, Loading, Modal, PageHeader, ScorePill, Select, Textarea, cx } from '../components/ui';

export function BranchForm({ open, onClose, branch, onSaved }: { open: boolean; onClose: () => void; branch: Partial<Branch> | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Branch>>({});
  const [staff, setStaff] = useState<{ id: string; full_name: string; email: string; role: string; active: boolean }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm(branch ?? { active: true }); setErr(null); listStaff().then((s) => setStaff(s.filter((x) => x.role === 'auditor' && x.active))); } }, [open, branch]);
  const set = (k: keyof Branch, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name?.trim()) return setErr('El nombre es obligatorio.');
    setBusy(true);
    const payload = {
      name: form.name.trim(), address: form.address || null, legal_name: form.legal_name || null, manager_name: form.manager_name || null,
      phone: form.phone || null, email: form.email || null, active: form.active ?? true, assigned_auditor_id: form.assigned_auditor_id || null, notes: form.notes || null,
    };
    const { error } = form.id ? await supabase.from('branches').update(payload).eq('id', form.id) : await supabase.from('branches').insert(payload);
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    await supabase.rpc('log_activity', { p_action: form.id ? 'editar' : 'crear', p_entity: 'sucursal', p_entity_id: form.id ?? payload.name, p_details: payload });
    onSaved();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={form.id ? `Editar ${branch?.name}` : 'Nueva sucursal'} wide
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy}>Guardar</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *"><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Estado">
          <Select value={form.active === false ? 'inactiva' : 'activa'} onChange={(e) => set('active', e.target.value === 'activa')}><option value="activa">Activa</option><option value="inactiva">Inactiva</option></Select>
        </Field>
        <Field label="Dirección" className="sm:col-span-2"><Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Razón social del franquiciado"><Input value={form.legal_name ?? ''} onChange={(e) => set('legal_name', e.target.value)} /></Field>
        <Field label="Responsable"><Input value={form.manager_name ?? ''} onChange={(e) => set('manager_name', e.target.value)} /></Field>
        <Field label="Teléfono"><Input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Correo de contacto"><Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Auditor asignado" className="sm:col-span-2">
          <Select value={form.assigned_auditor_id ?? ''} onChange={(e) => set('assigned_auditor_id', e.target.value)}>
            <option value="">Sin asignar</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
          </Select>
        </Field>
        <Field label="Notas internas" className="sm:col-span-2"><Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      {form.id && form.active === false && <p className="mt-3 text-xs text-cafe-500">Desactivar una sucursal no elimina sus auditorías ni su historial; solo impide crear auditorías nuevas.</p>}
      <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>
    </Modal>
  );
}

export default function Branches() {
  const { isAdmin, refreshBranches } = useSession();
  const [rows, setRows] = useState<BranchOverview[] | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; b: Partial<Branch> | null }>({ open: false, b: null });
  const [showInactive, setShowInactive] = useState(false);
  const load = () => branchOverview().then(setRows);
  useEffect(() => { load(); }, []);
  if (!rows) return <Loading />;
  const visible = rows.filter((r) => showInactive || r.active);
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Red de franquicias" title="Sucursales" subtitle={`${rows.filter((r) => r.active).length} activas${rows.some((r) => !r.active) ? ` · ${rows.filter((r) => !r.active).length} inactivas` : ''}`}
        actions={isAdmin && <button className="btn-primary" onClick={() => setEdit({ open: true, b: null })}><Plus className="h-4 w-4" /> Nueva sucursal</button>} />
      {rows.some((r) => !r.active) && (
        <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4" /> Mostrar inactivas</label>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((b) => (
          <Card key={b.id} className={cx('relative transition hover:ring-brand-accent/30', !b.active && 'opacity-60')}>
            <Link to={`/sucursales/${b.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Ver ficha de ${b.name}`} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-cafe-900">{b.name}</h2>
                <div className="mt-1 flex items-center gap-1 text-xs text-cafe-500"><MapPin className="h-3.5 w-3.5" /> {b.address || 'Dirección no cargada'}</div>
                {b.manager_name && <div className="mt-0.5 flex items-center gap-1 text-xs text-cafe-500"><User className="h-3.5 w-3.5" /> {b.manager_name}</div>}
              </div>
              <div className="text-right"><ScorePill score={b.last_score} classification={b.last_score == null ? null : b.last_score >= 90 ? 'EXCELENTE' : b.last_score >= 80 ? 'SATISFACTORIA' : b.last_score >= 70 ? 'EN OBSERVACIÓN' : 'DEFICIENTE'} /><div className="text-[10px] text-cafe-400">última</div></div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-crema-100 py-2"><div className="text-[10px] uppercase text-cafe-500">Última visita</div><div className="text-sm font-semibold">{fmtDate(b.last_audit_date)}</div></div>
              <div className="rounded-xl bg-crema-100 py-2"><div className="text-[10px] uppercase text-cafe-500">Promedio</div><div className="text-sm font-semibold">{fmtScore(b.avg_score)}</div></div>
              <div className="rounded-xl bg-crema-100 py-2"><div className="text-[10px] uppercase text-cafe-500">Pendientes</div><div className={cx('text-sm font-semibold', b.open_nc > 0 && 'text-[#a33b2b]')}>{b.open_nc}</div></div>
            </div>
            {!b.active && <span className="chip mt-3 bg-cafe-800/10 text-cafe-600">Inactiva</span>}
            {isAdmin && (
              <button className="btn-ghost relative z-10 mt-2 -mb-2 px-2 text-xs" onClick={() => setEdit({ open: true, b })}><Pencil className="h-3.5 w-3.5" /> Editar ficha</button>
            )}
          </Card>
        ))}
      </div>
      <BranchForm open={edit.open} branch={edit.b} onClose={() => setEdit({ open: false, b: null })} onSaved={() => { load(); refreshBranches(); }} />
    </div>
  );
}
