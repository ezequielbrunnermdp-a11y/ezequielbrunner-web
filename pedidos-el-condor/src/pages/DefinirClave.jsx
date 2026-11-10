import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth.jsx';
import { Logo } from './Login.jsx';

export default function DefinirClave() {
  const { session, cargando } = useAuth();
  const navigate = useNavigate();
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [error, setError] = useState('');
  const [esperando, setEsperando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Damos un momento para que Supabase lea el link del email
  useEffect(() => { const t = setTimeout(() => setEsperando(false), 2500); return () => clearTimeout(t); }, []);
  const errorLink = new URLSearchParams(window.location.hash.slice(1)).get('error_description');

  async function guardar(e) {
    e.preventDefault();
    if (clave.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
    if (clave !== clave2) return setError('Las contraseñas no coinciden.');
    setEnviando(true); setError('');
    const { error } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) {
      if (error.code === 'same_password' || /different/i.test(error.message)) return setError('La contraseña nueva tiene que ser distinta de la anterior.');
      if (error.code === 'weak_password') return setError('La contraseña es muy débil. Probá con una más larga.');
      return setError('No se pudo guardar. Pedí un link nuevo e intentá otra vez.');
    }
    navigate('/', { replace: true });
  }

  if (!session && (cargando || (esperando && !errorLink))) return <div className="cargando">Verificando el link…</div>;

  return (
    <div className="login">
      <Logo />
      <div className="tarjeta">
        {!session ? (
          <>
            <div className="aviso error">El link venció o ya se usó.</div>
            <Link className="boton primario ancho" to="/recuperar">Pedir un link nuevo</Link>
          </>
        ) : (
          <form onSubmit={guardar}>
            <h1>Definí tu contraseña</h1>
            <p className="suave" style={{ marginTop: 0 }}>Usuario: <b>{session.user.email}</b></p>
            <label htmlFor="c1">Contraseña nueva</label>
            <input id="c1" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
            <div className="ayuda">Mínimo 8 caracteres.</div>
            <label htmlFor="c2">Repetila</label>
            <input id="c2" type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} required />
            {error && <div className="aviso error">{error}</div>}
            <button className="primario ancho" style={{ marginTop: 16 }} disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar y entrar'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
