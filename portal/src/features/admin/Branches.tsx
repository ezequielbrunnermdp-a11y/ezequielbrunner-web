import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, LocateFixed, Tablet, Plus, Ban, ExternalLink, AlertTriangle } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { getBestFix } from '@/lib/geo';
import { fmtDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, Notice, PageHeader, Select, Sheet, Switch } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useBrands, useBranchesWith, useLegalEntities, useSectors, type Branch } from './scope';

const ST: Record<string, [string, 'warn' | 'ok' | 'neutral']> = { pending_verification: ['A verificar', 'warn'], active: ['Activa', 'ok'], inactive: ['Inactiva', 'neutral'] };

export default function Branches() {
  const branches = useBranchesWith('branches.manage');
  const brands = useBrands();
  const les = useLegalEntities();
  const [sel, setSel] = useState<Branch | 'new' | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader title="Sucursales" subtitle="Datos iniciales editables: verificá cada establecimiento antes de operar." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setSel('new')}>Nueva sucursal</Button>} />
      {branches.isLoading ? <LoadingList /> : !branches.data.length ? <EmptyState icon={<Building2 className="h-5 w-5" />} title="Sin sucursales" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.data.map((b) => {
            const le = les.data?.find((l) => l.id === b.legal_entity_id);
            return (
              <Card key={b.id} as="article" className="p-4">
                <button className="w-full text-left" onClick={() => setSel(b)}>
                  <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{b.name}</p><p className="text-[13px] text-ink-3">{brands.data?.find((x) => x.id === b.brand_id)?.name}</p></div><Badge tone={ST[b.status]![1]}>{ST[b.status]![0]}</Badge></div>
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2"><MapPin className="h-3.5 w-3.5" />{b.address || 'Sin dirección'} · {b.lat != null ? `radio ${b.geofence_radius_m} m` : <span className="text-warn">sin coordenadas</span>}</p>
                  <p className="mt-1 text-xs text-ink-3">{le?.legal_name}{le && !le.verified && ' (a confirmar)'}</p>
                </button>
              </Card>
            );
          })}
        </div>
      )}
      {sel && <BranchSheet branch={sel === 'new' ? null : sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function BranchSheet({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const { ctx, can } = useAuth();
  const toast = useToast();
  const brands = useBrands();
  const les = useLegalEntities();
  const [f, setF] = useState({
    name: branch?.name ?? '', address: branch?.address ?? '', lat: branch?.lat?.toString() ?? '', lng: branch?.lng?.toString() ?? '',
    radius: String(branch?.geofence_radius_m ?? 40), acc: String(branch?.gps_max_accuracy_m ?? 75), require_gps: branch?.require_gps ?? true, require_qr: branch?.require_qr ?? true,
    late: String(branch?.late_tolerance_min ?? 10), early: String(branch?.early_leave_tolerance_min ?? 10), maxh: String(branch?.max_open_hours ?? 14),
    status: branch?.status ?? 'pending_verification', brand: branch?.brand_id ?? '', le: branch?.legal_entity_id ?? '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const [locating, setLocating] = useState(false);
  const useHere = async () => {
    setLocating(true);
    try { const fix = await getBestFix(12000); set('lat', fix.lat.toFixed(6)); set('lng', fix.lng.toFixed(6)); toast(`Ubicación tomada (±${Math.round(fix.accuracy)} m). Verificala en el mapa.`, 'info'); }
    catch (e) { toast(errorMessage(e), 'bad'); } finally { setLocating(false); }
  };
  const save = useAction(async () => {
    const row = {
      name: f.name.trim(), address: f.address.trim() || null, lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null,
      geofence_radius_m: Number(f.radius), gps_max_accuracy_m: Number(f.acc), require_gps: f.require_gps, require_qr: f.require_qr,
      late_tolerance_min: Number(f.late), early_leave_tolerance_min: Number(f.early), max_open_hours: Number(f.maxh), status: f.status,
    };
    const { error } = branch ? await supabase.from('branches').update(row).eq('id', branch.id)
      : await supabase.from('branches').insert({ ...row, organization_id: ctx!.organization!.id, brand_id: f.brand, legal_entity_id: f.le });
    if (error) throw error;
  }, { success: 'Sucursal guardada', invalidate: [['branches']], onDone: onClose });
  const r = Number(f.radius);
  return (
    <Sheet open onClose={onClose} title={branch ? branch.name : 'Nueva sucursal'} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} disabled={!f.name.trim() || (!branch && (!f.brand || !f.le))} onClick={() => save.mutate(undefined)}>Guardar</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Estado"><Select value={f.status} onChange={(e) => set('status', e.target.value)}><option value="pending_verification">A verificar</option><option value="active">Activa</option><option value="inactive">Inactiva</option></Select></Field>
          {!branch && <>
            <Field label="Marca"><Select value={f.brand} onChange={(e) => set('brand', e.target.value)}><option value="">Elegir</option>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Razón social empleadora"><Select value={f.le} onChange={(e) => set('le', e.target.value)}><option value="">Elegir</option>{les.data?.map((l) => <option key={l.id} value={l.id}>{l.legal_name}</option>)}</Select></Field>
          </>}
        </div>
        <Field label="Dirección"><Input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle, número, ciudad" /></Field>
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud"><Input inputMode="decimal" value={f.lat} onChange={(e) => set('lat', e.target.value)} /></Field>
            <Field label="Longitud"><Input inputMode="decimal" value={f.lng} onChange={(e) => set('lng', e.target.value)} /></Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={locating} icon={<LocateFixed className="h-4 w-4" />} onClick={() => void useHere()}>Usar mi ubicación actual</Button>
            {f.lat && f.lng && <a className="inline-flex items-center gap-1 text-sm font-medium text-accent" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lng}#map=19/${f.lat}/${f.lng}`}>Verificar en el mapa <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Radio del perímetro (m)" hint="Sugerencia inicial: 40 m"><Input type="number" min={10} max={2000} value={f.radius} onChange={(e) => set('radius', e.target.value)} /></Field>
          <Field label="Precisión GPS máxima (m)"><Input type="number" min={5} max={5000} value={f.acc} onChange={(e) => set('acc', e.target.value)} /></Field>
        </div>
        {r < 50 && <Notice tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>En interiores el GPS suele tener errores de 20 a 100 m. Un radio chico puede generar muchas revisiones: medilo en la sucursal con varios teléfonos antes de fijarlo.</Notice>}
        <div className="divide-y divide-line/70 rounded-xl border border-line/70 px-4">
          <Switch label="Exigir ubicación" checked={f.require_gps} onChange={(v) => set('require_gps', v)} />
          <Switch label="Exigir QR dinámico" description="Requiere una pantalla o tablet vinculada en modo QR." checked={f.require_qr} onChange={(v) => set('require_qr', v)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tolerancia ingreso (min)"><Input type="number" value={f.late} onChange={(e) => set('late', e.target.value)} /></Field>
          <Field label="Tolerancia salida (min)"><Input type="number" value={f.early} onChange={(e) => set('early', e.target.value)} /></Field>
          <Field label="Jornada abierta máx. (h)"><Input type="number" value={f.maxh} onChange={(e) => set('maxh', e.target.value)} /></Field>
        </div>
        {branch && <SectorsEditor branchId={branch.id} />}
        {branch && can('kiosk.manage') && <Devices branchId={branch.id} />}
      </div>
    </Sheet>
  );
}

function SectorsEditor({ branchId }: { branchId: string }) {
  const { ctx } = useAuth();
  const sectors = useSectors();
  const [name, setName] = useState('');
  const add = useAction(async () => { const { error } = await supabase.from('sectors').insert({ organization_id: ctx!.organization!.id, branch_id: branchId, name: name.trim() }); if (error) throw error; }, { invalidate: [['sectors']], onDone: () => setName('') });
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-ink-2">Sectores</p>
      <div className="flex flex-wrap gap-1.5">{sectors.data?.filter((s) => !s.branch_id || s.branch_id === branchId).map((s) => <Badge key={s.id} tone={s.branch_id ? 'accent' : 'neutral'}>{s.name}</Badge>)}</div>
      <div className="mt-2 flex gap-2"><Input className="h-9" placeholder="Nuevo sector de esta sucursal" value={name} onChange={(e) => setName(e.target.value)} /><Button size="sm" variant="secondary" disabled={name.trim().length < 2} onClick={() => add.mutate(undefined)}>Agregar</Button></div>
    </div>
  );
}

function Devices({ branchId }: { branchId: string }) {
  const q = useQuery({ queryKey: ['devices', branchId], queryFn: async () => {
    const { data, error } = await supabase.from('kiosk_devices').select('id, name, mode, paired_at, last_seen_at, revoked_at, pairing_expires_at, created_at').eq('branch_id', branchId).order('created_at', { ascending: false });
    if (error) throw error; return data as { id: string; name: string; mode: string; paired_at: string | null; last_seen_at: string | null; revoked_at: string | null; pairing_expires_at: string | null }[];
  } });
  const [name, setName] = useState('Tablet mostrador');
  const [mode, setMode] = useState('both');
  const [code, setCode] = useState<{ pairing_code: string; expires_at: string } | null>(null);
  const reg = useAction(() => rpc<{ pairing_code: string; expires_at: string }>('register_kiosk_device', { p_branch: branchId, p_name: name, p_mode: mode }), { invalidate: [['devices', branchId]], onDone: setCode });
  const revoke = useAction((id: string) => rpc('revoke_kiosk_device', { p_device: id }), { success: 'Dispositivo revocado', invalidate: [['devices', branchId]] });
  const MODE: Record<string, string> = { kiosk: 'Tablet de fichaje', qr_display: 'Pantalla de QR', both: 'Tablet + QR' };
  return (
    <div className="rounded-xl border border-line/70 p-4">
      <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><Tablet className="h-4 w-4" />Dispositivos de la sucursal</p>
      <ul className="space-y-2">{q.data?.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
          <div><p className="font-medium">{d.name} <span className="font-normal text-ink-3">· {MODE[d.mode]}</span></p>
            <p className="text-xs text-ink-3">{d.revoked_at ? `Revocado ${fmtDateTime(d.revoked_at)}` : d.paired_at ? `Vinculado · última actividad ${d.last_seen_at ? fmtDateTime(d.last_seen_at) : '—'}` : 'Esperando vinculación'}</p></div>
          {!d.revoked_at && <Button size="sm" variant="ghost" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => { if (confirm('¿Revocar este dispositivo? Dejará de funcionar de inmediato.')) revoke.mutate(d.id); }}>Revocar</Button>}
        </li>
      ))}</ul>
      {code ? (
        <div className="mt-4 rounded-xl bg-accent-soft p-4 text-center">
          <p className="text-sm text-ink-2">En la tablet abrí <strong>{location.origin}/kiosco/vincular</strong> e ingresá:</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.3em]">{code.pairing_code}</p>
          <p className="mt-1 text-xs text-ink-3">Válido hasta {fmtDateTime(code.expires_at)} · un solo uso</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
          <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del dispositivo" />
          <Select className="h-9 text-sm" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Modo">{Object.entries(MODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Button size="sm" loading={reg.isPending} onClick={() => reg.mutate(undefined)}>Vincular nuevo</Button>
        </div>
      )}
    </div>
  );
}
