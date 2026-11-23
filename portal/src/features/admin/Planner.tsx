import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, Send, Plus, Moon, Coffee, UserPlus } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAction } from '@/lib/hooks';
import { addDays, buildShiftRange, durationLabel, fmtDayShort, fmtTime, localDate, minutesBetween, mondayOf, setTimeZone, zonedToUtc } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, Notice, PageHeader, Select, Sheet, Textarea, cx } from '@/components/ui';
import { useBranchesWith, useSectors } from './scope';

interface Emp { user_id: string; first_name: string; last_name: string; job_title: string; branch_id: string; branch_name: string; status: string }
interface S { id: string; user_id: string; branch_id: string; sector_id: string | null; starts_at: string; ends_at: string; break_minutes: number; notes: string | null; status: 'draft' | 'published' | 'cancelled' }
interface Off { id: string; user_id: string; day: string; kind: string; status: string }
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Planner() {
  const branches = useBranchesWith('schedules.manage');
  const [branchId, setBranchId] = useState('');
  const branch = branches.data.find((b) => b.id === (branchId || branches.data[0]?.id));
  if (branch) setTimeZone(branch.timezone);
  const [monday, setMonday] = useState(() => mondayOf(localDate()));
  const [edit, setEdit] = useState<{ user: Emp; date: string; shift?: S; off?: Off } | null>(null);
  const [extra, setExtra] = useState<Emp[]>([]);
  const [adding, setAdding] = useState(false);
  const bid = branch?.id;
  const from = zonedToUtc(monday, '00:00'), to = zonedToUtc(addDays(monday, 7), '00:00');

  const emps = useQuery({ queryKey: ['admin-employees', bid], enabled: Boolean(bid), queryFn: () => rpc<Emp[]>('admin_employees', { p_branch: bid, p_status: 'active' }) });
  const shifts = useQuery({ queryKey: ['planner-shifts', bid, monday], enabled: Boolean(bid), queryFn: async () => {
    const { data, error } = await supabase.from('shifts').select('*').eq('branch_id', bid!).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled').order('starts_at');
    if (error) throw error; return data as S[];
  } });
  const offs = useQuery({ queryKey: ['planner-offs', bid, monday], enabled: Boolean(bid), queryFn: async () => {
    const { data, error } = await supabase.from('days_off').select('*').eq('branch_id', bid!).gte('day', monday).lte('day', addDays(monday, 6)).neq('status', 'cancelled');
    if (error) throw error; return data as Off[];
  } });
  const inv = [['planner-shifts', bid, monday], ['planner-offs', bid, monday]];
  const publish = useAction(() => rpc<number>('publish_schedule', { p_branch: bid, p_from: monday, p_to: addDays(monday, 6) }), { success: (n) => `${n} turno(s) publicados y notificados`, invalidate: inv });
  const duplicate = useAction(() => rpc<number>('duplicate_week', { p_branch: bid, p_src_monday: addDays(monday, -7), p_dst_monday: monday }), { success: (n) => `${n} turno(s) copiados como borrador`, invalidate: inv });

  // Personas: plantel de la sucursal + quienes tienen turnos acá (otras sucursales) + agregadas manualmente.
  const people = useMemo(() => {
    const map = new Map<string, Emp>();
    emps.data?.forEach((e) => map.set(e.user_id, e));
    extra.forEach((e) => map.set(e.user_id, e));
    return [...map.values()].sort((a, b) => a.last_name.localeCompare(b.last_name));
  }, [emps.data, extra]);
  const strangers = (shifts.data ?? []).filter((s) => !people.some((p) => p.user_id === s.user_id)).map((s) => s.user_id);
  const strangerNames = useQuery({ queryKey: ['names', strangers.join(',')], enabled: strangers.length > 0, queryFn: async () => {
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', strangers);
    return (data ?? []).map((p) => ({ ...p, job_title: 'De otra sucursal', branch_id: '', branch_name: '', status: 'active' })) as Emp[];
  } });
  const rows = [...people, ...(strangerNames.data ?? [])];
  const drafts = shifts.data?.filter((s) => s.status === 'draft').length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Planificador de horarios" subtitle="Los empleados ven sus turnos recién cuando se publican."
        actions={<>
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} loading={duplicate.isPending} onClick={() => duplicate.mutate(undefined)}>Copiar semana anterior</Button>
          <Button icon={<Send className="h-4 w-4" />} disabled={!drafts} loading={publish.isPending} onClick={() => publish.mutate(undefined)}>Publicar {drafts ? `(${drafts})` : ''}</Button>
        </>} />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={bid ?? ''} onChange={(e) => { setBranchId(e.target.value); setExtra([]); }} className="sm:w-72" aria-label="Sucursal">
          {branches.data.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Semana anterior" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setMonday(addDays(monday, -7))} />
          <span className="min-w-[180px] text-center text-sm font-medium">{fmtDayShort(zonedToUtc(monday, '12:00'))} – {fmtDayShort(zonedToUtc(addDays(monday, 6), '12:00'))}</span>
          <Button variant="ghost" size="sm" aria-label="Semana siguiente" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setMonday(addDays(monday, 7))} />
        </div>
        <Button variant="ghost" size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Sumar persona de otra sucursal</Button>
      </div>
      {!branches.data.length ? <EmptyState title="No tenés sucursales para planificar" /> : emps.isLoading || shifts.isLoading ? <LoadingList /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <thead><tr className="bg-surface-2/60 text-xs font-medium text-ink-3">
                <th className="w-48 px-4 py-2.5 text-left">Persona</th>
                {DAYS.map((d, i) => <th key={d} className={cx('px-2 py-2.5 text-left', addDays(monday, i) === localDate() && 'text-accent')}>{d} {addDays(monday, i).slice(8)}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((p) => {
                  const mine = shifts.data?.filter((s) => s.user_id === p.user_id) ?? [];
                  const total = mine.reduce((a, s) => a + minutesBetween(s.starts_at, s.ends_at) - s.break_minutes, 0);
                  return (
                    <tr key={p.user_id}>
                      <td className="px-4 py-2"><p className="truncate font-medium">{p.last_name}, {p.first_name}</p><p className="truncate text-xs text-ink-3">{p.job_title} · {durationLabel(total)}</p></td>
                      {DAYS.map((_, i) => {
                        const date = addDays(monday, i);
                        const day = mine.filter((s) => localDate(s.starts_at) === date);
                        const off = offs.data?.find((o) => o.user_id === p.user_id && o.day === date);
                        return (
                          <td key={date} className="px-1.5 py-1.5 align-top">
                            <div className="space-y-1">
                              {off && <button onClick={() => setEdit({ user: p, date, off })} className="flex w-full items-center gap-1 rounded-lg bg-ok-soft px-2 py-1.5 text-left text-xs font-medium text-ok"><Coffee className="h-3 w-3" />{off.kind === 'medio_franco' ? 'Medio franco' : off.kind === 'franco' ? 'Franco' : off.kind}{off.status === 'draft' && ' ·'}</button>}
                              {day.map((s) => (
                                <button key={s.id} onClick={() => setEdit({ user: p, date, shift: s })}
                                  className={cx('w-full rounded-lg px-2 py-1.5 text-left text-xs', s.status === 'draft' ? 'border border-dashed border-accent/50 bg-surface text-ink' : 'bg-accent-soft text-ink', s.branch_id !== bid && 'opacity-60')}>
                                  <span className="tabular font-semibold">{fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}</span>{localDate(s.ends_at) !== date && <Moon className="ml-0.5 inline h-3 w-3" />}
                                  {s.status === 'draft' && <span className="block text-2xs text-ink-3">Borrador</span>}
                                </button>
                              ))}
                              {!off && <button onClick={() => setEdit({ user: p, date })} className="flex h-7 w-full items-center justify-center rounded-lg text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:opacity-100 focus:opacity-100" aria-label={`Agregar turno ${p.first_name} ${date}`}><Plus className="h-3.5 w-3.5" /></button>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-ink-3">Borde punteado: borrador. <Moon className="inline h-3 w-3" /> termina al día siguiente. Las reglas de horas máximas y descanso son parámetros operativos configurables; no garantizan por sí solos el cumplimiento del convenio.</p>
      {edit && bid && <ShiftEditor branchId={bid} {...edit} onClose={() => setEdit(null)} invalidate={inv} />}
      {adding && <AddPerson onPick={(e) => setExtra((x) => [...x, e])} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ShiftEditor({ branchId, user, date, shift, off, onClose, invalidate }: { branchId: string; user: Emp; date: string; shift?: S; off?: Off; onClose: () => void; invalidate: unknown[][] }) {
  const sectors = useSectors();
  const [mode, setMode] = useState<'shift' | 'franco' | 'medio_franco'>(off ? (off.kind === 'medio_franco' ? 'medio_franco' : 'franco') : 'shift');
  const [day, setDay] = useState(shift ? localDate(shift.starts_at) : date);
  const [start, setStart] = useState(shift ? fmtTime(shift.starts_at) : '09:00');
  const [end, setEnd] = useState(shift ? fmtTime(shift.ends_at) : '17:00');
  const [brk, setBrk] = useState(String(shift?.break_minutes ?? 0));
  const [sector, setSector] = useState(shift?.sector_id ?? '');
  const [notes, setNotes] = useState(shift?.notes ?? '');
  const range = buildShiftRange(day, start, end);
  const hours = minutesBetween(range.startsAt, range.endsAt);
  const save = useAction(async () => {
    if (mode !== 'shift') {
      if (off) { const { error } = await supabase.from('days_off').update({ kind: mode }).eq('id', off.id); if (error) throw error; }
      else {
        const { data: b } = await supabase.from('branches').select('organization_id').eq('id', branchId).single();
        const { error } = await supabase.from('days_off').insert({ organization_id: b!.organization_id, branch_id: branchId, user_id: user.user_id, day, kind: mode, status: 'draft' });
        if (error) throw error;
      }
      return;
    }
    const row = { branch_id: branchId, user_id: user.user_id, starts_at: range.startsAt, ends_at: range.endsAt, break_minutes: Number(brk) || 0, sector_id: sector || null, notes: notes.trim() || null };
    const { error } = shift ? await supabase.from('shifts').update(row).eq('id', shift.id) : await supabase.from('shifts').insert({ ...row, status: 'draft' });
    if (error) throw error;
  }, { success: shift?.status === 'published' ? 'Turno modificado: se notificó a la persona' : 'Guardado como borrador', invalidate: invalidate as never, onDone: onClose });
  const remove = useAction(async () => {
    if (off) { const { error } = off.status === 'draft' ? await supabase.from('days_off').delete().eq('id', off.id) : await supabase.from('days_off').update({ status: 'cancelled' }).eq('id', off.id); if (error) throw error; return; }
    if (!shift) return;
    const { error } = shift.status === 'draft' ? await supabase.from('shifts').delete().eq('id', shift.id) : await supabase.from('shifts').update({ status: 'cancelled' }).eq('id', shift.id);
    if (error) throw error;
  }, { success: 'Listo', invalidate: invalidate as never, onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={`${user.first_name} ${user.last_name}`}
      footer={<>{(shift || off) && <Button variant="ghost" className="mr-auto text-bad" loading={remove.isPending} onClick={() => remove.mutate(undefined)}>{(shift?.status ?? off?.status) === 'published' ? 'Cancelar' : 'Eliminar'}</Button>}
        <Button variant="ghost" onClick={onClose}>Cerrar</Button><Button loading={save.isPending} disabled={mode === 'shift' && hours <= 0} onClick={() => save.mutate(undefined)}>Guardar</Button></>}>
      <div className="space-y-4">
        {shift?.status === 'published' && <Notice tone="info">Este turno ya está publicado: el cambio se notifica y queda en el historial.</Notice>}
        <div className="grid grid-cols-3 gap-2">
          {([['shift', 'Turno'], ['franco', 'Franco'], ['medio_franco', 'Medio franco']] as const).map(([v, l]) => (
            <button key={v} disabled={Boolean(shift) && v !== 'shift'} onClick={() => setMode(v)} aria-pressed={mode === v} className={cx('rounded-xl border py-2 text-sm font-medium disabled:opacity-40', mode === v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2')}>{l}</button>
          ))}
        </div>
        <Field label="Fecha de inicio"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        {mode === 'shift' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ingreso"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="Salida"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
            <p className="text-sm text-ink-2">{durationLabel(hours)}{range.overnight && <Badge className="ml-2"><Moon className="h-3 w-3" />Termina el {fmtDayShort(range.endsAt)}</Badge>}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Descanso (min)"><Input type="number" min={0} max={240} value={brk} onChange={(e) => setBrk(e.target.value)} /></Field>
              <Field label="Sector" optional><Select value={sector} onChange={(e) => setSector(e.target.value)}><option value="">—</option>{sectors.data?.filter((s) => !s.branch_id || s.branch_id === branchId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            </div>
            <Field label="Notas" optional><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-[64px]" /></Field>
          </>
        )}
      </div>
    </Sheet>
  );
}

function AddPerson({ onPick, onClose }: { onPick: (e: Emp) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const all = useQuery({ queryKey: ['admin-employees', 'all', q], queryFn: () => rpc<Emp[]>('admin_employees', { p_query: q, p_status: 'active' }) });
  return (
    <Sheet open onClose={onClose} title="Sumar persona de otra sucursal">
      <p className="mb-3 text-sm text-ink-3">Solo se puede asignar a personas con relación laboral en la misma razón social de la sucursal. La identidad no se duplica.</p>
      <Input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 divide-y divide-line/70">{all.data?.map((e) => (
        <li key={e.user_id}><button className="flex w-full justify-between py-2.5 text-left text-sm" onClick={() => { onPick(e); onClose(); }}><span>{e.last_name}, {e.first_name}</span><span className="text-ink-3">{e.branch_name}</span></button></li>
      ))}</ul>
    </Sheet>
  );
}
