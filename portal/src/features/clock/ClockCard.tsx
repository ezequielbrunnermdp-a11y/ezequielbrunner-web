import { Link } from 'react-router-dom';
import { Fingerprint, Clock3, MapPin } from 'lucide-react';
import { Card, Skeleton, cx } from '@/components/ui';
import { durationLabel, fmtDayShort, fmtTime, minutesBetween } from '@/lib/format';
import { readQueue } from '@/lib/offlineQueue';
import { useClockStatus } from './useClock';

/** Acceso destacado al fichaje: visible en Inicio y Horarios. */
export function ClockCard() {
  const { data, isLoading } = useClockStatus();
  const pending = readQueue().length;
  if (isLoading) return <Skeleton className="h-[136px] rounded-2xl" />;
  const open = data?.open_session;
  const next = data?.next_shift;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', open ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent')}>
          <Fingerprint className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          {open ? (
            <>
              <p className="text-[13px] font-medium text-ok">{open.on_break ? 'En descanso' : 'Jornada en curso'}</p>
              <p className="text-lg font-semibold tracking-tight">Desde las {fmtTime(open.started_at)} <span className="text-ink-3">· {durationLabel(minutesBetween(open.started_at, new Date()))}</span></p>
              <p className="flex items-center gap-1 text-[13px] text-ink-3"><MapPin className="h-3.5 w-3.5" />{open.branch_name}</p>
            </>
          ) : next ? (
            <>
              <p className="text-[13px] font-medium text-ink-3">Próximo turno</p>
              <p className="text-lg font-semibold tracking-tight">{fmtDayShort(next.starts_at)} · {fmtTime(next.starts_at)}–{fmtTime(next.ends_at)}</p>
              <p className="flex items-center gap-1 text-[13px] text-ink-3"><MapPin className="h-3.5 w-3.5" />{next.branch_name}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-ink-3">Fichaje</p>
              <p className="text-lg font-semibold tracking-tight">Sin turnos próximos publicados</p>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 border-t border-line/70 bg-surface-2/50 p-3">
        <Link to="/fichaje" className={cx('flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold shadow-sm',
          open ? 'bg-ink text-bg' : 'bg-accent text-accent-ink')}>
          <Fingerprint className="h-4 w-4" />{open ? 'Fichar salida' : 'Fichar ingreso'}
        </Link>
        <Link to="/fichaje/historial" className="flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-ink-2 hover:bg-surface">
          <Clock3 className="h-4 w-4" />Historial
        </Link>
      </div>
      {pending > 0 && <p className="border-t border-line/70 bg-warn-soft px-5 py-2 text-xs font-medium text-warn">Tenés {pending} fichada(s) sin enviar por falta de conexión. No están registradas todavía.</p>}
    </Card>
  );
}
