import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function Configuracion() {
  const [hora, setHora] = useState('');
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    supabase.from('config').select('*').eq('id', 1).single().then(({ data }) => setHora(data?.hora_corte?.slice(0, 5) || '20:00'));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    const { error } = await supabase.from('config').update({ hora_corte: `${hora}:00` }).eq('id', 1);
    setMensaje(error ? { tipo: 'error', texto: 'No se pudo guardar.' } : { tipo: 'ok', texto: `Hora de corte: ${hora} hs.` });
  }

  return (
    <>
      <h1>Configuración</h1>
      <form className="tarjeta" onSubmit={guardar}>
        <label htmlFor="hc">Hora de corte</label>
        <input id="hc" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required style={{ maxWidth: 180 }} />
        <p className="ayuda">Un pedido para entregar el día D se puede cargar o modificar hasta esta hora del día anterior (hora de Buenos Aires). Después queda bloqueado para el cliente; el admin lo puede seguir editando.</p>
        {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button className="primario">Guardar</button>
      </form>
      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Emails de pedidos</h2>
        <p style={{ margin: 0 }}>Los emails que reciben cada pedido se configuran en Netlify, en la variable <b>EMAILS_PEDIDOS</b> (separados por coma). Ver el README.</p>
      </div>
    </>
  );
}
