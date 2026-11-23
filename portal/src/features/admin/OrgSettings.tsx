import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building, Palette, ScrollText, Scale, Tags } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { uploadPrivate, uid } from '@/lib/storage';
import { fmtDateTime } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Field, Input, LoadingList, Notice, PageHeader, Segmented, Switch } from '@/components/ui';
import { useBrands, useLegalEntities } from './scope';

export default function OrgSettings() {
  const [tab, setTab] = useState<'general' | 'brands' | 'rules' | 'audit'>('general');
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Configuración de la organización" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'general', label: 'General' }, { value: 'brands', label: 'Marcas y razones sociales' }, { value: 'rules', label: 'Reglas y categorías' }, { value: 'audit', label: 'Auditoría' }]} />
      {tab === 'general' && <General />}
      {tab === 'brands' && <BrandsAndLe />}
      {tab === 'rules' && <Rules />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}

function General() {
  const { ctx, refreshCtx } = useAuth();
  const o = ctx!.organization!;
  const [name, setName] = useState(o.name);
  const [settings, setSettings] = useState({ cross_brand_social: false, require_mfa: true, timezone: 'America/Argentina/Buenos_Aires', ...o.settings });
  const save = useAction(async () => { const { error } = await supabase.from('organizations').update({ name: name.trim(), settings }).eq('id', o.id); if (error) throw error; await refreshCtx(); }, { success: 'Configuración guardada' });
  return (
    <Card className="space-y-4 p-5">
      <Field label="Nombre de la organización"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Zona horaria"><Input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></Field>
      <div className="divide-y divide-line/70 rounded-xl border border-line/70 px-4">
        <Switch label="Vínculos sociales entre marcas" description="Por defecto cada marca es una comunidad separada. Activarlo permite ver perfiles y publicaciones de otras marcas de la organización." checked={Boolean(settings.cross_brand_social)} onChange={(v) => setSettings({ ...settings, cross_brand_social: v })} />
        <Switch label="Exigir MFA para roles administrativos" description="Recomendado. Sin verificación en dos pasos, los permisos de gerencia no se aplican." checked={settings.require_mfa !== false} onChange={(v) => setSettings({ ...settings, require_mfa: v })} />
      </div>
      {settings.require_mfa === false && <Notice tone="warn">Desactivar MFA reduce la protección de datos laborales sensibles.</Notice>}
      <div className="flex justify-end"><Button loading={save.isPending} onClick={() => save.mutate(undefined)}>Guardar</Button></div>
    </Card>
  );
}

function BrandsAndLe() {
  const { ctx } = useAuth();
  const brands = useBrands();
  const les = useLegalEntities();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('');
  const logo = useAction(async (file: File) => {
    if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Formato no admitido');
    const path = await uploadPrivate('branding', `org/${ctx!.organization!.id}/${uid()}-${file.name.replace(/[^a-z0-9.]/gi, '').slice(-30)}`, file, file.type);
    const { error } = await supabase.from('brands').update({ logo_path: path }).eq('id', target); if (error) throw error;
  }, { success: 'Logo actualizado', invalidate: [['brands']] });
  const color = useAction(async (v: { id: string; c: string }) => { const { error } = await supabase.from('brands').update({ accent_color: v.c }).eq('id', v.id); if (error) throw error; }, { invalidate: [['brands']] });
  const [leName, setLeName] = useState('');
  const addLe = useAction(async () => { const { error } = await supabase.from('legal_entities').insert({ organization_id: ctx!.organization!.id, legal_name: leName.trim() }); if (error) throw error; }, { success: 'Razón social agregada', invalidate: [['legal-entities']], onDone: () => setLeName('') });
  const updLe = useAction(async (v: { id: string; patch: Record<string, unknown> }) => { const { error } = await supabase.from('legal_entities').update(v.patch).eq('id', v.id); if (error) throw error; }, { success: 'Guardado', invalidate: [['legal-entities']] });
  return (
    <div className="space-y-4">
      <Card><CardHeader title="Marcas" icon={<Palette className="h-4 w-4" />} subtitle="Los logos oficiales se incorporan sin rediseñar la aplicación" />
        <input ref={fileRef} type="file" hidden accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) logo.mutate(f); e.target.value = ''; }} />
        <ul className="divide-y divide-line/70 px-5 pb-2">{brands.data?.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-medium">{b.name}</p><p className="text-xs text-ink-3">{b.logo_path ? 'Logo cargado' : 'Sin logo'}</p></div>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Color de acento" value={b.accent_color ?? '#8a5a3b'} onChange={(e) => color.mutate({ id: b.id, c: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface" />
              <Button size="sm" variant="secondary" onClick={() => { setTarget(b.id); fileRef.current?.click(); }}>Subir logo</Button>
            </div>
          </li>
        ))}</ul>
      </Card>
      <Card><CardHeader title="Razones sociales" icon={<Building className="h-4 w-4" />} subtitle="Los datos laborales de cada razón social están separados" />
        <ul className="divide-y divide-line/70 px-5">{les.data?.map((l) => (
          <li key={l.id} className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-2"><Input defaultValue={l.legal_name} className="h-9" onBlur={(e) => e.target.value !== l.legal_name && updLe.mutate({ id: l.id, patch: { legal_name: e.target.value.trim() } })} aria-label="Razón social" />
              {l.verified ? <Badge tone="ok">Verificada</Badge> : <Button size="sm" variant="ghost" onClick={() => updLe.mutate({ id: l.id, patch: { verified: true } })}>Marcar verificada</Button>}</div>
            <Input defaultValue={l.cuit ?? ''} placeholder="CUIT (XX-XXXXXXXX-X)" className="h-9" onBlur={(e) => e.target.value !== (l.cuit ?? '') && updLe.mutate({ id: l.id, patch: { cuit: e.target.value.trim() || null } })} aria-label="CUIT" />
          </li>
        ))}</ul>
        <div className="flex gap-2 p-5 pt-2"><Input className="h-9" placeholder="Nueva razón social" value={leName} onChange={(e) => setLeName(e.target.value)} /><Button size="sm" disabled={leName.trim().length < 2} onClick={() => addLe.mutate(undefined)}>Agregar</Button></div>
      </Card>
    </div>
  );
}

function Rules() {
  const { ctx } = useAuth();
  const rules = useQuery({ queryKey: ['labor-rules'], queryFn: async () => { const { data } = await supabase.from('labor_rules').select('*'); return data ?? []; } });
  const cats = useQuery({ queryKey: ['mgmt-categories-admin'], queryFn: async () => { const { data } = await supabase.from('mgmt_categories').select('*').order('sort'); return data ?? []; } });
  const upd = useAction(async (v: { id: string; patch: Record<string, unknown> }) => { const { error } = await supabase.from('labor_rules').update(v.patch).eq('id', v.id); if (error) throw error; }, { success: 'Regla actualizada', invalidate: [['labor-rules']] });
  const toggleCat = useAction(async (v: { id: string; active: boolean }) => { const { error } = await supabase.from('mgmt_categories').update({ active: v.active }).eq('id', v.id); if (error) throw error; }, { invalidate: [['mgmt-categories-admin']] });
  const [cat, setCat] = useState('');
  const addCat = useAction(async () => { const { error } = await supabase.from('mgmt_categories').insert({ organization_id: ctx!.organization!.id, key: `c_${uid().slice(0, 8)}`, name: cat.trim(), sort: 99 }); if (error) throw error; }, { invalidate: [['mgmt-categories-admin']], onDone: () => setCat('') });
  return (
    <div className="space-y-4">
      <Card><CardHeader title="Reglas operativas de horarios" icon={<Scale className="h-4 w-4" />} />
        <div className="space-y-4 p-5 pt-2">
          <Notice tone="warn">Son parámetros configurables (por convenio, categoría y empresa). Configurarlos no equivale a cumplir la normativa laboral: deben validarse con asesoría (LCT y convenio aplicable).</Notice>
          {rules.data?.map((r: { id: string; name: string; agreement: string | null; max_shift_hours: number; min_rest_hours: number }) => (
            <div key={r.id} className="grid gap-3 sm:grid-cols-4">
              <Field label="Nombre"><Input defaultValue={r.name} onBlur={(e) => upd.mutate({ id: r.id, patch: { name: e.target.value } })} /></Field>
              <Field label="Convenio" optional><Input defaultValue={r.agreement ?? ''} onBlur={(e) => upd.mutate({ id: r.id, patch: { agreement: e.target.value || null } })} /></Field>
              <Field label="Máx. horas por turno"><Input type="number" defaultValue={r.max_shift_hours} onBlur={(e) => upd.mutate({ id: r.id, patch: { max_shift_hours: Number(e.target.value) } })} /></Field>
              <Field label="Descanso mín. (h)"><Input type="number" defaultValue={r.min_rest_hours} onBlur={(e) => upd.mutate({ id: r.id, patch: { min_rest_hours: Number(e.target.value) } })} /></Field>
            </div>
          ))}
        </div>
      </Card>
      <Card><CardHeader title="Categorías de “Hablar con gerencia”" icon={<Tags className="h-4 w-4" />} />
        <ul className="divide-y divide-line/70 px-5">{cats.data?.map((c: { id: string; name: string; active: boolean; hr_only: boolean }) => (
          <li key={c.id} className="flex items-center justify-between py-2.5 text-sm"><span>{c.name} {c.hr_only && <Badge className="ml-1">Solo RR. HH.</Badge>}</span><Button size="sm" variant="ghost" onClick={() => toggleCat.mutate({ id: c.id, active: !c.active })}>{c.active ? 'Desactivar' : 'Activar'}</Button></li>
        ))}</ul>
        <div className="flex gap-2 p-5 pt-2"><Input className="h-9" placeholder="Nueva categoría" value={cat} onChange={(e) => setCat(e.target.value)} /><Button size="sm" disabled={cat.trim().length < 2} onClick={() => addCat.mutate(undefined)}>Agregar</Button></div>
      </Card>
    </div>
  );
}

function Audit() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['audit'], enabled: can('audit.view'), queryFn: async () => { const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error; return data as { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, unknown>; created_at: string }[]; } });
  if (!can('audit.view')) return <Notice tone="warn">Tu rol no incluye el permiso de auditoría.</Notice>;
  if (q.isLoading) return <LoadingList />;
  return (
    <Card><CardHeader title="Registro de auditoría" icon={<ScrollText className="h-4 w-4" />} subtitle="Acciones administrativas. Inalterable desde la aplicación." />
      <ul className="divide-y divide-line/70 px-5 pb-2">{q.data?.map((a) => (
        <li key={a.id} className="py-2.5 text-sm"><div className="flex justify-between gap-2"><span className="font-mono text-[13px]">{a.action}</span><span className="text-xs text-ink-3">{fmtDateTime(a.created_at)}</span></div>
          <p className="truncate text-xs text-ink-3">{a.entity} {a.entity_id?.slice(0, 8)} · {JSON.stringify(a.details).slice(0, 120)}</p></li>
      ))}</ul>
    </Card>
  );
}
