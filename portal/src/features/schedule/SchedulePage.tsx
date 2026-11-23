import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Moon, Coffee, Repeat, History, CalendarX2, MapPin } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAction } from '@/lib/hooks';
import { addDays, durationLabel, fmtDateTime, fmtDayShort, fmtTime, localDate, minutesBetween, mondayOf, zonedToUtc } from '@/lib/format';
import { Badge, Button, Card, CardHeader, EmptyState, Field, LoadingList, PageHeader, Segmented, Select, Sheet, Textarea, cx } from '@/components/ui';
import type { Shift } from '@/lib/types';
import { ClockCard } from '../clock/ClockCard';

interface DayOff { id: string; day: string; kind: string; notes: string | null }
const OFF: Record<string, string> = { franco: 'Franco', medio_franco: 'Medio franco', vacaciones: 'Vacaciones', licencia: 'Licencia' };
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function SchedulePage() {
  const [view, setView] = useState<'week' | 'history'>('week');
  const [monday, setMonday] = useState(() => mondayOf(localDate()));
  const from = zonedToUtc(monday, '00:00'), to = zonedToUtc(addDays(monday, 7), '00:00');
  const shifts = useQuery({ queryKey: ['my-shifts', monday], queryFn: () => rpc<Shift[]>('my_shifts', { p_from: from, p_to: to }) });
  const offs = useQuery({ queryKey: ['my-days-off', monday], queryFn: () => rpc<DayOff[]>('my_days_off', { p_from: monday, p_to: addDays(monday, 6) }) });
  const [swap, setSwap] = useState<Shift | null>(null);
  const today = localDate();
  const total = (shifts.data ?? []).filter((s) => s.status === 'published').reduce((a, s) => a + minutesBetween(s.starts_at, s.ends_at) - s.break_minutes, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Mis horarios" subtitle="Solo se muestran los turnos publicados por tu empresa." />
      <ClockCard />
      <Segmented value={view} onChange={setView} options={[{ value: 'week', label: 'Semana' }, { value: 'history', label: 'Cambios' }]} />
      {view === 'week' ? (
        <>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setMonday(addDays(monday, -7))} aria-label="Semana anterior" />
            <div className="text-center">
              <p className="text-[15px] font-semibold">{fmtDayShort(zonedToUtc(monday, '12:00'))} – {fmtDayShort(zonedToUtc(addDays(monday, 6), '12:00'))}</p>
              <p className="text-xs text-ink-3">{durationLabel(total)} programadas</p>
            </div>
            <Button variant="ghost" size="sm" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setMonday(addDays(monday, 7))} aria-label="Semana siguiente" />
          </div>
          {shifts.isLoading ? <LoadingList /> : (
            <div className="grid gap-2 lg:grid-cols-7">
              {DAYS.map((label, i) => {
                const date = addDays(monday, i);
                const dayShifts = (shifts.data ?? []).filter((s) => localDate(s.starts_at) === date);
                const off = offs.data?.find((o) => o.day === date);
                const isToday = date === today;
                return (
                  <Card key={date} className={cx('p-3 lg:min-h-[150px]', isToday && 'ring-2 ring-accent/40')}>
                    <div className="mb-2 flex items-baseline justify-between lg:block">
                      <p className={cx('text-xs font-semibold uppercase tracking-wide', isToday ? 'text-accent' : 'text-ink-3')}>{label} {date.slice(8)}</p>
                      {isToday && <span className="text-2xs font-medium text-accent lg:hidden">Hoy</span>}
                    </div>
                    <div className="space-y-2">
                      {off && <div className="flex items-center gap-1.5 rounded-lg bg-ok-soft px-2.5 py-2 text-[13px] font-medium text-ok"><Coffee className="h-3.5 w-3.5" />{OFF[off.kind]}</div>}
                      {dayShifts.map((s) => {
                        const overnight = localDate(s.ends_at) !== date;
                        const cancelled = s.status === 'cancelled';
                        return (
                          <button key={s.id} onClick={() => !cancelled && new Date(s.starts_at) > new Date() && setSwap(s)}
                            className={cx('w-full rounded-lg border px-2.5 py-2 text-left', cancelled ? 'border-dashed border-line text-ink-3 line-through' : 'border-accent/20 bg-accent-soft')}>
                            <p className="tabular text-[15px] font-semibold">{fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}{overnight && <Moon className="ml-1 inline h-3.5 w-3.5 text-ink-3" aria-label="Termina al día siguiente" />}</p>
                            <p className="flex items-center gap-1 truncate text-xs text-ink-2"><MapPin className="h-3 w-3" />{s.branch_name}{s.sector_name ? ` · ${s.sector_name}` : ''}</p>
                            {s.notes && <p className="mt-0.5 truncate text-2xs text-ink-3">{s.notes}</p>}
                          </button>
                        );
                      })}
                      {!off && dayShifts.length === 0 && <p className="py-1 text-[13px] text-ink-3">Sin turno</p>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-xs text-ink-3"><Moon className="inline h-3 w-3" /> indica jornadas que terminan al día siguiente. Tocá un turno futuro para pedir un cambio.</p>
        </>
      ) : <ShiftHistory />}
      {swap && <SwapSheet shift={swap} onClose={() => setSwap(null)} />}
    </div>
  );
}

function ShiftHistory() {
  const q = useQuery({
    queryKey: ['shift-changes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_changes').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data as { id: number; change_type: string; before: { starts_at?: string; ends_at?: string } | null; after: { starts_at?: string; ends_at?: string } | null; created_at: string }[];
    },
  });
  const L: Record<string, string> = { published: 'Publicado', updated: 'Modificado', cancelled: 'Cancelado', swapped: 'Cambio de turno' };
  if (q.isLoading) return <LoadingList />;
  if (!q.data?.length) return <EmptyState icon={<History className="h-5 w-5" />} title="Sin cambios registrados" compact />;
  return (
    <Card><CardHeader title="Historial de horarios" />
      <ul className="divide-y divide-line/70 px-5 pb-2">
        {q.data.map((c) => (
          <li key={c.id} className="py-3 text-sm">
            <div className="flex items-center justify-between"><Badge tone={c.change_type === 'cancelled' ? 'bad' : c.change_type === 'published' ? 'ok' : 'warn'}>{L[c.change_type]}</Badge><span className="text-xs text-ink-3">{fmtDateTime(c.created_at)}</span></div>
            <p className="mt-1.5 tabular text-ink-2">
              {c.before?.starts_at && <span className="line-through opacity-60">{fmtDayShort(c.before.starts_at)} {fmtTime(c.before.starts_at)}–{fmtTime(c.before.ends_at!)}</span>}
              {c.before?.starts_at && c.after?.starts_at && ' → '}
              {c.after?.starts_at && <span>{fmtDayShort(c.after.starts_at)} {fmtTime(c.after.starts_at)}–{fmtTime(c.after.ends_at!)}</span>}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface Candidate { shift_id: string; user_id: string; first_name: string; last_name: string; starts_at: string; ends_at: string }

function SwapSheet({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const c = useQuery({ queryKey: ['swap-candidates', shift.id], queryFn: () => rpc<Candidate[]>('swap_candidates', { p_shift: shift.id }) });
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const sel = c.data?.find((x) => x.shift_id === choice);
  const send = useAction(() => rpc('request_shift_swap', { p_shift: shift.id, p_target_user: sel!.user_id, p_target_shift: sel!.shift_id, p_reason: reason || null }), {
    success: 'Solicitud enviada. Tu compañero y luego un responsable deben aprobarla.', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Solicitar cambio de turno"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon={<Repeat className="h-4 w-4" />} disabled={!sel} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar solicitud</Button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-sm"><p className="text-ink-3">Tu turno</p><p className="font-semibold">{fmtDayShort(shift.starts_at)} · {fmtTime(shift.starts_at)}–{fmtTime(shift.ends_at)}</p></div>
        {c.data?.length === 0 ? <EmptyState icon={<CalendarX2 className="h-5 w-5" />} title="No hay turnos de compañeros para intercambiar" compact /> : (
          <Field label="Intercambiar con">
            <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Elegí un turno</option>
              {c.data?.map((x) => <option key={x.shift_id} value={x.shift_id}>{x.first_name} {x.last_name} — {fmtDayShort(x.starts_at)} {fmtTime(x.starts_at)}–{fmtTime(x.ends_at)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Motivo" optional><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
        <p className="text-xs text-ink-3">El horario publicado no cambia hasta que un responsable apruebe. El sistema verifica superposiciones y descansos.</p>
      </div>
    </Sheet>
  );
}
