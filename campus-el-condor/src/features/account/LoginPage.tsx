import { useState } from 'react';
import { Eye, EyeOff, LogIn, KeyRound } from 'lucide-react';
import { BrandLarge } from '../../components/Brand';
import { Callout, Field } from '../../components/ui';
import { changeOwnPassword, signIn, signOut, useSession } from '../../auth/session';
import { ApiError } from '../../auth/api';

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <main className="auth-card fade-in" aria-labelledby="auth-title">
        <BrandLarge className="auth-logo" />
        <p className="eyebrow" style={{ justifyContent: 'center' }}>Campus de formación</p>
        {children}
      </main>
      <p className="auth-foot">El Cóndor Coffee Shop · Uso interno del equipo</p>
    </div>
  );
}

export function LoginPage() {
  const { notice } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Completá usuario y contraseña.'); return; }
    setBusy(true); setError(null);
    try { await signIn(username, password); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo ingresar. Probá de nuevo.'); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell>
      <h1 id="auth-title">Ingresá con tu usuario</h1>
      <p className="muted" style={{ textAlign: 'center', marginTop: -4 }}>Si todavía no tenés usuario, pedíselo a tu encargado.</p>
      {notice && <Callout tone="info">{notice}</Callout>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Usuario" htmlFor="login-user">
          <input id="login-user" className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Contraseña" htmlFor="login-pass">
          <div className="pass-wrap">
            <input id="login-pass" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pass-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show}>{show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
          </div>
        </Field>
        {error && <Callout tone="err">{error}</Callout>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}><LogIn aria-hidden="true" />{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </AuthShell>
  );
}

export function PasswordForm({ onDone, requireCurrent = true, submitLabel = 'Guardar contraseña' }: { onDone?: () => void; requireCurrent?: boolean; submitLabel?: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(false);
    if (next.length < 8) { setError('La contraseña nueva debe tener al menos 8 caracteres.'); return; }
    if (next !== repeat) { setError('Las contraseñas nuevas no coinciden.'); return; }
    if (next === current) { setError('Elegí una contraseña distinta de la actual.'); return; }
    setBusy(true); setError(null);
    try { await changeOwnPassword(current, next); setOk(true); setCurrent(''); setNext(''); setRepeat(''); onDone?.(); }
    catch (err) { setError(err instanceof ApiError ? (err.code === 'CREDENCIALES' ? 'La contraseña actual no es correcta.' : err.message) : 'No se pudo cambiar la contraseña.'); }
    finally { setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={submit} noValidate>
      {requireCurrent && <Field label="Contraseña actual" htmlFor="pw-cur"><input id="pw-cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>}
      <Field label="Contraseña nueva" htmlFor="pw-new" hint="Mínimo 8 caracteres. Evitá datos personales."><input id="pw-new" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <Field label="Repetí la contraseña nueva" htmlFor="pw-rep"><input id="pw-rep" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} /></Field>
      {error && <Callout tone="err">{error}</Callout>}
      {ok && <Callout tone="ok">Contraseña actualizada. Se cerraron tus otras sesiones abiertas.</Callout>}
      <button type="submit" className="btn btn-primary" disabled={busy}><KeyRound aria-hidden="true" />{busy ? 'Guardando…' : submitLabel}</button>
    </form>
  );
}

export function ForcePasswordPage() {
  const { user } = useSession();
  return (
    <AuthShell>
      <h1 id="auth-title">Elegí tu contraseña</h1>
      <p className="muted" style={{ textAlign: 'center', marginTop: -4 }}>Hola{user?.displayName ? `, ${user.displayName}` : ''}. Ingresaste con una contraseña temporal: cambiala por una propia para continuar.</p>
      <PasswordForm submitLabel="Guardar y entrar al campus" />
      <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => signOut()}>Salir</button>
    </AuthShell>
  );
}
