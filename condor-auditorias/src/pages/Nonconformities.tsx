import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Download } from 'lucide-react';
import { useSession } from '../lib/session';
import { listNonconformities, loadQuestionnaire, publishedVersionId } from '../lib/api';
import { uploadEvidence } from '../lib/files';
import { NC_STATUS_LABEL, SEVERITY_LABEL, fmtDate } from '../lib/format';
import type { Category, NcStatus, Nonconformity, Severity } from '../lib/types';
import { NcModal } from '../components/NcModal';
import { usePdf } from '../components/PdfActions';
import { Card, Empty, ErrorBox, Field, Input, Loading, NcStatusBadge, PageHeader, Select, SeverityBadge, Tabs, isOverdue } from '../components/ui';

export default function Nonconformities() {
  const { branches, isStaff } = useSession();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Nonconformity[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [f, setF] = useState({ branchId: params.get('sucursal') ?? '', responsible: '', severity: '', status: '', category: '', dueFrom: '', dueTo: '' });
  const [tab, setTab] = useState<'abiertos' | 'vencidos' | 'verificar' | 'todos'>('abiertos');
  const [create, setCreate] = useState<{ open: boolean; branchId: string }>({ open: false, branchId: '' });
  const pdf = usePdf();

  const load = () => listNonconformities({}).then(setRows);
  useEffect(() => {
    load();
    publishedVersionId().then((v) => { if (v) loadQuestionnaire(v).then(setCats); });
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((n) =>
    (!f.branchId || n.branch_id === f.branchId) && (!f.severity || n.severity === f.severity) && (!f.status || n.status === f.status) &&
    (!f.category || n.categories?.name === f.category) && (!f.responsible || (n.responsible ?? '').toLowerCase().includes(f.responsible.toLowerCase())) &&
    (!f.dueFrom || (n.due_date && n.due_date >= f.dueFrom)) && (!f.dueTo || (n.due_date && n.due_date <= f.dueTo)) &&
    (tab === 'todos' || (tab === 'abiertos' && n.status !== 'cerrado') || (tab === 'vencidos' && isOverdue(n.due_date, n.status)) || (tab === 'verificar' && n.status === 'corregido'))), [rows, f, tab]);

  if (!rows) return <Loading />;
  const catNames = [...new Set(rows.map((r) => r.categories?.name).filter(Boolean))] as string[];

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Planes de acción" title="Seguimiento de incumplimientos"
        subtitle="Acciones correctivas con trazabilidad: registro, corrección informada, verificación y cierre."
        actions={<>
          <button className="btn-outline" onClick={() => pdf.run(async () => (await import('../pdf/generate')).renderNcPdf(f.branchId || null), 'descargar')} disabled={!!pdf.busy}><Download className="h-4 w-4" /> PDF pendientes</button>
          {isStaff && <button className="btn-primary" onClick={() => setCreate({ open: true, branchId: f.branchId || branches.find((b) => b.active)?.id || '' })}><Plus className="h-4 w-4" /> Registrar</button>}
        </>} />
      {pdf.err && <div className="mb-3"><ErrorBox>{pdf.err}</ErrorBox></div>}
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Field label="Sucursal"><Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">Todas</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <Field label="Responsable"><Input value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })} placeholder="Buscar…" /></Field>
          <Field label="Gravedad"><Select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">Todas</option>{(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}</Select></Field>
          <Field label="Estado"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos</option>{(Object.keys(NC_STATUS_LABEL) as NcStatus[]).map((s) => <option key={s} value={s}>{NC_STATUS_LABEL[s]}</option>)}</Select></Field>
          <Field label="Categoría"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Todas</option>{catNames.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Límite desde"><Input type="date" value={f.dueFrom} onChange={(e) => setF({ ...f, dueFrom: e.target.value })} /></Field>
          <Field label="Límite hasta"><Input type="date" value={f.dueTo} onChange={(e) => setF({ ...f, dueTo: e.target.value })} /></Field>
        </div>
      </Card>
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'abiertos', label: 'Abiertos', count: rows.filter((n) => n.status !== 'cerrado').length },
        { value: 'vencidos', label: 'Vencidos', count: rows.filter((n) => isOverdue(n.due_date, n.status)).length },
        { value: 'verificar', label: 'Para verificar', count: rows.filter((n) => n.status === 'corregido').length },
        { value: 'todos', label: 'Todos', count: rows.length },
      ]} />
      {filtered.length === 0 ? <Empty title="No hay incumplimientos para estos filtros" /> : (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <Link key={n.id} to={`/incumplimientos/${n.id}`} className="card flex flex-col gap-2 p-4 transition hover:ring-brand-accent/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{n.branches?.name}</span><SeverityBadge s={n.severity} />{n.attributable_to === 'franquiciante' && <span className="chip bg-[#3d6a8a]/10 text-[#3d6a8a]">Franquiciante</span>}</div>
                <div className="mt-1 text-sm text-cafe-800">{n.description}</div>
                <div className="mt-0.5 text-xs text-cafe-500">{n.categories?.name ?? 'General'}{n.responsible ? ` · ${n.responsible}` : ''} · límite {fmtDate(n.due_date)}{n.audits ? ` · auditoría ${fmtDate(n.audits.visit_date)}` : ''}</div>
              </div>
              <NcStatusBadge s={n.status} overdue={isOverdue(n.due_date, n.status)} />
            </Link>
          ))}
        </div>
      )}
      {create.open && (
        <CreateStandalone branchId={create.branchId} categories={cats} onClose={() => setCreate({ open: false, branchId: '' })} onSaved={load} />
      )}
      {pdf.modal}
    </div>
  );
}

function CreateStandalone({ branchId, categories, onClose, onSaved }: { branchId: string; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const { branches } = useSession();
  return (
    <NcModal open onClose={onClose} branchId={branchId} branchName={branches.find((x) => x.id === branchId)?.name ?? ''} auditId={null} categories={categories}
      branchOptions={branches.filter((x) => x.active)}
      onSaved={async (nc, photos) => {
        for (const p of photos) await uploadEvidence(p, { branchId: nc.branch_id, nonconformityId: nc.id, kind: 'foto' });
        onSaved();
      }} />
  );
}
