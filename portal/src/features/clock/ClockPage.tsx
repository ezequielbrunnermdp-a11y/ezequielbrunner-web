import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  MapPin, QrCode, CheckCircle2, AlertTriangle, Clock3, LocateFixed, Camera, RotateCcw, WifiOff, ShieldAlert, ChevronRight, CircleDashed, History, XCircle,
} from 'lucide-react';
import { rpc } from '@/lib/supabase';
import { getBestFix, type Fix } from '@/lib/geo';
import { parseQrPayload, startScanner, type Scanner } from '@/lib/qrScanner';
import { enqueue, flushQueue, readQueue } from '@/lib/offlineQueue';
import { errorMessage } from '@/lib/errors';
import { useOnline } from '@/lib/hooks';
import { durationLabel, fmtDateTime, fmtTime, minutesBetween } from '@/lib/format';
import { PUNCH_FLAG, PUNCH_LABEL, type PunchKind, type PunchResult } from '@/lib/types';
import { Button, Card, Field, Notice, PageHeader, Select, Spinner, Textarea, cx } from '@/components/ui';
import { useClockStatus } from './useClock';

type Step = 'setup' | 'locating' | 'scan' | 'sending' | 'result';
type GeoState = { status: 'idle' | 'ok' | 'denied' | 'unavailable' | 'unsupported'; fix?: Fix };

/**
 * Fichaje móvil. La interfaz guía; el SERVIDOR decide. Una fichada solo se
 * muestra como confirmada cuando clock_punch responde result = "confirmed".
 */
export function ClockPage() {
  const status = useClockStatus();
  const qc = useQueryClient();
  const online = useOnline();
  const [params, setParams] = useSearchParams();
  const [step, setStep] = useState<Step>('setup');
  const [kind, setKind] = useState<PunchKind>('in');
  const [branchId, setBranchId] = useState('');
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [result, setResult] = useState<PunchResult | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const requestId = useRef<string>(crypto.randomUUID());
  const [queued, setQueued] = useState(readQueue().length);

  const s = status.data;
  const branch = useMemo(() => s?.branches.find((b) => b.id === branchId), [s, branchId]);

  // Valores iniciales según la jornada abierta o el próximo turno.
  useEffect(() => {
    if (!s || branchId) return;
    setKind(s.open_session ? (s.open_session.on_break ? 'break_end' : 'out') : 'in');
    setBranchId(s.open_session?.branch_id ?? s.next_shift?.branch_id ?? s.branches[0]?.id ?? '');
  }, [s, branchId]);

  // QR escaneado con la cámara del teléfono (enlace con ?b=&t=): se toma y se limpia de la URL.
  useEffect(() => {
    const b = params.get('b'), t = params.get('t');
    if (b && t) {
      setBranchId(b); setQrToken(t);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // Envío diferido de fichadas declaradas sin conexión (quedan pendientes de revisión).
  useEffect(() => {
    if (!online || !readQueue().length) return;
    void flushQueue(async (p) => {
      await rpc('clock_punch', { p_kind: p.kind, p_branch_id: p.branchId, p_client_request_id: p.clientRequestId, p_declared_time: p.declaredAt, p_note: p.note ?? 'Declarada sin conexión' });
    }).then((n) => { setQueued(readQueue().length); if (n) void qc.invalidateQueries({ queryKey: ['clock-status'] }); });
  }, [online, qc]);

  const reset = useCallback(() => {
    requestId.current = crypto.randomUUID();
    setStep('setup'); setResult(null); setQrToken(null); setGeo({ status: 'idle' }); setNetError(null); setNote('');
  }, []);

  const send = useCallback(async (opts: { review?: boolean; token?: string | null; fix?: Fix } = {}) => {
    setStep('sending'); setNetError(null);
    const fix = opts.fix ?? geo.fix;
    try {
      const r = await rpc<PunchResult>('clock_punch', {
        p_kind: kind, p_branch_id: branchId, p_qr_token: opts.token ?? qrToken, p_lat: fix?.lat ?? null, p_lng: fix?.lng ?? null,
        p_accuracy: fix?.accuracy ?? null, p_client_request_id: requestId.current, p_request_review: Boolean(opts.review), p_note: note.trim() || null,
      });
      setResult(r);
      setStep('result');
      if (['confirmed', 'pending_review', 'duplicate'].includes(r.result)) {
        void qc.invalidateQueries({ queryKey: ['clock-status'] });
        void qc.invalidateQueries({ queryKey: ['my-attendance'] });
      }
    } catch (e) {
      setNetError(errorMessage(e));
      setStep('result');
      setResult(null);
    }
  }, [kind, branchId, qrToken, geo.fix, note, qc]);

  const locate = async () => {
    setStep('locating');
    try {
      const fix = await getBestFix();
      setGeo({ status: 'ok', fix });
      return fix;
    } catch (e) {
      const code = (e as { code?: number | string }).code;
      setGeo({ status: code === 1 ? 'denied' : code === 'unsupported' ? 'unsupported' : 'unavailable' });
      return undefined;
    } finally {
      setStep('setup');
    }
  };

  const start = async () => {
    if (!online) return;
    let fix = geo.fix;
    if (branch?.require_gps && geo.status === 'idle') fix = await locate();
    if (branch?.require_qr && !qrToken) { setStep('scan'); return; }
    void send({ fix });
  };

  const onScanned = (text: string) => {
    const p = parseQrPayload(text);
    if (!p) return false;
    if (s?.branches.some((b) => b.id === p.branchId)) setBranchId(p.branchId);
    setQrToken(p.token);
    void send({ token: p.token });
    return true;
  };

  const saveOffline = () => {
    enqueue({ clientRequestId: requestId.current, kind, branchId, branchName: branch?.name ?? '', declaredAt: new Date().toISOString(), note: note.trim() || undefined });
    setQueued(readQueue().length);
    reset();
  };

  if (status.isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (status.isError) return <Notice tone="bad" title="No pudimos cargar tu estado">{errorMessage(status.error)}</Notice>;
  if (!s?.branches.length) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Fichar" />
        <Notice tone="warn" title="No tenés una sucursal habilitada para fichar">Consultá con tu encargado. Podés registrar la asistencia de forma supervisada.</Notice>
      </div>
    );
  }

  const open = s.open_session;
  const kinds: PunchKind[] = open ? (open.on_break ? ['break_end', 'out'] : ['out', 'break_start']) : ['in'];

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Fichar" subtitle={<span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Se registra con la hora del servidor</span>}
        actions={<Link to="/fichaje/historial"><Button variant="ghost" size="sm" icon={<History className="h-4 w-4" />}>Historial</Button></Link>} />

      {queued > 0 && (
        <Notice tone="warn" icon={<WifiOff className="h-4 w-4" />} title={`${queued} fichada(s) guardada(s) sin conexión`}>
          No están registradas. Se enviarán automáticamente al reconectar y quedarán pendientes de revisión.
        </Notice>
      )}

      {step === 'scan' ? (
        <QrStep onCode={onScanned} onCancel={() => setStep('setup')} />
      ) : step === 'sending' ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center" aria-live="polite">
          <Spinner className="h-8 w-8" />
          <p className="mt-4 font-medium">Registrando en el servidor…</p>
          <p className="mt-1 text-sm text-ink-3">No cierres la aplicación.</p>
        </Card>
      ) : step === 'result' ? (
        <ResultView result={result} netError={netError} kind={kind} note={note} setNote={setNote}
          onReview={() => void send({ review: true })} onRelocate={() => void locate().then((fix) => send({ fix }))} onRescan={() => { setQrToken(null); setStep('scan'); }} onRetry={() => void send()}
          onOffline={saveOffline} onDone={reset} />
      ) : (
        <div className="mt-4 space-y-4">
          {open && (
            <Card className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ok-soft text-ok"><CircleDashed className="h-5 w-5" /></span>
              <div className="text-sm"><p className="font-medium">Jornada abierta desde las {fmtTime(open.started_at)}</p><p className="text-ink-3">{open.branch_name} · {durationLabel(minutesBetween(open.started_at, new Date()))}</p></div>
            </Card>
          )}
          <Card className="space-y-4 p-5">
            {kinds.length > 1 && (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de fichada">
                {kinds.map((k) => (
                  <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={cx('rounded-xl border px-3 py-3 text-sm font-medium', kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2')}>
                    {PUNCH_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
            <Field label="Sucursal" htmlFor="branch">
              <Select id="branch" value={branchId} onChange={(e) => { setBranchId(e.target.value); setQrToken(null); }} disabled={Boolean(open) && kind !== 'in'}>
                {s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <ul className="space-y-2.5 text-sm">
              {branch?.require_gps && (
                <li className="flex items-center gap-3">
                  <MapPin className={cx('h-4 w-4', geo.status === 'ok' ? 'text-ok' : 'text-ink-3')} />
                  <span className="flex-1">
                    {geo.status === 'ok' ? <>Ubicación obtenida <span className="text-ink-3">(precisión ±{Math.round(geo.fix!.accuracy)} m)</span></>
                      : geo.status === 'denied' ? <span className="text-warn">Permiso de ubicación denegado</span>
                      : geo.status === 'unavailable' ? <span className="text-warn">No se pudo obtener la ubicación</span>
                      : geo.status === 'unsupported' ? <span className="text-warn">El dispositivo no informa ubicación</span>
                      : 'Se verificará tu ubicación solo en este momento'}
                  </span>
                  {geo.status !== 'idle' && <button className="text-xs font-medium text-accent" onClick={() => void locate()}>Reintentar</button>}
                </li>
              )}
              {branch?.require_qr && (
                <li className="flex items-center gap-3"><QrCode className={cx('h-4 w-4', qrToken ? 'text-ok' : 'text-ink-3')} />
                  <span>{qrToken ? 'Código QR leído' : 'Escaneá el QR de la pantalla de la sucursal'}</span></li>
              )}
              {!branch?.has_coordinates && branch?.require_gps && <li className="text-xs text-warn">Esta sucursal aún no tiene coordenadas configuradas: la fichada quedará para revisión.</li>}
            </ul>
            {(geo.status === 'denied') && (
              <Notice tone="warn" icon={<ShieldAlert className="h-4 w-4" />}>Para habilitarla: Ajustes del teléfono → navegador → Ubicación → Permitir. También podés continuar y pedir revisión, o fichar en la tablet de la sucursal.</Notice>
            )}
            {!online && <Notice tone="warn" icon={<WifiOff className="h-4 w-4" />} title="Sin conexión">No es posible confirmar la fichada ahora. Podés guardarla como pendiente o usar la tablet de la sucursal.</Notice>}
            {online ? (
              <Button size="lg" block loading={step === 'locating'} onClick={() => void start()} icon={step === 'locating' ? undefined : branch?.require_qr && !qrToken ? <Camera className="h-5 w-5" /> : <LocateFixed className="h-5 w-5" />}>
                {step === 'locating' ? 'Obteniendo ubicación…' : `Registrar ${PUNCH_LABEL[kind].toLowerCase()}`}
              </Button>
            ) : (
              <Button size="lg" block variant="secondary" icon={<WifiOff className="h-5 w-5" />} onClick={saveOffline}>Guardar como pendiente</Button>
            )}
          </Card>
          <p className="px-1 text-xs leading-relaxed text-ink-3">
            La ubicación se usa únicamente para verificar esta fichada; no hay seguimiento continuo. Si tenés inconvenientes, pedile a tu encargado una fichada supervisada.
          </p>
        </div>
      )}
    </div>
  );
}

function QrStep({ onCode, onCancel }: { onCode: (text: string) => boolean; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    let scanner: Scanner | null = null;
    let done = false;
    void startScanner(video.current!, (text) => {
      if (done) return;
      if (cb.current(text)) { done = true; scanner?.stop(); } else setInvalid(true);
    }, (e) => setError(e.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Habilitalo en los ajustes del navegador.' : 'No se pudo abrir la cámara.')).then((s) => { scanner = s; if (done) s.stop(); });
    return () => { done = true; scanner?.stop(); };
  }, []);
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="relative aspect-square bg-black">
        <video ref={video} className="h-full w-full object-cover" muted playsInline aria-label="Vista de la cámara" />
        <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-[3px] border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</div>}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-center text-sm text-ink-2">Apuntá al código QR de la pantalla de la sucursal. Cambia cada 30 segundos.</p>
        {invalid && <p className="text-center text-xs text-warn">Ese código no corresponde a una pantalla de fichaje.</p>}
        <Button variant="secondary" block onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  );
}

const MESSAGES: Record<string, { title: string; text: string; tone: 'warn' | 'bad' }> = {
  qr_required: { title: 'Falta escanear el QR', text: 'Esta sucursal requiere el código QR de su pantalla.', tone: 'warn' },
  qr_invalid: { title: 'Código QR no válido', text: 'Volvé a escanear el código que muestra la pantalla de la sucursal.', tone: 'bad' },
  qr_expired: { title: 'El código QR venció', text: 'Los códigos duran unos segundos. Escaneá el código actual.', tone: 'warn' },
  qr_reused: { title: 'Ese código ya fue usado', text: 'Esperá a que la pantalla muestre un código nuevo y volvé a escanear.', tone: 'warn' },
  qr_wrong_branch: { title: 'El QR es de otra sucursal', text: 'Elegí la sucursal correcta o escaneá el código de la sucursal donde estás.', tone: 'bad' },
  branch_not_allowed: { title: 'No podés fichar en esta sucursal', text: 'No tenés turno ni autorización en esta sucursal. Consultá con tu encargado.', tone: 'bad' },
  geo_outside: { title: 'Estás fuera del perímetro de la sucursal', text: 'No registramos la fichada. Si estás en la sucursal, el GPS puede fallar en interiores: podés pedir una revisión.', tone: 'warn' },
  geo_imprecise: { title: 'La ubicación es imprecisa', text: 'Acercate a una ventana o salí al frente y reintentá. También podés pedir una revisión.', tone: 'warn' },
  geo_unavailable: { title: 'No pudimos verificar tu ubicación', text: 'Activá la ubicación y reintentá, o pedí una revisión.', tone: 'warn' },
};

function ResultView({ result, netError, kind, note, setNote, onReview, onRelocate, onRescan, onRetry, onOffline, onDone }: {
  result: PunchResult | null; netError: string | null; kind: PunchKind; note: string; setNote: (v: string) => void;
  onReview: () => void; onRelocate: () => void; onRescan: () => void; onRetry: () => void; onOffline: () => void; onDone: () => void;
}) {
  if (netError || !result) {
    return (
      <Card className="mt-4 p-6 text-center" role="alert">
        <XCircle className="mx-auto h-12 w-12 text-bad" />
        <p className="mt-3 text-lg font-semibold">La fichada NO se registró</p>
        <p className="mt-1 text-sm text-ink-3">{netError ?? 'El servidor no respondió.'}</p>
        <div className="mt-5 space-y-2">
          <Button block onClick={onRetry} icon={<RotateCcw className="h-4 w-4" />}>Reintentar</Button>
          <Button block variant="secondary" onClick={onOffline} icon={<WifiOff className="h-4 w-4" />}>Guardar como pendiente de revisión</Button>
          <Button block variant="ghost" onClick={onDone}>Cancelar</Button>
        </div>
      </Card>
    );
  }
  const r = result.result;
  if (r === 'confirmed' || (r === 'duplicate' && result.status === 'confirmed')) {
    const flags = (result.flags ?? []).filter((f) => PUNCH_FLAG[f] && !['qr_not_required'].includes(f));
    return (
      <Card className="mt-4 p-6 text-center" aria-live="assertive">
        <CheckCircle2 className="mx-auto h-14 w-14 text-ok" />
        <p className="mt-3 text-xl font-semibold">{PUNCH_LABEL[result.kind ?? kind]} registrado</p>
        <p className="mt-1 text-4xl font-semibold tabular tracking-tight">{fmtTime(result.server_time!)}</p>
        <p className="mt-1 text-sm text-ink-3">{result.branch_name} · {fmtDateTime(result.server_time!)}</p>
        {flags.length > 0 && <p className="mt-3 text-xs text-ink-3">Observaciones automáticas: {flags.map((f) => PUNCH_FLAG[f]).join(', ')}. No implican sanción.</p>}
        <Button className="mt-6" block onClick={onDone}>Listo</Button>
      </Card>
    );
  }
  if (r === 'pending_review' || (r === 'duplicate' && result.status === 'pending_review')) {
    return (
      <Card className="mt-4 p-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-warn" />
        <p className="mt-3 text-lg font-semibold">Fichada pendiente de revisión</p>
        <p className="mt-1 text-sm text-ink-2">Recibida a las {fmtTime(result.server_time!)}. <strong>Todavía no está confirmada:</strong> un responsable debe validarla.</p>
        <Link to="/fichaje/historial" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent">Ver en mi historial <ChevronRight className="h-4 w-4" /></Link>
        <Button className="mt-4" block variant="secondary" onClick={onDone}>Entendido</Button>
      </Card>
    );
  }
  if (r === 'already_open') {
    return (
      <Card className="mt-4 p-6 text-center">
        <Clock3 className="mx-auto h-12 w-12 text-info" />
        <p className="mt-3 text-lg font-semibold">Ya tenés una jornada abierta</p>
        <p className="mt-1 text-sm text-ink-3">{result.open_since ? `Desde las ${fmtTime(result.open_since)}. ` : ''}Registrá la salida antes de un nuevo ingreso.</p>
        <Button className="mt-6" block onClick={onDone}>Volver</Button>
      </Card>
    );
  }
  const m = MESSAGES[r] ?? { title: 'No se pudo registrar', text: 'Intentá nuevamente.', tone: 'bad' as const };
  const geoProblem = r.startsWith('geo_');
  return (
    <Card className="mt-4 p-6" role="alert">
      <div className="text-center">
        <AlertTriangle className={cx('mx-auto h-12 w-12', m.tone === 'bad' ? 'text-bad' : 'text-warn')} />
        <p className="mt-3 text-lg font-semibold">{m.title}</p>
        <p className="mt-1 text-sm text-ink-2">{m.text}</p>
        {r === 'geo_outside' && result.distance_m != null && <p className="mt-2 text-xs text-ink-3">Distancia estimada: {result.distance_m} m · radio permitido: {result.radius_m} m · precisión: ±{result.accuracy_m ?? '?'} m</p>}
        <p className="mt-2 text-xs font-medium text-bad">La fichada no fue registrada.</p>
      </div>
      <div className="mt-5 space-y-2">
        {r.startsWith('qr_') && <Button block onClick={onRescan} icon={<QrCode className="h-4 w-4" />}>Escanear de nuevo</Button>}
        {geoProblem && (
          <>
            <Button block onClick={onRelocate} icon={<RotateCcw className="h-4 w-4" />}>Reintentar ubicación</Button>
            <div className="rounded-xl bg-surface-2 p-3 text-left">
              <Field label="Pedir revisión a un responsable" hint="Quedará como pendiente, con la hora del servidor." optional>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ej.: estoy en la cocina, el GPS no toma señal" className="min-h-[72px] bg-surface" />
              </Field>
              <Button className="mt-2" block variant="secondary" onClick={onReview}>Enviar para revisión</Button>
            </div>
          </>
        )}
        <Button block variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </Card>
  );
}
