import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { ALERT_TYPE_LABEL, fmtDateTime } from '../lib/format';
import type { AlertRow, AlertType } from '../lib/types';
import { Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Select, SeverityBadge, Tabs, Textarea } from '../components/ui';

export default function Alerts() {
  const { branches, isStaff } = useSession();
  const [rows, setRows] = useState<AlertRow[] | null>(null);
  const [tab, setTab] = useState<'activas' | 'resueltas'>('activas');
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState('');
  const [resolve, setResolve] = useState<AlertRow | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    await supabase.rpc('refresh_overdue_alerts');
    const { data } = await supabase.from('alerts').select('*, branches(name)').order('created_at', { ascending: false }).limit(500);
    setRows((data as AlertRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);
  if (!rows) return <Loading />;

  const list = rows.filter((a) => (tab === 'activas' ? !a.resolved_at : !!a.resolved_at) && (!branchId || a.branch_id === branchId) && (!type || a.type === type));

  const doResolve = async () => {
    if (!resolve) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('alerts').update({ resolved_at: new Date().toISOString(), resolved_by: u.user?.id, resolution_note: note || null }).eq('id', resolve.id);
    if (error) return setErr(friendlyError(error));
    setResolve(null); setNote(''); load();
  };

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Riesgos" title="Alertas" subtitle="Las alertas críticas se generan por la naturaleza del hecho, no solo por una nota baja, y son independientes del puntaje." />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sucursal"><Select value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Todas</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos</option>{(Object.keys(ALERT_TYPE_LABEL) as AlertType[]).map((t) => <option key={t} value={t}>{ALERT_TYPE_LABEL[t]}</option>)}</Select></Field>
        </div>
      </Card>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'activas', label: 'Activas', count: rows.filter((a) => !a.resolved_at).length }, { value: 'resueltas', label: 'Resueltas', count: rows.filter((a) => a.resolved_at).length }]} />
      {list.length === 0 ? <Empty title={tab === 'activas' ? 'No hay alertas activas' : 'No hay alertas resueltas'} icon={<CheckCircle2 className="h-8 w-8" />} /> : (
        <div className="space-y-2.5">
          {list.map((a) => (
            <div key={a.id} className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${a.severity === 'critica' && !a.resolved_at ? 'ring-2 ring-[#a33b2b]/30' : ''}`}>
              <ShieldAlert className={`h-6 w-6 shrink-0 ${a.severity === 'critica' ? 'text-[#a33b2b]' : 'text-[#b07a1e]'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.branches?.name}</span><SeverityBadge s={a.severity} /><span className="text-xs text-cafe-500">{ALERT_TYPE_LABEL[a.type]}</span></div>
                <div className="mt-1 text-sm">{a.title}</div>
                {a.detail && <div className="text-xs text-cafe-500">{a.detail}</div>}
                <div className="mt-1 text-xs text-cafe-400">Registrada {fmtDateTime(a.created_at)}{a.resolved_at && ` · Resuelta ${fmtDateTime(a.resolved_at)}${a.resolution_note ? ` · ${a.resolution_note}` : ''}`}</div>
              </div>
              <div className="flex gap-2">
                {a.nonconformity_id && <Link to={`/incumplimientos/${a.nonconformity_id}`} className="btn-outline px-3 py-1.5 text-xs">Incumplimiento</Link>}
                {a.audit_id && <Link to={`/auditorias/${a.audit_id}`} className="btn-outline px-3 py-1.5 text-xs">Auditoría</Link>}
                {isStaff && !a.resolved_at && !a.nonconformity_id && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setResolve(a)}>Resolver</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!resolve} onClose={() => setResolve(null)} title="Resolver alerta"
        footer={<><button className="btn-ghost" onClick={() => setResolve(null)}>Cancelar</button><button className="btn-primary" onClick={doResolve} disabled={note.trim().length < 5}>Marcar resuelta</button></>}>
        <p className="mb-3 text-sm text-cafe-600">Las alertas vinculadas a un incumplimiento se resuelven al verificarlo y cerrarlo. Para las demás, documente la resolución.</p>
        <Field label="Nota de resolución"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ErrorBox>{err}</ErrorBox>
      </Modal>
    </div>
  );
}
