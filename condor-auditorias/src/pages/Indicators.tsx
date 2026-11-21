import { useEffect, useMemo, useState } from 'react';
import { Upload, Plus, FileDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { readTabular, parseNumber, normalizeKey } from '../lib/tabular';
import { downloadBlob } from '../lib/files';
import { fmtMoney, fmtNumber, monthLabel } from '../lib/format';
import type { CommercialIndicator } from '../lib/types';
import { Card, Empty, ErrorBox, Field, Input, Loading, Modal, Notice, PageHeader, Select, Textarea } from '../components/ui';

const FIELDS: { key: keyof CommercialIndicator; label: string; money?: boolean; int?: boolean; aliases: string[] }[] = [
  { key: 'sales', label: 'Ventas mensuales', money: true, aliases: ['ventas', 'ventas_mensuales', 'venta'] },
  { key: 'tickets', label: 'Cantidad de tickets', int: true, aliases: ['tickets', 'cantidad_de_tickets', 'cant_tickets'] },
  { key: 'cmv', label: 'CMV', money: true, aliases: ['cmv', 'costo_mercaderia_vendida'] },
  { key: 'factory_purchases', label: 'Compras a fábrica', money: true, aliases: ['compras_a_fabrica', 'compras_fabrica', 'compras'] },
  { key: 'waste_units', label: 'Desperdicio (unidades)', aliases: ['desperdicio', 'desperdicio_unidades', 'merma_unidades'] },
  { key: 'waste_value', label: 'Valor de merma', money: true, aliases: ['valor_merma', 'merma', 'merma_valor', 'desperdicio_valor'] },
  { key: 'discounts', label: 'Descuentos', money: true, aliases: ['descuentos'] },
  { key: 'credit_notes', label: 'Notas de crédito', money: true, aliases: ['notas_de_credito', 'notas_credito', 'nc'] },
  { key: 'voids', label: 'Anulaciones', money: true, aliases: ['anulaciones'] },
  { key: 'internal_consumption', label: 'Consumos internos', money: true, aliases: ['consumos_internos', 'consumo_interno'] },
];

const TEMPLATE = 'sucursal;periodo;ventas;tickets;cmv;compras_a_fabrica;desperdicio_unidades;valor_merma;descuentos;notas_de_credito;anulaciones;consumos_internos;productos_mas_vendidos\n';

export default function Indicators() {
  const { branches, isStaff } = useSession();
  const [rows, setRows] = useState<CommercialIndicator[] | null>(null);
  const [branchId, setBranchId] = useState('');
  const [edit, setEdit] = useState<Partial<CommercialIndicator> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => supabase.from('commercial_indicators').select('*').order('period', { ascending: false }).then(({ data }) => setRows((data as CommercialIndicator[]) ?? []));
  useEffect(() => { load(); }, []);

  const list = useMemo(() => (rows ?? []).filter((r) => !branchId || r.branch_id === branchId), [rows, branchId]);
  const chart = useMemo(() => {
    const months = [...new Set(list.map((r) => r.period.slice(0, 7)))].sort().slice(-12);
    return months.map((m) => {
      const xs = list.filter((r) => r.period.startsWith(m));
      return { mes: monthLabel(m), Ventas: xs.reduce((s, r) => s + Number(r.sales ?? 0), 0), Merma: xs.reduce((s, r) => s + Number(r.waste_value ?? 0), 0) };
    });
  }, [list]);
  const bname = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  const save = async () => {
    if (!edit?.branch_id || !edit.period) return setErr('Seleccione sucursal y período.');
    setBusy(true); setErr(null);
    const payload: Record<string, unknown> = { branch_id: edit.branch_id, period: edit.period.slice(0, 7) + '-01', top_products: edit.top_products || null, notes: edit.notes || null, source: 'manual' };
    FIELDS.forEach((f) => { payload[f.key] = edit[f.key] === '' || edit[f.key] == null ? null : Number(edit[f.key]); });
    const { error } = await supabase.from('commercial_indicators').upsert(payload, { onConflict: 'branch_id,period' });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    setEdit(null); load();
  };

  const importFile = async (file: File) => {
    setImportMsg(null); setErr(null); setBusy(true);
    try {
      const data = await readTabular(file);
      const byName = new Map(branches.map((b) => [normalizeKey(b.name), b.id]));
      const ok: Record<string, unknown>[] = [];
      const bad: string[] = [];
      data.forEach((raw, i) => {
        const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [normalizeKey(k), v]));
        const bid = byName.get(normalizeKey(String(r.sucursal ?? '')));
        const per = String(r.periodo ?? r.mes ?? '').trim();
        const m = /^(\d{4})-(\d{1,2})/.exec(per) ?? /^(\d{1,2})\/(\d{4})$/.exec(per);
        if (!bid || !m) { bad.push(`fila ${i + 2}`); return; }
        const [y, mo] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]];
        const row: Record<string, unknown> = { branch_id: bid, period: `${y}-${mo.padStart(2, '0')}-01`, source: 'importacion', top_products: r.productos_mas_vendidos ? String(r.productos_mas_vendidos) : null };
        FIELDS.forEach((f) => { const a = f.aliases.find((al) => r[al] != null && r[al] !== ''); row[f.key] = a ? parseNumber(r[a]) : null; });
        ok.push(row);
      });
      if (ok.length) {
        const { error } = await supabase.from('commercial_indicators').upsert(ok, { onConflict: 'branch_id,period' });
        if (error) throw error;
      }
      setImportMsg(`Se importaron ${ok.length} registro(s).${bad.length ? ` Se omitieron ${bad.length} fila(s) con sucursal o período no reconocidos (${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''}).` : ''}`);
      load();
    } catch (e) {
      setErr(`No se pudo importar: ${friendlyError(e)}`);
    } finally { setBusy(false); }
  };

  if (!rows) return <Loading />;
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Módulo opcional" title="Indicadores comerciales" subtitle="Carga manual o importación CSV/XLSX. No hay integraciones automáticas activas con sistemas externos."
        actions={isStaff && <>
          <button className="btn-ghost" onClick={() => downloadBlob(new Blob(['﻿' + TEMPLATE], { type: 'text/csv' }), 'plantilla_indicadores.csv')}><FileDown className="h-4 w-4" /> Plantilla</button>
          <label className="btn-outline cursor-pointer"><Upload className="h-4 w-4" /> Importar<input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} /></label>
          <button className="btn-primary" onClick={() => setEdit({ branch_id: branchId || branches[0]?.id, period: new Date().toISOString().slice(0, 7) })}><Plus className="h-4 w-4" /> Cargar período</button>
        </>} />
      {importMsg && <div className="mb-4"><Notice tone="ok">{importMsg}</Notice></div>}
      <ErrorBox>{err}</ErrorBox>
      <Card className="mb-4"><Field label="Sucursal" className="max-w-xs"><Select value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Todas</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field></Card>
      {list.length === 0 ? <Empty title="No hay indicadores cargados">Cargue los datos manualmente o importe un archivo con la plantilla.</Empty> : (
        <>
          <Card className="mb-5" title="Ventas y merma por mes">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#eee3d0" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#7a5c42' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#7a5c42' }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)} M`} />
                  <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Ventas" fill="#2e2016" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Merma" fill="#b08d3e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="table-base min-w-[980px]">
                <thead><tr><th>Sucursal</th><th>Período</th><th className="text-right">Ventas</th><th className="text-right">Tickets</th><th className="text-right">Ticket prom.</th><th className="text-right">CMV</th><th className="text-right">Compras fábrica</th><th className="text-right">Merma</th><th className="text-right">Desc. / NC / Anul.</th><th>Origen</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className={isStaff ? 'cursor-pointer hover:bg-crema-100' : ''} onClick={() => isStaff && setEdit({ ...r, period: r.period.slice(0, 7) })}>
                      <td className="font-semibold">{bname(r.branch_id)}</td>
                      <td>{monthLabel(r.period.slice(0, 7))}</td>
                      <td className="text-right tabular-nums">{fmtMoney(r.sales)}</td>
                      <td className="text-right tabular-nums">{fmtNumber(r.tickets)}</td>
                      <td className="text-right tabular-nums">{fmtMoney(r.avg_ticket)}</td>
                      <td className="text-right tabular-nums">{fmtMoney(r.cmv)}{r.cmv != null && r.sales ? <div className="text-[10px] text-cafe-400">{fmtNumber((r.cmv / r.sales) * 100, 1)} %</div> : null}</td>
                      <td className="text-right tabular-nums">{fmtMoney(r.factory_purchases)}</td>
                      <td className="text-right tabular-nums">{fmtMoney(r.waste_value)}{r.waste_units != null && <div className="text-[10px] text-cafe-400">{fmtNumber(r.waste_units)} u.</div>}</td>
                      <td className="text-right text-xs tabular-nums">{fmtMoney(r.discounts)} / {fmtMoney(r.credit_notes)} / {fmtMoney(r.voids)}</td>
                      <td className="text-xs">{r.source === 'importacion' ? 'Importado' : r.source === 'integracion' ? 'Integración' : 'Manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Indicadores del período" wide
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy}>Guardar</button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sucursal"><Select value={edit.branch_id ?? ''} onChange={(e) => setEdit({ ...edit, branch_id: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Período (mes)"><Input type="month" value={edit.period ?? ''} onChange={(e) => setEdit({ ...edit, period: e.target.value })} /></Field>
            <Field label="Ticket promedio"><Input disabled value={edit.sales && edit.tickets ? fmtMoney(Number(edit.sales) / Number(edit.tickets)) : 'Se calcula'} /></Field>
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input type="number" step="any" inputMode="decimal" value={(edit[f.key] as number | string | null | undefined) ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
              </Field>
            ))}
            <Field label="Productos más vendidos" className="sm:col-span-3"><Textarea rows={2} value={edit.top_products ?? ''} onChange={(e) => setEdit({ ...edit, top_products: e.target.value })} /></Field>
            <Field label="Notas" className="sm:col-span-3"><Input value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
        <ErrorBox>{err}</ErrorBox>
      </Modal>
    </div>
  );
}
