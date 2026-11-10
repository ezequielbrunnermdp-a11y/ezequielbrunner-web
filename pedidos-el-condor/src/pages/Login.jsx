import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth.jsx';

export function Logo() {
  return <div className="logo"><b>EL CÓNDOR</b><span className="suave">Pedidos mayoristas</span></div>;
}

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (session) return <Navigate to="/" replace />;

  async function ingresar(e) {
    e.preventDefault();
    setError(''); setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
    setEnviando(false);
    if (error) setError(/banned/i.test(error.message) ? 'Tu usuario está suspendido. Comunicate con El Cóndor.' : 'Email o contraseña incorrectos.');
  }

  return (
    <div className="login">
      <Logo />
      <form className="tarjeta" onSubmit={ingresar}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        {error && <div className="aviso error">{error}</div>}
        <button className="primario ancho" style={{ marginTop: 16 }} disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
        <p style={{ textAlign: 'center', marginBottom: 0 }}><Link to="/recuperar">Olvidé mi contraseña</Link></p>
      </form>
      <p className="suave" style={{ textAlign: 'center', fontSize: '.9rem' }}>¿No tenés cuenta? Pedísela a El Cóndor.</p>
    </div>
  );
}
