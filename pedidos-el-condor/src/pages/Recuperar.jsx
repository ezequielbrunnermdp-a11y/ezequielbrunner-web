import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Login.jsx';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setError('');
    try {
      const r = await fetch('/.netlify/functions/recuperar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMensaje(j.mensaje);
    } catch (err) {
      setError(err.message || 'No se pudo enviar. Probá de nuevo.');
    }
    setEnviando(false);
  }

  return (
    <div className="login">
      <Logo />
      <form className="tarjeta" onSubmit={enviar}>
        <h1>Recuperar contraseña</h1>
        {mensaje ? <div className="aviso ok">{mensaje}</div> : (
          <>
            <p className="suave" style={{ marginTop: 0 }}>Te mandamos un link por email para que definas una contraseña nueva.</p>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <div className="aviso error">{error}</div>}
            <button className="primario ancho" style={{ marginTop: 16 }} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
          </>
        )}
        <p style={{ textAlign: 'center', marginBottom: 0 }}><Link to="/login">Volver a ingresar</Link></p>
      </form>
    </div>
  );
}
