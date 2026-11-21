import { useEffect, useState, type FormEvent } from 'react';
import { supabase, friendlyError } from '../lib/supabase';
import { BrandMark } from '../components/Brand';
import { ErrorBox, Field, Input, Notice } from '../components/ui';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((ev, s) => { if (ev === 'PASSWORD_RECOVERY' || s) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 10) return setErr('La contraseña debe tener al menos 10 caracteres.');
    if (pw !== pw2) return setErr('Las contraseñas no coinciden.');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr(friendlyError(error));
    setDone(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <BrandMark compact />
        <h1 className="font-serif text-2xl font-semibold">Cambiar contraseña</h1>
        {!ready && <Notice tone="warn">Ingrese primero a la plataforma con su contraseña actual o la que le asignó la administración. <a href="/" className="font-semibold underline">Ir al ingreso</a></Notice>}
        {done ? (
          <>
            <Notice tone="ok">La contraseña fue actualizada.</Notice>
            <a href="/" className="btn-primary w-full">Volver a la plataforma</a>
          </>
        ) : (
          <>
            <Field label="Nueva contraseña" hint="Mínimo 10 caracteres."><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Field label="Repetir contraseña"><Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
            <ErrorBox>{err}</ErrorBox>
            <button className="btn-primary w-full" disabled={!ready}>Guardar contraseña</button>
            {ready && <a href="/" className="btn-ghost w-full">Cancelar</a>}
          </>
        )}
      </form>
    </div>
  );
}
