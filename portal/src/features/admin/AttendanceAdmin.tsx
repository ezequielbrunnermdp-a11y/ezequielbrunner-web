import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Check, X, Moon, ShieldAlert, Search, Clock } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDateTime, fmtTime, localDate, zonedToUtc } from '@/lib/format';
import { PUNCH_FLAG, PUNCH_LABEL, type PunchKind } from '@/lib/types';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingList, PageHeader, Segmented, Select, Sheet, Stat, Textarea, cx } from '@/components/ui';
import { useBranchesWith } from './scope';
import type { Kpis } from './AdminDashboard';

interface BoardRow {
  user_id: string; first_name: string | null; last_name: string | null; avatar_path: string | null; branch_id: string; branch_name: string;
  shift_id: string | null; shift_starts: string | null; shift_ends: string | null; session_id: string | null; actual_in: string | null; actual_out: string | null;
  session_status: string | null; state: string; alerts: string[]; pending_punches: number;
}
const STATE: Record<string, [string, 'neutral' | 'info' | 'ok' | 'warn' | 'bad']> = {
  scheduled: ['Programado', 'neutral'], expected: ['Por ingresar', 'info'], missing_punch: ['Sin fichada · a verificar', 'warn'],
  working: ['Trabajando', 'ok'], completed: ['Jornada cerrada', 'neutral'], review: ['A revisar', 'warn'],
};
const ALERT: Record<string, string> = {
  no_punch_after_start: 'No fichó tras el inicio', late: 'Llegada tarde', early_leave: 'Salida anticipada', long_open_session: 'Jornada abierta prolongada',
  no_shift: 'Sin turno programado', not_closed: 'Sin cierre',
};

export default function AttendanceAdmin() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const branches = useBranchesWith('attendance.view');
  const [day, setDay] = useState(localDate());
  const [branch, setBranch] = useState('');
  const [tab, setTab] = useState<'board' | 'pending' | 'corrections' | 'attempts'>('board');
  const [filter, setFilter] = useState('');
  const [manual, setManual] = useState<BoardRow | null | 'new'>(null);
  const [closeRow, setCloseRow] = useState<BoardRow | null>(null);
  const b = branch || null;
  const kpis = useQuery({ queryKey: ['att-kpis', day, b], queryFn: () => rpc<Kpis>('attendance_kpis', { p_day: day, p_branch: b }), refetchInterval: 60_000 });
  const board = useQuery({ queryKey: ['att-board', day, b], queryFn: () => rpc<BoardRow[]>('attendance_board', { p_day: day, p_branch: b }), refetchInterval: 60_000 });

  // Tiempo real: nuevas fichadas actualizan el tablero.
  useEffect(() => {
    const ch = supabase.channel('att-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_punches' }, () => {
      void qc.invalidateQueries({ queryKey: ['att-board'] }); void qc.invalidateQueries({ queryKey: ['att-kpis'] }); void qc.invalidateQueries({ queryKey: ['att-pending'] });
    }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const rows = (board.data ?? []).filter((r) => !filter || `${r.first_name} ${r.last_name}`.toLowerCase().includes(filter.toLowerCase()));
  const k = kpis.data;
  return (
    <div className="space-y-5">
      <PageHeader title="Control de asistencia" subtitle="Las alertas son automáticas y requieren revisión humana: no constituyen sanciones."
        actions={can('attendance.manage') && <Button icon={<Fingerprint className="h-4 w-4" />} onClick={() => setManual('new')}>Fichada supervisada</Button>} />
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Fecha" />
        <Select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales autorizadas</option>
          {branches.data.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </div>
      {k && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Programados" value={k.scheduled} /><Stat label="Con ingreso" value={k.checked_in} tone="ok" /><Stat label="Turno abierto" value={k.working} tone="info" />
          <Stat label="Llegadas tarde" value={k.late} tone={k.late ? 'warn' : undefined} /><Stat label="Sin fichada" value={k.missing} tone={k.missing ? 'warn' : undefined} hint="Pendiente de verificar" />
        </div>
      )}
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'board', label: 'Tablero' }, { value: 'pending', label: 'Fichadas pendientes', count: k?.pending_punches },
        { value: 'corrections', label: 'Correcciones', count: k?.pending_corrections }, { value: 'attempts', label: 'Intentos sospechosos', count: k?.suspicious },
      ]} />
      {tab === 'board' && (
        <>
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><Input className="pl-10" placeholder="Buscar persona" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar persona" /></div>
          {board.isLoading ? <LoadingList /> : board.isError ? <ErrorState error={board.error} /> : !rows.length ? <EmptyState icon={<Clock className="h-5 w-5" />} title="Sin turnos ni fichadas para este día" compact /> : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface-2/60 text-left text-xs font-medium text-ink-3">
                    <tr><th className="px-4 py-2.5">Persona</th><th className="px-3 py-2.5">Sucursal</th><th className="px-3 py-2.5">Programado</th><th className="px-3 py-2.5">Ingreso</th><th className="px-3 py-2.5">Salida</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5" /></tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {rows.map((r) => {
                      const [l, t] = STATE[r.state] ?? [r.state, 'neutral'];
                      const overnight = r.shift_starts && r.shift_ends && localDate(r.shift_starts) !== localDate(r.shift_ends);
                      return (
                        <tr key={`${r.user_id}-${r.branch_id}`} className="align-top">
                          <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar path={r.avatar_path} person={r} size={32} /><span className="font-medium">{r.first_name} {r.last_name}</span></div></td>
                          <td className="px-3 py-3 text-ink-2">{r.branch_name}</td>
                          <td className="px-3 py-3 tabular">{r.shift_starts ? <>{fmtTime(r.shift_starts)}–{fmtTime(r.shift_ends!)}{overnight && <Moon className="ml-1 inline h-3 w-3 text-ink-3" />}</> : <span className="text-ink-3">—</span>}</td>
                          <td className="px-3 py-3 tabular font-medium">{r.actual_in ? fmtTime(r.actual_in) : <span className="text-ink-3">—</span>}</td>
                          <td className="px-3 py-3 tabular font-medium">{r.actual_out ? fmtTime(r.actual_out) : <span className="text-ink-3">—</span>}</td>
                          <td className="px-3 py-3">
                            <Badge tone={t}>{l}</Badge>
                            <div className="mt-1 flex flex-wrap gap-1">{r.alerts.map((a) => <span key={a} className="rounded-md bg-warn-soft px-1.5 py-0.5 text-2xs font-medium text-warn">{ALERT[a] ?? a}</span>)}
                              {r.pending_punches > 0 && <span className="rounded-md bg-info-soft px-1.5 py-0.5 text-2xs font-medium text-info">{r.pending_punches} pendiente(s)</span>}</div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {can('attendance.manage') && (r.session_status === 'open'
                              ? <Button size="sm" variant="ghost" onClick={() => setCloseRow(r)}>Cerrar jornada</Button>
                              : <Button size="sm" variant="ghost" onClick={() => setManual(r)}>Supervisar</Button>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      {tab === 'pending' && <PendingPunches branch={b} />}
      {tab === 'corrections' && <Corrections branch={b} />}
      {tab === 'attempts' && <Attempts branch={b} />}
      {manual && <ManualPunch row={manual === 'new' ? null : manual} defaultBranch={branch || branches.data[0]?.id || ''} onClose={() => setManual(null)} />}
      {closeRow && <CloseSession row={closeRow} onClose={() => setCloseRow(null)} />}
    </div>
  );
}

interface Punch { id: string; user_id: string; branch_id: string; kind: PunchKind; server_time: string; declared_time: string | null; source: string; status: string; flags: string[]; note: string | null; distance_m: number | null; accuracy_m: number | null; geo_result: string | null }

function usePeopleNames(ids: string[]) {
  return useQuery({ queryKey: ['names', ids.sort().join(',')], enabled: ids.length > 0, queryFn: async () => {
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', ids);
    return new Map((data ?? []).map((p) => [p.user_id as string, `${p.first_name} ${p.last_name}`]));
  } });
}

function PendingPunches({ branch }: { branch: string | null }) {
  const q = useQuery({ queryKey: ['att-pending', branch], queryFn: async () => {
    let r = supabase.from('attendance_punches').select('*').eq('status', 'pending_review').order('server_time', { ascending: false }).limit(100);
    if (branch) r = r.eq('branch_id', branch);
    const { data, error } = await r; if (error) throw error; return data as Punch[];
  } });
  const names = usePeopleNames([...new Set(q.data?.map((p) => p.user_id) ?? [])]);
  const [note, setNote] = useState<Record<string, string>>({});
  const review = useAction((v: { id: string; ok: boolean }) => rpc('review_punch', { p_punch: v.id, p_approve: v.ok, p_note: note[v.id] || null }), { success: 'Revisión registrada', invalidate: [['att-pending'], ['att-board'], ['att-kpis']] });
  if (q.isLoading) return <LoadingList />;
  if (!q.data?.length) return <EmptyState icon={<Check className="h-5 w-5" />} title="No hay fichadas pendientes de revisión" compact />;
  return (
    <ul className="space-y-3">
      {q.data.map((p) => (
        <Card as="li" key={p.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{names.data?.get(p.user_id) ?? '…'} · {PUNCH_LABEL[p.kind]}</p>
              <p className="text-sm text-ink-2">Recibida {fmtDateTime(p.server_time)}{p.declared_time && <> · Declarada {fmtDateTime(p.declared_time)}</>}</p>
            </div>
            <div className="flex flex-wrap gap-1">{p.flags.map((f) => <Badge key={f} tone="warn">{PUNCH_FLAG[f] ?? f}</Badge>)}</div>
          </div>
          {p.distance_m != null && <p className="mt-1 text-xs text-ink-3">Distancia estimada {Math.round(p.distance_m)} m · precisión ±{Math.round(p.accuracy_m ?? 0)} m</p>}
          {p.note && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">“{p.note}”</p>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Nota de revisión (opcional)" value={note[p.id] ?? ''} onChange={(e) => setNote((n) => ({ ...n, [p.id]: e.target.value }))} className="h-9 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => review.mutate({ id: p.id, ok: true })}>Validar</Button>
              <Button size="sm" variant="secondary" icon={<X className="h-3.5 w-3.5" />} onClick={() => review.mutate({ id: p.id, ok: false })}>Rechazar</Button>
            </div>
          </div>
        </Card>
      ))}
    </ul>
  );
}

interface Corr { id: string; user_id: string; kind: PunchKind; requested_time: string; reason: string; status: string; created_at: string; branch_id: string }
function Corrections({ branch }: { branch: string | null }) {
  const q = useQuery({ queryKey: ['att-corrections', branch], queryFn: async () => {
    let r = supabase.from('attendance_corrections').select('*').eq('status', 'pending').order('created_at');
    if (branch) r = r.eq('branch_id', branch);
    const { data, error } = await r; if (error) throw error; return data as Corr[];
  } });
  const names = usePeopleNames([...new Set(q.data?.map((p) => p.user_id) ?? [])]);
  const review = useAction((v: { id: string; ok: boolean; note?: string }) => rpc('review_attendance_correction', { p_id: v.id, p_approve: v.ok, p_note: v.note ?? null }), { success: 'Corrección resuelta', invalidate: [['att-corrections'], ['att-board'], ['att-kpis']] });
  if (q.isLoading) return <LoadingList />;
  if (!q.data?.length) return <EmptyState icon={<Check className="h-5 w-5" />} title="No hay correcciones pendientes" compact />;
  return (
    <ul className="space-y-3">{q.data.map((c) => (
      <Card as="li" key={c.id} className="p-4">
        <p className="font-semibold">{names.data?.get(c.user_id) ?? '…'} · {PUNCH_LABEL[c.kind]} a las {fmtDateTime(c.requested_time)}</p>
        <p className="mt-1 text-sm text-ink-2">{c.reason}</p>
        <p className="mt-1 text-xs text-ink-3">Solicitada {fmtDateTime(c.created_at)} · Al aprobar se agrega un registro nuevo; el original se conserva.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => review.mutate({ id: c.id, ok: true })}>Aprobar</Button>
          <Button size="sm" variant="secondary" onClick={() => { const n = prompt('Motivo del rechazo'); if (n) review.mutate({ id: c.id, ok: false, note: n }); }}>Rechazar</Button>
        </div>
      </Card>
    ))}</ul>
  );
}

const ATTEMPT: Record<string, string> = {
  qr_reused: 'QR reutilizado', qr_wrong_branch: 'QR de otra sucursal', qr_invalid: 'QR inválido', qr_expired: 'QR vencido', qr_required: 'Sin QR',
  geo_outside: 'Fuera del perímetro', geo_imprecise: 'Ubicación imprecisa', geo_unavailable: 'Sin ubicación', duplicate_in: 'Ingreso duplicado',
  kiosk_bad_credentials: 'PIN incorrecto en tablet', branch_not_allowed: 'Sucursal no habilitada',
};
function Attempts({ branch }: { branch: string | null }) {
  const q = useQuery({ queryKey: ['att-attempts', branch], queryFn: async () => {
    let r = supabase.from('punch_attempts').select('*').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(200);
    if (branch) r = r.eq('branch_id', branch);
    const { data, error } = await r; if (error) throw error; return data as { id: number; user_id: string | null; reason: string; details: Record<string, unknown>; created_at: string }[];
  } });
  const names = usePeopleNames([...new Set(q.data?.map((p) => p.user_id).filter(Boolean) as string[] ?? [])]);
  if (q.isLoading) return <LoadingList />;
  if (!q.data?.length) return <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="Sin intentos registrados en los últimos 7 días" compact />;
  return (
    <Card className="overflow-hidden"><ul className="divide-y divide-line/70">{q.data.map((a) => (
      <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <div><p className="font-medium">{a.user_id ? names.data?.get(a.user_id) ?? 'Persona' : 'Dispositivo / desconocido'}</p><p className="text-xs text-ink-3">{fmtDateTime(a.created_at)}</p></div>
        <Badge tone={['qr_reused', 'qr_wrong_branch', 'kiosk_bad_credentials', 'qr_invalid'].includes(a.reason) ? 'bad' : 'warn'}>{ATTEMPT[a.reason] ?? a.reason}</Badge>
      </li>
    ))}</ul></Card>
  );
}

function ManualPunch({ row, defaultBranch, onClose }: { row: BoardRow | null; defaultBranch: string; onClose: () => void }) {
  const branches = useBranchesWith('attendance.manage');
  const [branch, setBranch] = useState(row?.branch_id ?? defaultBranch);
  const [user, setUser] = useState(row?.user_id ?? '');
  const [kind, setKind] = useState<PunchKind>(row?.session_status === 'open' ? 'out' : 'in');
  const [reason, setReason] = useState('');
  const people = useQuery({ queryKey: ['admin-employees', branch], enabled: !row, queryFn: () => rpc<{ user_id: string; first_name: string; last_name: string; status: string }[]>('admin_employees', { p_branch: branch, p_status: 'active' }) });
  const go = useAction(() => rpc<{ result: string }>('manual_punch', { p_user: user, p_branch: branch, p_kind: kind, p_reason: reason.trim(), p_client_request_id: crypto.randomUUID() }), {
    success: (r) => (r.result === 'confirmed' ? 'Fichada supervisada registrada' : `No registrada: ${r.result}`), invalidate: [['att-board'], ['att-kpis']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Fichada supervisada"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!user || reason.trim().length < 5} loading={go.isPending} onClick={() => go.mutate(undefined)}>Registrar</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-ink-2">Procedimiento de contingencia (sin teléfono, falla de GPS/QR, sin conexión del empleado). Se registra con la hora del servidor, tu identidad y el motivo.</p>
        {row ? <p className="font-medium">{row.first_name} {row.last_name} · {row.branch_name}</p> : (
          <>
            <Field label="Sucursal"><Select value={branch} onChange={(e) => { setBranch(e.target.value); setUser(''); }}>{branches.data.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
            <Field label="Persona"><Select value={user} onChange={(e) => setUser(e.target.value)}><option value="">Elegir</option>{people.data?.map((p) => <option key={p.user_id} value={p.user_id}>{p.last_name}, {p.first_name}</option>)}</Select></Field>
          </>
        )}
        <Field label="Tipo"><Select value={kind} onChange={(e) => setKind(e.target.value as PunchKind)}>{(Object.keys(PUNCH_LABEL) as PunchKind[]).map((k) => <option key={k} value={k}>{PUNCH_LABEL[k]}</option>)}</Select></Field>
        <Field label="Motivo"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ej.: el empleado no tiene teléfono; verificado en persona" /></Field>
      </div>
    </Sheet>
  );
}

function CloseSession({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const go = useAction(() => rpc('close_session', { p_session: row.session_id, p_ended_at: zonedToUtc(date, time), p_reason: reason.trim() }), { success: 'Jornada cerrada', invalidate: [['att-board'], ['att-kpis']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={`Cerrar jornada de ${row.first_name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!time || reason.trim().length < 5} loading={go.isPending} onClick={() => go.mutate(undefined)}>Cerrar jornada</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-ink-2">Ingreso: {row.actual_in && fmtDateTime(row.actual_in)}. Se agregará una salida administrativa (auditada); no se modifica el ingreso.</p>
        <div className="grid grid-cols-2 gap-3"><Field label="Fecha"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Hora de salida"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field></div>
        <Field label="Motivo"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} className={cx()} /></Field>
      </div>
    </Sheet>
  );
}
