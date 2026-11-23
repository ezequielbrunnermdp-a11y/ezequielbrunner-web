import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ClipboardList, Repeat } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDate, fmtDateTime, fmtDayShort, fmtTime } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, PageHeader, Segmented, Select, Sheet, Textarea } from '@/components/ui';

export const HR_TYPES: Record<string, string> = {
  vacation: 'Vacaciones', day_off: 'Día libre', permission: 'Permiso', schedule_change: 'Modificación de horario',
  attendance_correction: 'Corrección de fichaje', data_update: 'Actualización de datos', certificate: 'Certificado', payroll_query: 'Consulta de liquidación',
};
export const HR_STATUS: Record<string, [string, 'warn' | 'ok' | 'bad' | 'neutral']> = {
  pending: ['Pendiente', 'warn'], approved: ['Aprobada', 'ok'], rejected: ['Rechazada', 'bad'], cancelled: ['Cancelada', 'neutral'],
};
const SWAP: Record<string, [string, 'warn' | 'ok' | 'bad' | 'neutral' | 'info']> = {
  pending_peer: ['Esperando al compañero', 'info'], pending_manager: ['Esperando aprobación', 'warn'], approved: ['Aprobado', 'ok'], rejected: ['Rechazado', 'bad'], cancelled: ['Cancelado', 'neutral'],
};

export interface HrRequest { id: string; number: number; type: string; start_date: string | null; end_date: string | null; details: string; status: string; review_note: string | null; created_at: string; reviewed_at: string | null; user_id: string }
export interface Swap { id: string; requester_id: string; requester_name: string; target_user_id: string; target_name: string; status: string; reason: string | null; created_at: string;
  requester_starts: string; requester_ends: string; target_starts: string | null; target_ends: string | null; branch_name: string }

export function RequestsPage() {
  const { ctx } = useAuth();
  const [tab, setTab] = useState<'hr' | 'swaps'>('hr');
  const [creating, setCreating] = useState(false);
  const hr = useQuery({ queryKey: ['my-hr-requests'], queryFn: async () => {
    const { data, error } = await supabase.from('hr_requests').select('*').eq('user_id', ctx!.user_id).order('created_at', { ascending: false });
    if (error) throw error; return data as HrRequest[];
  } });
  const swaps = useQuery({ queryKey: ['my-swaps'], queryFn: async () => (await rpc<Swap[]>('my_swaps')).filter((s) => s.requester_id === ctx!.user_id || s.target_user_id === ctx!.user_id) });
  const cancel = useAction((id: string) => rpc('cancel_hr_request', { p_id: id }), { success: 'Solicitud cancelada', invalidate: [['my-hr-requests']] });
  const respond = useAction((v: { id: string; ok: boolean }) => rpc('respond_shift_swap', { p_id: v.id, p_accept: v.ok }), { success: 'Respuesta enviada', invalidate: [['my-swaps']] });
  const pendingSwaps = swaps.data?.filter((s) => s.status === 'pending_peer' && s.target_user_id === ctx?.user_id).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mis solicitudes" subtitle="Vacaciones, permisos, certificados y cambios de turno"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Nueva solicitud</Button>} />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'hr', label: 'Solicitudes' }, { value: 'swaps', label: 'Cambios de turno', count: pendingSwaps }]} />
      {tab === 'hr' ? (
        hr.isLoading ? <LoadingList /> : !hr.data?.length ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No hiciste solicitudes todavía" action={<Button onClick={() => setCreating(true)}>Nueva solicitud</Button>} />
        ) : (
          <div className="space-y-5">
            {(['pending', 'resolved'] as const).map((grp) => {
              const items = hr.data!.filter((r) => (grp === 'pending' ? r.status === 'pending' : r.status !== 'pending'));
              if (!items.length) return null;
              return (
                <section key={grp}>
                  <h2 className="mb-2 px-1 text-sm font-semibold text-ink-2">{grp === 'pending' ? 'Pendientes' : 'Resueltas'}</h2>
                  <ul className="space-y-2.5">
                    {items.map((r) => (
                      <Card as="li" key={r.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{HR_TYPES[r.type]} <span className="font-normal text-ink-3">#{r.number}</span></p>
                            {r.start_date && <p className="text-sm text-ink-2">{fmtDate(r.start_date + 'T12:00:00')}{r.end_date && r.end_date !== r.start_date ? ` al ${fmtDate(r.end_date + 'T12:00:00')}` : ''}</p>}
                          </div>
                          <Badge tone={HR_STATUS[r.status]![1]}>{HR_STATUS[r.status]![0]}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-ink-2">{r.details}</p>
                        {r.review_note && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]"><span className="font-medium">Respuesta:</span> {r.review_note}</p>}
                        <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
                          <span>Enviada {fmtDateTime(r.created_at)}</span>
                          {r.status === 'pending' && <button className="font-medium text-bad" onClick={() => cancel.mutate(r.id)}>Cancelar</button>}
                        </div>
                      </Card>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : swaps.isLoading ? <LoadingList /> : !swaps.data?.length ? (
        <EmptyState icon={<Repeat className="h-5 w-5" />} title="Sin cambios de turno" description="Podés pedir un cambio tocando un turno futuro en Horarios." compact />
      ) : (
        <ul className="space-y-2.5">
          {swaps.data.map((s) => {
            const incoming = s.target_user_id === ctx?.user_id;
            return (
              <Card as="li" key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{incoming ? `${s.requester_name} te pidió un cambio` : `Pediste un cambio a ${s.target_name}`}</p>
                  <Badge tone={SWAP[s.status]![1]}>{SWAP[s.status]![0]}</Badge>
                </div>
                <p className="mt-1 text-sm tabular text-ink-2">
                  {`${fmtDayShort(s.requester_starts)} ${fmtTime(s.requester_starts)}–${fmtTime(s.requester_ends)}`}
                  {s.target_starts && ` ⇄ ${fmtDayShort(s.target_starts)} ${fmtTime(s.target_starts)}–${fmtTime(s.target_ends!)}`}
                  <span className="text-ink-3"> · {s.branch_name}</span>
                </p>
                {s.reason && <p className="mt-1 text-sm text-ink-3">{s.reason}</p>}
                {incoming && s.status === 'pending_peer' && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => respond.mutate({ id: s.id, ok: true })}>Aceptar</Button>
                    <Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: s.id, ok: false })}>Rechazar</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </ul>
      )}
      {creating && <NewRequest onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewRequest({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState('vacation');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [details, setDetails] = useState('');
  const needsDates = ['vacation', 'day_off', 'permission', 'schedule_change'].includes(type);
  const send = useAction(() => rpc('create_hr_request', { p_type: type, p_start: start || null, p_end: end || start || null, p_details: details.trim() }), {
    success: 'Solicitud enviada', invalidate: [['my-hr-requests'], ['my-requests-pending']], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title="Nueva solicitud"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={details.trim().length < 3 || (needsDates && !start)} loading={send.isPending} onClick={() => send.mutate(undefined)}>Enviar</Button></>}>
      <div className="space-y-4">
        <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(HR_TYPES).filter(([k]) => k !== 'attendance_correction').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        {needsDates && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Hasta" optional><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
        )}
        <Field label="Detalle"><Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000}
          placeholder={type === 'data_update' ? 'Indicá qué dato hay que corregir' : type === 'certificate' ? 'Qué certificado necesitás y para qué' : 'Contanos lo necesario'} /></Field>
        <p className="text-xs text-ink-3">Para corregir un fichaje usá Fichar → Historial → Solicitar corrección.</p>
      </div>
    </Sheet>
  );
}
