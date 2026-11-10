import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../auth.jsx';
import AccesoCreado from '../../components/AccesoCreado.jsx';

const ROLES = { admin: 'Administrador', fabrica: 'Fábrica (ve pedidos y marca entregas)' };

export default function Usuarios() {
  const { perfil: yo } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [form, setForm] = useState({ email: '', nombre: '', rol: 'fabrica', modo: 'provisoria' });
  const [mensaje, setMensaje] = useState(null);
  const [acceso, setAcceso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    supabase.from('perfiles').select('*').in('rol', ['admin', 'fabrica']).order('created_at').then(({ data }) => setUsuarios(data || []));
  }, [recarga]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function crear(e) {
    e.preventDefault();
    setEnviando(true); setMensaje(null);
    try {
      const r = await api('admin', { accion: 'crear_usuario', ...form });
      setAcceso({ ...r, email: form.email });
      setForm({ email: '', nombre: '', rol: 'fabrica', modo: 'provisoria' });
      setRecarga((x) => x + 1);
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
    setEnviando(false);
  }

  async function accion(body, pregunta) {
    if (pregunta && !window.confirm(pregunta)) return;
    try {
      const r = await api('admin', body);
      if (r.clave_provisoria || r.email_enviado) setAcceso({ ...r, email: body.email });
      setRecarga((x) => x + 1);
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  return (
    <>
      <h1>Usuarios internos</h1>
      <p className="suave" style={{ marginTop: 0 }}>Administradores y fábrica. Los accesos de los clientes se manejan desde cada cliente.</p>
      {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
      {usuarios?.map((u) => (
        <div className="tarjeta" key={u.id}>
          <div className="entre">
            <div><b>{u.nombre || u.email}</b><br /><small>{u.email} · {ROLES[u.rol].split(' (')[0]}</small></div>
            <span className={`etiqueta ${u.activo ? 'activo' : 'baja'}`}>{u.activo ? 'activo' : 'desactivado'}</span>
          </div>
          {u.id !== yo.id && (
            <div className="fila" style={{ marginTop: 8 }}>
              <button className="chico" onClick={() => accion({ accion: 'reenviar_acceso', usuario_id: u.id, modo: 'provisoria', email: u.email }, 'Se genera una contraseña nueva. ¿Seguir?')}>Nueva contraseña</button>
              <button className="chico peligro" onClick={() => accion({ accion: 'estado_usuario', usuario_id: u.id, activo: !u.activo })}>{u.activo ? 'Desactivar' : 'Activar'}</button>
            </div>
          )}
        </div>
      ))}

      <form className="tarjeta" onSubmit={crear}>
        <h2 style={{ marginTop: 0 }}>Nuevo usuario</h2>
        <div className="grilla">
          <div><label htmlFor="un">Nombre</label><input id="un" value={form.nombre} onChange={set('nombre')} /></div>
          <div><label htmlFor="ue">Email</label><input id="ue" type="email" value={form.email} onChange={set('email')} required /></div>
        </div>
        <label htmlFor="ur">Rol</label>
        <select id="ur" value={form.rol} onChange={set('rol')}>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label htmlFor="um">Contraseña</label>
        <select id="um" value={form.modo} onChange={set('modo')}>
          <option value="provisoria">Generar contraseña provisoria</option>
          <option value="invitacion">Mandar link por email</option>
        </select>
        <button className="primario ancho" style={{ marginTop: 12 }} disabled={enviando}>{enviando ? 'Creando…' : 'Crear usuario'}</button>
      </form>
      {acceso && <AccesoCreado resultado={acceso} email={acceso.email} onCerrar={() => setAcceso(null)} />}
    </>
  );
}
