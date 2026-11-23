import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Delete, CheckCircle2, XCircle, Fingerprint, QrCode, Loader2, WifiOff, LogOut, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { useOnline } from '@/lib/hooks';
import { fmtTime, fmtDayLong } from '@/lib/format';
import { PUNCH_LABEL, type PunchKind, type PunchResult } from '@/lib/types';
import { Button, Input, Notice, cx } from '@/components/ui';

// El secreto del dispositivo es una credencial de la tablet (no un dato de negocio).
// Si se revoca desde gerencia, deja de funcionar inmediatamente.
const KEY = 'kiosk-device-secret';
const getSecret = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const setSecret = (s: string | null) => { try { if (s) localStorage.setItem(KEY, s); else localStorage.removeItem(KEY); } catch { /* */ } };

interface Info { device_id: string; name: string; mode: 'kiosk' | 'qr_display' | 'both'; server_time: string; branch: { id: string; name: string; brand: string } }

async function kioskRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

function useKioskInfo() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const secret = getSecret();
  const load = useCallback(async () => {
    if (!secret) return;
    try { setInfo(await kioskRpc<Info>('kiosk_info', { p_device_secret: secret })); setError(null); }
    catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      if ((e as { code?: string }).code === '42501') { setSecret(null); setInfo(null); }
    }
  }, [secret]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 5 * 60_000); return () => clearInterval(t); }, [load]);
  return { info, error, secret, reload: load };
}

function KioskFrame({ children, info }: { children: React.ReactNode; info?: Info | null }) {
  const online = useOnline();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="flex min-h-dvh select-none flex-col bg-bg">
      <header className="flex items-center justify-between px-8 py-5">
        <div><p className="text-lg font-semibold tracking-tight">{info?.branch.brand ?? 'Fichaje'}</p><p className="text-sm text-ink-3">{info?.branch.name}</p></div>
        <div className="text-right"><p className="tabular text-3xl font-semibold tracking-tight">{fmtTime(now)}</p><p className="text-sm capitalize text-ink-3">{fmtDayLong(now)}</p></div>
      </header>
      {!online && <div className="mx-8 mb-2 flex items-center gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad"><WifiOff className="h-4 w-4" />Sin conexión: no es posible registrar fichadas. Usá el procedimiento de contingencia con tu encargado.</div>}
      <main className="flex flex-1 items-center justify-center px-6 pb-10">{children}</main>
    </div>
  );
}

function Pair() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await kioskRpc<{ device_secret: string; mode: string }>('kiosk_pair', { p_code: code.trim().toUpperCase() });
      setSecret(r.device_secret);
      nav(r.mode === 'qr_display' ? '/kiosco/qr' : '/kiosco', { replace: true });
      location.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <KioskFrame>
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 text-center">
        <Fingerprint className="mx-auto h-12 w-12 text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">Vincular dispositivo</h1>
        <p className="text-sm text-ink-2">Ingresá el código de 8 caracteres generado en Gerencia → Sucursales → Dispositivos. Vence a los 15 minutos y se usa una sola vez.</p>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} className="h-14 text-center font-mono text-2xl tracking-[0.3em]" aria-label="Código de vinculación" autoFocus />
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" size="lg" block loading={busy} disabled={code.length < 8}>Vincular</Button>
        <Link to="/bienvenida" className="block text-sm text-ink-3">Volver</Link>
      </form>
    </KioskFrame>
  );
}

function Keypad({ onKey, onDelete }: { onKey: (k: string) => void; onDelete: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)} className="h-16 rounded-2xl bg-surface text-2xl font-semibold shadow-card active:bg-surface-2">{k}</button>
      ))}
      <span />
      <button type="button" onClick={() => onKey('0')} className="h-16 rounded-2xl bg-surface text-2xl font-semibold shadow-card active:bg-surface-2">0</button>
      <button type="button" onClick={onDelete} className="flex h-16 items-center justify-center rounded-2xl text-ink-2 active:bg-surface-2" aria-label="Borrar"><Delete className="h-6 w-6" /></button>
    </div>
  );
}

function KioskPunch() {
  const { info, error, secret } = useKioskInfo();
  const [stage, setStage] = useState<'code' | 'pin' | 'kind' | 'sending' | 'done'>('code');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<PunchResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const reset = useCallback(() => { setStage('code'); setCode(''); setPin(''); setResult(null); setErr(null); }, []);
  // Reinicio automático por inactividad: nadie queda "logueado" en la tablet.
  useEffect(() => {
    clearTimeout(timer.current);
    if (stage !== 'code' || code) timer.current = setTimeout(reset, stage === 'done' ? 6000 : 30000);
    return () => clearTimeout(timer.current);
  }, [stage, code, pin, reset]);

  if (!secret) return <Navigate to="/kiosco/vincular" replace />;
  if (!info) return <KioskFrame>{error ? <Notice tone="bad" title="Dispositivo no disponible">{error}</Notice> : <Loader2 className="h-8 w-8 animate-spin text-ink-3" />}</KioskFrame>;
  if (info.mode === 'qr_display') return <Navigate to="/kiosco/qr" replace />;

  const punch = async (kind: PunchKind) => {
    setStage('sending'); setErr(null);
    try {
      const r = await kioskRpc<PunchResult>('kiosk_punch', { p_device_secret: secret, p_employee_code: code, p_pin: pin, p_kind: kind, p_client_request_id: crypto.randomUUID() });
      setResult(r);
    } catch (e) { setErr(errorMessage(e)); setResult(null); }
    setPin(''); setStage('done');
  };
  const ok = result && (result.result === 'confirmed' || result.result === 'duplicate');
  return (
    <KioskFrame info={info}>
      <div className="w-full max-w-md">
        {stage === 'code' && (
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) setStage('pin'); }} className="space-y-5 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Fichar asistencia</h1>
            <p className="text-ink-2">Ingresá tu código de empleado</p>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} autoComplete="off" autoCapitalize="characters" className="h-16 text-center font-mono text-3xl tracking-widest" aria-label="Código de empleado" autoFocus />
            <Button type="submit" size="lg" block disabled={!code.trim()}>Continuar</Button>
            <Link to="/kiosco/qr" className={cx('inline-flex items-center gap-2 text-sm text-ink-3', info.mode !== 'both' && 'hidden')}><QrCode className="h-4 w-4" />Mostrar QR para celulares</Link>
          </form>
        )}
        {stage === 'pin' && (
          <div className="space-y-6 text-center">
            <p className="text-ink-2">Código <span className="font-mono font-semibold text-ink">{code}</span></p>
            <h2 className="text-2xl font-semibold">Ingresá tu PIN</h2>
            <div className="flex justify-center gap-3" aria-label={`${pin.length} de 6 dígitos`}>{Array.from({ length: 6 }).map((_, i) => <span key={i} className={cx('h-4 w-4 rounded-full', i < pin.length ? 'bg-accent' : 'bg-line')} />)}</div>
            <Keypad onKey={(k) => setPin((p) => { const n = (p + k).slice(0, 6); if (n.length === 6) setTimeout(() => setStage('kind'), 120); return n; })} onDelete={() => setPin((p) => p.slice(0, -1))} />
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
          </div>
        )}
        {stage === 'kind' && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold">¿Qué querés registrar?</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['in', 'out', 'break_start', 'break_end'] as PunchKind[]).map((k) => (
                <button key={k} onClick={() => void punch(k)} className={cx('h-24 rounded-2xl text-lg font-semibold shadow-card', k === 'in' ? 'bg-accent text-accent-ink' : k === 'out' ? 'bg-ink text-bg' : 'bg-surface text-ink')}>{PUNCH_LABEL[k]}</button>
              ))}
            </div>
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
          </div>
        )}
        {stage === 'sending' && <div className="flex flex-col items-center gap-4 py-10"><Loader2 className="h-10 w-10 animate-spin text-accent" /><p className="text-ink-2">Registrando en el servidor…</p></div>}
        {stage === 'done' && (
          <div className="space-y-4 text-center" aria-live="assertive">
            {ok ? (
              <>
                <CheckCircle2 className="mx-auto h-20 w-20 text-ok" />
                <p className="text-3xl font-semibold">{result!.first_name ? `¡Listo, ${result!.first_name}!` : '¡Listo!'}</p>
                <p className="text-xl text-ink-2">{PUNCH_LABEL[result!.kind!]} registrado a las <strong className="tabular">{fmtTime(result!.server_time!)}</strong></p>
                {result!.status === 'pending_review' && <Notice tone="warn">Quedó pendiente de revisión por un responsable.</Notice>}
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-20 w-20 text-bad" />
                <p className="text-2xl font-semibold">No se registró la fichada</p>
                <p className="text-ink-2">{err ?? (result?.result === 'bad_credentials' ? 'Código o PIN incorrectos.' : result?.result === 'already_open' ? 'Ya tenés una jornada abierta. Registrá la salida.' : result?.result === 'branch_not_allowed' ? 'No estás habilitado para fichar en esta sucursal.' : 'Intentá nuevamente o avisá a tu encargado.')}</p>
              </>
            )}
            <Button size="lg" block onClick={reset}>Terminar</Button>
          </div>
        )}
      </div>
    </KioskFrame>
  );
}

function KioskQr() {
  const { info, error, secret } = useKioskInfo();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [expires, setExpires] = useState<number>(0);
  const [left, setLeft] = useState(30);
  const [qrError, setQrError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!secret) return;
    try {
      const r = await kioskRpc<{ token: string; branch_id: string; refresh_in: number; expires_at: string }>('kiosk_issue_qr', { p_device_secret: secret });
      // El QR lleva un enlace: al escanearlo con la cámara del teléfono abre la app en Fichar.
      const url = `${location.origin}/fichaje?b=${r.branch_id}&t=${encodeURIComponent(r.token)}`;
      if (canvas.current) await QRCode.toCanvas(canvas.current, url, { width: 420, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1c1917', light: '#ffffff' } });
      setExpires(Date.now() + r.refresh_in * 1000);
      setQrError(null);
    } catch (e) { setQrError(errorMessage(e)); setExpires(Date.now() + 5000); }
  }, [secret]);
  useEffect(() => { if (info) void refresh(); }, [info, refresh]);
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
      setLeft(l);
      if (l === 0 && expires) void refresh();
    }, 500);
    return () => clearInterval(t);
  }, [expires, refresh]);
  if (!secret) return <Navigate to="/kiosco/vincular" replace />;
  if (!info) return <KioskFrame>{error ? <Notice tone="bad" title="Dispositivo no disponible">{error}</Notice> : <Loader2 className="h-8 w-8 animate-spin text-ink-3" />}</KioskFrame>;
  if (info.mode === 'kiosk') return <Navigate to="/kiosco" replace />;
  return (
    <KioskFrame info={info}>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Escaneá para fichar</h1>
        <p className="mt-2 text-ink-2">Abrí la app en tu celular → Fichar, o escaneá con la cámara.</p>
        <div className="relative mt-6 rounded-3xl bg-white p-5 shadow-pop">
          <canvas ref={canvas} className={cx('h-[min(60vh,420px)] w-[min(60vh,420px)]', qrError && 'opacity-10')} aria-label="Código QR dinámico de fichaje" />
          {qrError && <div className="absolute inset-0 flex items-center justify-center p-8 text-sm font-medium text-bad">{qrError}</div>}
        </div>
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-3"><Clock className="h-4 w-4" />Se renueva en <span className="tabular w-6 font-semibold text-ink">{left}</span> s</div>
        <div className="mt-2 h-1 w-64 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(left / 30) * 100}%` }} /></div>
        {info.mode === 'both' && <Link to="/kiosco" className="mt-8 inline-flex items-center gap-2 text-sm text-ink-3"><Fingerprint className="h-4 w-4" />Fichar con código y PIN</Link>}
      </div>
    </KioskFrame>
  );
}

function Unpair() {
  const nav = useNavigate();
  return (
    <KioskFrame>
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-lg font-semibold">¿Desvincular este dispositivo?</p>
        <p className="text-sm text-ink-3">Para volver a usarlo se necesitará un código nuevo. Para bloquearlo definitivamente, revocalo desde Gerencia.</p>
        <Button variant="danger" block icon={<LogOut className="h-4 w-4" />} onClick={() => { setSecret(null); nav('/kiosco/vincular', { replace: true }); }}>Desvincular</Button>
        <Button variant="ghost" block onClick={() => nav(-1)}>Cancelar</Button>
      </div>
    </KioskFrame>
  );
}

export default function KioskRoutes() {
  return (
    <Routes>
      <Route index element={<KioskPunch />} />
      <Route path="qr" element={<KioskQr />} />
      <Route path="vincular" element={<Pair />} />
      <Route path="desvincular" element={<Unpair />} />
    </Routes>
  );
}
