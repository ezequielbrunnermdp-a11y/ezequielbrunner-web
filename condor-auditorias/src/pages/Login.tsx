import { useState, type FormEvent } from 'react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { BrandMark } from '../components/Brand';
import { ErrorBox, Field, Input, Notice, Spinner } from '../components/ui';

export default function Login() {
  const { brand } = useSession();
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        setMsg('Solicite a la administración que restablezca su contraseña desde Administración → Usuarios. Luego podrá cambiarla desde el menú «Cambiar contraseña».');
      }
    } catch (e2) {
      setErr(friendlyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-14">
        <BrandMark light />
        <div>
          <div className="mb-4 h-px w-16 bg-brand-accent" />
          <p className="max-w-md font-serif text-4xl leading-tight text-crema-50">Calidad operativa en cada sucursal, con trazabilidad en cada control.</p>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-crema-200/70">{brand.subtitle}</p>
        </div>
        <div className="text-xs text-crema-200/50">{brand.company_name}</div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <form onSubmit={submit} className="w-full max-w-sm fade-in">
          <div className="lg:hidden"><BrandMark /></div>
          <h1 className="mt-8 font-serif text-3xl font-semibold text-cafe-900 lg:mt-0">{mode === 'login' ? 'Ingresar' : 'Recuperar contraseña'}</h1>
          <p className="mt-1 text-sm text-cafe-500">{mode === 'login' ? 'Acceso para administración, auditores y franquiciados.' : 'La contraseña la restablece la administración.'}</p>
          <div className="mt-7 space-y-4">
            <Field label="Correo electrónico">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {mode === 'login' && (
              <Field label="Contraseña">
                <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            )}
            <ErrorBox>{err}</ErrorBox>
            {msg && <Notice tone="ok">{msg}</Notice>}
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-crema-50" />}
              {mode === 'login' ? 'Ingresar' : 'Continuar'}
            </button>
            <button type="button" className="w-full text-center text-sm font-medium text-brand-accent" onClick={() => { setMode(mode === 'login' ? 'recover' : 'login'); setErr(null); setMsg(null); }}>
              {mode === 'login' ? '¿Olvidó su contraseña?' : 'Volver al ingreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
