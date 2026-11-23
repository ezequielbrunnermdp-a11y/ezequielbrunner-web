import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { ShieldCheck, Fingerprint, MessageCircle, CalendarDays, Users, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Field, Input, Notice, Spinner } from '@/components/ui';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-[380px] flex-1">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent text-sm font-bold text-accent-ink">E</span>
          <span className="text-[15px] font-semibold tracking-tight">Equipo</span>
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
      {footer && <div className="mx-auto mt-8 w-full max-w-[380px] text-center text-sm text-ink-3">{footer}</div>}
    </div>
  );
}

export function NotConfigured() {
  return (
    <AuthLayout title="Falta configurar el servidor" subtitle="La aplicación no tiene definidas las variables de conexión con Supabase.">
      <Notice tone="warn" title="Configuración requerida">
        Definí <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en Netlify (o en <code>.env.local</code> para desarrollo)
        y volvé a publicar. Ver <code>docs/INSTALACION.md</code>.
      </Notice>
    </AuthLayout>
  );
}

export function Welcome() {
  const { session } = useAuth();
  if (session) return <Navigate to="/" replace />;
  const features = [
    { icon: <Users className="h-5 w-5" />, t: 'Tu comunidad', d: 'Compañeros, publicaciones y reconocimientos.' },
    { icon: <MessageCircle className="h-5 w-5" />, t: 'Mensajes', d: 'Conversaciones privadas y grupos.' },
    { icon: <CalendarDays className="h-5 w-5" />, t: 'Tus horarios', d: 'Turnos, francos y cambios al instante.' },
    { icon: <Fingerprint className="h-5 w-5" />, t: 'Fichaje', d: 'Ingreso y salida con verificación segura.' },
  ];
  return (
    <AuthLayout title="Todo tu trabajo, en un solo lugar" subtitle="El portal privado del equipo. El acceso es solo por invitación de tu empresa."
      footer={<>¿Problemas para entrar? Consultá con tu encargado.</>}>
      <ul className="space-y-4">
        {features.map((f) => (
          <li key={f.t} className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">{f.icon}</span>
            <div><p className="text-[15px] font-medium">{f.t}</p><p className="text-sm text-ink-3">{f.d}</p></div>
          </li>
        ))}
      </ul>
      <Link to="/ingresar" className="mt-10 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-medium text-accent-ink">Ingresar</Link>
      <Link to="/kiosco" className="mt-3 flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-ink-2 hover:bg-surface-2">Modo tablet de fichaje</Link>
    </AuthLayout>
  );
}

export function Login() {
  const { session } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to={loc.state?.from || '/'} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(errorMessage(error)); else nav(loc.state?.from || '/', { replace: true });
  };
  return (
    <AuthLayout title="Ingresar" subtitle="Usá el correo con el que te invitó tu empresa."
      footer={<Link to="/bienvenida" className="font-medium text-ink-2">Volver</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" size="lg" block loading={busy} disabled={!email || !password}>Ingresar</Button>
        <Link to="/recuperar" className="block pt-1 text-center text-sm font-medium text-accent">Olvidé mi contraseña</Link>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/nueva-clave` });
    setBusy(false);
    // Misma respuesta exista o no la cuenta (evita enumeración de usuarios).
    if (error && /rate/i.test(error.message)) setError(errorMessage(error)); else setSent(true);
  };
  return (
    <AuthLayout title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una nueva."
      footer={<Link to="/ingresar" className="font-medium text-ink-2">Volver a ingresar</Link>}>
      {sent ? (
        <Notice tone="ok" title="Revisá tu correo">Si la dirección corresponde a una cuenta, vas a recibir un enlace en unos minutos. Revisá también la carpeta de spam.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Correo electrónico" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" size="lg" block loading={busy} disabled={!email}>Enviar enlace</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export const passwordProblems = (p: string): string | null => {
  if (p.length < 10) return 'Usá al menos 10 caracteres.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Combiná letras y números.';
  return null;
};

/** Activación por invitación y restablecimiento: la sesión llega desde el enlace del correo. */
export function SetPassword({ mode }: { mode: 'invite' | 'reset' }) {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pr = passwordProblems(p1);
    if (pr) return setError(pr);
    if (p1 !== p2) return setError('Las contraseñas no coinciden.');
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) setError(errorMessage(error)); else nav('/', { replace: true });
  };
  const title = mode === 'invite' ? 'Activá tu cuenta' : 'Nueva contraseña';
  if (loading || (!session && !waited)) return <AuthLayout title={title}><Spinner /></AuthLayout>;
  if (!session) {
    return (
      <AuthLayout title="El enlace no es válido" subtitle="Puede haber vencido o ya haberse usado."
        footer={<Link to="/ingresar" className="font-medium text-ink-2">Ir a ingresar</Link>}>
        <Notice tone="warn">{mode === 'invite' ? 'Pedile a tu empresa que te reenvíe la invitación.' : <>Solicitá un nuevo enlace desde <Link to="/recuperar" className="underline">Recuperar contraseña</Link>.</>}</Notice>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={title} subtitle={mode === 'invite' ? `Elegí una contraseña para ${session.user.email}.` : 'Elegí una contraseña nueva.'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Contraseña" htmlFor="p1" hint="Mínimo 10 caracteres, con letras y números.">
          <Input id="p1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
        </Field>
        <Field label="Repetir contraseña" htmlFor="p2"><Input id="p2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" size="lg" block loading={busy}>{mode === 'invite' ? 'Activar cuenta' : 'Guardar contraseña'}</Button>
        {mode === 'invite' && <p className="text-xs leading-relaxed text-ink-3">Al activar tu cuenta aceptás el tratamiento de tus datos según la política informada por tu empleador (Ley 25.326). La participación en la comunidad es voluntaria.</p>}
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------
// MFA (TOTP) para roles con permisos administrativos
// ---------------------------------------------------------------------
const SKIP_KEY = 'mfa-skip';
export function MfaGate({ children }: { children: ReactNode }) {
  const { needsMfa, refreshCtx } = useAuth();
  const [skip, setSkip] = useState(() => { try { return sessionStorage.getItem(SKIP_KEY) === '1'; } catch { return false; } });
  if (!needsMfa || skip) return <>{children}</>;
  return <MfaScreen onDone={() => void refreshCtx()} onSkip={() => { try { sessionStorage.setItem(SKIP_KEY, '1'); } catch { /* */ } setSkip(true); }} />;
}

function MfaScreen({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [state, setState] = useState<'loading' | 'enroll' | 'challenge'>('loading');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setError(errorMessage(error)); setState('challenge'); return; }
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) { setFactorId(verified.id); setState('challenge'); return; }
      for (const f of data.all.filter((x) => x.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const en = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Equipo ${new Date().toISOString().slice(0, 10)}` });
      if (en.error) { setError(errorMessage(en.error)); return; }
      setFactorId(en.data.id);
      setSecret(en.data.totp.secret);
      setQr(await QRCode.toDataURL(en.data.totp.uri, { margin: 1, width: 220 }));
      setState('enroll');
    })();
  }, []);
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) setError('El código no es válido. Revisá que la hora de tu teléfono esté sincronizada.'); else onDone();
  };
  return (
    <AuthLayout title="Verificación en dos pasos" subtitle="Tu rol tiene acceso a información sensible. Por seguridad, confirmá tu identidad con una app de autenticación.">
      {state === 'loading' ? <Spinner /> : (
        <form onSubmit={verify} className="space-y-5">
          {state === 'enroll' && (
            <div className="rounded-2xl border border-line bg-surface p-5 text-center">
              <p className="text-sm text-ink-2">Escaneá este código con Google Authenticator, Microsoft Authenticator u otra app compatible.</p>
              {qr && <img src={qr} alt="Código QR para configurar la verificación" className="mx-auto mt-4 h-44 w-44 rounded-lg bg-white p-2" />}
              <p className="mt-3 break-all font-mono text-xs text-ink-3">{secret}</p>
            </div>
          )}
          <Field label="Código de 6 dígitos" htmlFor="totp">
            <Input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-lg tracking-[0.4em]" />
          </Field>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6} icon={<ShieldCheck className="h-4 w-4" />}>Verificar</Button>
          <button type="button" onClick={onSkip} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-ink-2">
            <KeyRound className="h-4 w-4" /> Continuar sin funciones de gerencia
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
