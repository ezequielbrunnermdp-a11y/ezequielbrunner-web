import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardEdit, Moon } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAction } from '@/lib/hooks';
import { addDays, durationLabel, fmtDate, fmtDayShort, fmtTime, localDate, zonedToUtc } from '@/lib/format';
import { PUNCH_FLAG, PUNCH_LABEL, PUNCH_STATUS, type PunchKind } from '@/lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, LoadingList, PageHeader, Select, Sheet, Textarea } from '@/components/ui';
import { useClockStatus } from './useClock';

interface Row {
  session_id: string | null; branch_name: string; started_at: string | null; ended_at: string | null; status: string; minutes: number | null;
  shift_starts: string | null; shift_ends: string | null;
  punches: { id: string; kind: PunchKind; server_time: string; status: string; source: string; flags: string[]; declared_time: string | null }[];
}
interface Correction { id: string; kind: PunchKind; requested_time: string; reason: string; status: string; review_note: string | null; created_at: string }

const SOURCE: Record<string, string> = { mobile: 'Celular', kiosk: 'Tablet', manual: 'Supervisada', offline: 'Sin conexión', correction: 'Corrección' };
const tone = (s: string) => (s === 'confirmed' || s === 'closed' || s === 'approved' ? 'ok' : s === 'rejected' ? 'bad' : s === 'open' ? 'info' : 'warn');

export function AttendanceHistoryPage() {
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const from = `${month}-01`;
  const next = addDays(`${month}-28`, 7).slice(0, 7) + '-01';
  const [corr, setCorr] = useState<{ sessionId?: string; punchId?: string; kind?: PunchKind } | null>(null);
  const q = useQuery({ queryKey: ['my-attendance', month], queryFn: () => rpc<Row[]>('my_attendance', { p_from: zonedToUtc(from, '00:00'), p_to: zonedToUtc(next, '00:00') }) });
  const corrections = useQuery({ queryKey: ['my-corrections'], queryFn: async () => {
    const { data, error } = await supabase.from('attendance_corrections').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw error; return data as Correction[];
  } });
  const total = (q.data ?? []).reduce((a, r) => a + (r.minutes ?? 0), 0);
  const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${from}T12:00:00Z`));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/fichaje" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="h-4 w-4" />Fichar</Link>
      <PageHeader title="Historial de fichajes" actions={<Button variant="secondary" icon={<ClipboardEdit className="h-4 w-4" />} onClick={() => setCorr({})}>Solicitar corrección</Button>} />
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" aria-label="Mes anterior" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setMonth(addDays(from, -1).slice(0, 7))} />
        <div className="text-center"><p className="font-semibold first-letter:uppercase">{label}</p><p className="text-xs text-ink-3">{durationLabel(total)} registradas</p></div>
        <Button variant="ghost" size="sm" aria-label="Mes siguiente" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setMonth(next.slice(0, 7))} />
      </div>
      {q.isLoading ? <LoadingList /> : q.isError ? <ErrorState error={q.error} /> : !q.data?.length ? <EmptyState title="Sin registros en este mes" compact /> : (
        <ul className="space-y-3">
          {q.data.map((r, i) => {
            const overnight = r.started_at && r.ended_at && localDate(r.started_at) !== localDate(r.ended_at);
            return (
              <Card as="li" key={r.session_id ?? `p${i}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold first-letter:uppercase">{fmtDayShort(r.started_at ?? r.ended_at!)}</p>
                    <p className="text-[13px] text-ink-3">{r.branch_name}{r.shift_starts && ` · Turno ${fmtTime(r.shift_starts)}–${fmtTime(r.shift_ends!)}`}</p>
                  </div>
                  <Badge tone={tone(r.status)}>{r.session_id ? ({ open: 'En curso', closed: 'Cerrada', needs_review: 'A revisar' } as Record<string, string>)[r.status] : PUNCH_STATUS[r.status]}</Badge>
                </div>
                {r.session_id && (
                  <p className="mt-2 tabular text-lg font-semibold">
                    {r.started_at ? fmtTime(r.started_at) : '—'} → {r.ended_at ? fmtTime(r.ended_at) : '…'}
                    {overnight && <Moon className="ml-1 inline h-4 w-4 text-ink-3" aria-label="Al día siguiente" />}
                    <span className="ml-2 text-sm font-normal text-ink-3">{durationLabel(r.minutes)}</span>
                  </p>
                )}
                <ul className="mt-2 space-y-1">
                  {r.punches.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
                      <span className="tabular font-medium text-ink">{fmtTime(p.declared_time ?? p.server_time)}</span>
                      <span>{PUNCH_LABEL[p.kind]}</span>
                      <span className="text-ink-3">· {SOURCE[p.source]}</span>
                      {p.status !== 'confirmed' && <Badge tone={tone(p.status)}>{PUNCH_STATUS[p.status]}</Badge>}
                      {p.flags.filter((f) => PUNCH_FLAG[f] && f !== 'qr_not_required').map((f) => <Badge key={f}>{PUNCH_FLAG[f]}</Badge>)}
                      {p.declared_time && p.source === 'offline' && <span className="text-2xs text-ink-3">(recibida {fmtTime(p.server_time)})</span>}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setCorr({ sessionId: r.session_id ?? undefined, punchId: r.punches[0]?.id, kind: r.ended_at ? undefined : 'out' })} className="mt-3 text-xs font-medium text-accent">Solicitar corrección</button>
              </Card>
            );
          })}
        </ul>
      )}
      {(corrections.data?.length ?? 0) > 0 && (
        <Card><CardHeader title="Mis solicitudes de corrección" />
          <ul className="divide-y divide-line/70 px-5 pb-2">
            {corrections.data!.map((c) => (
              <li key={c.id} className="py-3 text-sm">
                <div className="flex justify-between gap-2"><span className="font-medium">{PUNCH_LABEL[c.kind]} · {fmtDate(c.requested_time)} {fmtTime(c.requested_time)}</span><Badge tone={tone(c.status)}>{({ pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' } as Record<string, string>)[c.status]}</Badge></div>
                <p className="mt-0.5 text-ink-3">{c.reason}</p>
                {c.review_note && <p className="mt-1 text-xs text-ink-2">Respuesta: {c.review_note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {corr && <CorrectionSheet initial={corr} onClose={() => setCorr(null)} />}
    </div>
  );
}

function CorrectionSheet({ initial, onClose }: { initial: { sessionId?: string; punchId?: string; kind?: PunchKind }; onClose: () => void }) {
  const status = useClockStatus();
  const [branch, setBranch] = useState('');
  const [kind, setKind] = useState<PunchKind>(initial.kind ?? 'in');
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const b = branch || status.data?.branches[0]?.id || '';
  const send = useAction(() => rpc('request_attendance_correction', {
    p_branch: b, p_kind: kind, p_requested_time: zonedToUtc(date, time), p_reason: reason.trim(), p_punch: initial.punchId ?? null, p_session: initial.sessionId ?? null,
  }), { success: 'Solicitud enviada. Un responsable la revisará.', invalidate: [['my-corrections']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Solicitar corrección"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!time || reason.trim().length < 5 || !b} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar</Button></>}>
      <div className="space-y-4">
        <Field label="Sucursal"><Select value={b} onChange={(e) => setBranch(e.target.value)}>{status.data?.branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label="Tipo"><Select value={kind} onChange={(e) => setKind(e.target.value as PunchKind)}>{(Object.keys(PUNCH_LABEL) as PunchKind[]).map((k) => <option key={k} value={k}>{PUNCH_LABEL[k]}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><Input type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Hora real"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Motivo"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Ej.: me olvidé de fichar la salida" /></Field>
        <p className="text-xs text-ink-3">El registro original se conserva. Si se aprueba, se agrega un registro de corrección con la identidad de quien lo aprobó.</p>
      </div>
    </Sheet>
  );
}
