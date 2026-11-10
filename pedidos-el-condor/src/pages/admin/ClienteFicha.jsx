import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { api } from '../../lib/api.js';
import AccesoCreado from '../../components/AccesoCreado.jsx';
import { nombreCliente, NOMBRES_DIAS } from '../../lib/formato.js';

const VACIO = {
  razon_social: '', nombre_fantasia: '', cuit: '', email: '', telefono: '', direccion: '', horario_limite: '',
  dias_cerrado: [], observaciones_fijas: '', ve_precios: true, restringir_catalogo: false,
};
const CAMPOS = Object.keys(VACIO);
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

function Campo({ id, etiqueta, ayuda, ...props }) {
  return (
    <div>
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} {...props} />
      {ayuda && <div className="ayuda">{ayuda}</div>}
    </div>
  );
}

export default function ClienteFicha() {
  const { id } = useParams();
  const nuevo = id === 'nuevo';
  const navigate = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [original, setOriginal] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [habilitados, setHabilitados] = useState(new Set());
  const [modo, setModo] = useState('invitacion');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [acceso, setAcceso] = useState(null);
  const [filtroProd, setFiltroProd] = useState('');

  async function cargar() {
    if (nuevo) return;
    const { data: c } = await supabase.from('clientes').select('*').eq('id', id).single();
    if (!c) return;
    const limpio = Object.fromEntries(CAMPOS.map((k) => [k, c[k] ?? VACIO[k]]));
    setForm(limpio); setOriginal(c);
    const { data: u } = await supabase.from('perfiles').select('*').eq('cliente_id', id);
    setUsuarios(u || []);
    const { data: cp } = await supabase.from('cliente_productos').select('producto_id').eq('cliente_id', id);
    setHabilitados(new Set((cp || []).map((x) => x.producto_id)));
  }

  useEffect(() => { cargar(); }, [id]);
  useEffect(() => {
    if (form.restringir_catalogo && !productos.length) {
      supabase.from('productos').select('id, nombre, presentacion, activo, categoria:categorias(nombre, orden)').order('orden')
        .then(({ data }) => setProductos(data || []));
    }
  }, [form.restringir_catalogo]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleDia = (d) => setForm((f) => ({ ...f, dias_cerrado: f.dias_cerrado.includes(d) ? f.dias_cerrado.filter((x) => x !== d) : [...f.dias_cerrado, d].sort() }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setMensaje(null);
    try {
      const datos = { ...form, email: form.email.trim().toLowerCase() };
      if (nuevo) {
        const r = await api('admin', { accion: 'crear_cliente', cliente: datos, modo: datos.email ? modo : 'sin_acceso' });
        if (r.clave_provisoria || r.usuario_id) setAcceso({ ...r, email: datos.email, id: r.cliente.id });
        else navigate(`/admin/clientes/${r.cliente.id}`, { replace: true });
        return;
      }
      if (datos.email !== (original.email || '') && usuarios.length) {
        await api('admin', { accion: 'cambiar_email_cliente', cliente_id: id, email: datos.email });
      }
      const { error } = await supabase.from('clientes').update(datos).eq('id', id);
      if (error) throw new Error('No se pudo guardar.');
      if (datos.restringir_catalogo) {
        await supabase.from('cliente_productos').delete().eq('cliente_id', id);
        if (habilitados.size) {
          const { error: e2 } = await supabase.from('cliente_productos').insert([...habilitados].map((p) => ({ cliente_id: id, producto_id: p })));
          if (e2) throw new Error('Se guardó la ficha, pero no los productos habilitados.');
        }
      }
      setMensaje({ tipo: 'ok', texto: 'Cambios guardados.' });
      await cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function accion(body, confirmar) {
    if (confirmar && !window.confirm(confirmar)) return;
    setMensaje(null);
    try {
      const r = await api('admin', body);
      if (r.clave_provisoria || r.usuario_id || r.email_enviado) setAcceso({ ...r, email: form.email });
      else setMensaje({ tipo: 'ok', texto: 'Listo.' });
      await cargar();
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  const productosFiltrados = useMemo(() => {
    const q = filtroProd.toLowerCase();
    return productos.filter((p) => !q || `${p.nombre} ${p.categoria?.nombre}`.toLowerCase().includes(q));
  }, [productos, filtroProd]);

  if (!nuevo && !original) return <div className="cargando">Cargando…</div>;

  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link to="/admin/clientes">‹ Clientes</Link></p>
      <h1>{nuevo ? 'Nuevo cliente' : nombreCliente(original)}</h1>
      {original && original.estado !== 'activo' && <div className="aviso alerta">Este cliente está <b>{original.estado === 'baja' ? 'dado de baja' : 'suspendido'}</b> y no puede ingresar.</div>}

      <form className="tarjeta" onSubmit={guardar}>
        <div className="grilla">
          <Campo id="rs" etiqueta="Razón social *" value={form.razon_social} onChange={set('razon_social')} required />
          <Campo id="nf" etiqueta="Nombre de fantasía" value={form.nombre_fantasia} onChange={set('nombre_fantasia')} ayuda="Es el nombre que se ve en los pedidos." />
          <Campo id="cuit" etiqueta="CUIT (opcional)" value={form.cuit} onChange={set('cuit')} inputMode="numeric" />
          <Campo id="em" etiqueta="Email de acceso" type="email" value={form.email} onChange={set('email')} ayuda="Con este email entra a la app y recibe las confirmaciones." />
          <Campo id="tel" etiqueta="Teléfono" type="tel" value={form.telefono} onChange={set('telefono')} />
          <Campo id="hl" etiqueta="Horario límite de entrega" value={form.horario_limite} onChange={set('horario_limite')} placeholder="hasta las 11 hs" />
        </div>
        <Campo id="dir" etiqueta="Dirección de entrega" value={form.direccion} onChange={set('direccion')} />
        <label>Días que está cerrado</label>
        <div className="fila">
          {ORDEN_DIAS.map((d) => (
            <label key={d} className="check" style={{ margin: '2px 8px 2px 0' }}>
              <input type="checkbox" checked={form.dias_cerrado.includes(d)} onChange={() => toggleDia(d)} /> {NOMBRES_DIAS[d].slice(0, 3)}
            </label>
          ))}
        </div>
        <label htmlFor="obsf">Observaciones fijas</label>
        <textarea id="obsf" value={form.observaciones_fijas} onChange={set('observaciones_fijas')} placeholder="Ej.: va sin cargo · retira por sucursal Peña" />
        <div className="ayuda">Aparecen en todos sus pedidos, en el email y en el PDF.</div>
        <label className="check"><input type="checkbox" checked={form.ve_precios} onChange={set('ve_precios')} /> Ve los precios</label>
        <label className="check"><input type="checkbox" checked={form.restringir_catalogo} onChange={set('restringir_catalogo')} /> Ve solo algunos productos</label>

        {form.restringir_catalogo && (
          <div className="tarjeta" style={{ background: 'var(--crema)' }}>
            {nuevo ? <p className="suave" style={{ margin: 0 }}>Guardá el cliente y después elegí sus productos.</p> : (
              <>
                <div className="entre"><b>Productos habilitados ({habilitados.size})</b>
                  <span className="fila">
                    <button type="button" className="chico" onClick={() => setHabilitados(new Set(productos.map((p) => p.id)))}>Todos</button>
                    <button type="button" className="chico" onClick={() => setHabilitados(new Set())}>Ninguno</button>
                  </span>
                </div>
                <input type="search" placeholder="Filtrar…" value={filtroProd} onChange={(e) => setFiltroProd(e.target.value)} style={{ margin: '8px 0' }} />
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  {productosFiltrados.map((p) => (
                    <label key={p.id} className="check" style={{ margin: '4px 0' }}>
                      <input type="checkbox" checked={habilitados.has(p.id)} onChange={() => setHabilitados((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} />
                      <span>{p.nombre} <small>· {p.presentacion}{!p.activo ? ' · inactivo' : ''}</small></span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {nuevo && form.email && (
          <div className="tarjeta" style={{ background: 'var(--crema)' }}>
            <b>Acceso a la app</b>
            <label className="check"><input type="radio" name="modo" checked={modo === 'invitacion'} onChange={() => setModo('invitacion')} /> Mandarle un email para que defina su contraseña</label>
            <label className="check"><input type="radio" name="modo" checked={modo === 'provisoria'} onChange={() => setModo('provisoria')} /> Generar una contraseña provisoria (se la paso yo)</label>
            <label className="check"><input type="radio" name="modo" checked={modo === 'sin_acceso'} onChange={() => setModo('sin_acceso')} /> Sin acceso por ahora</label>
          </div>
        )}

        {mensaje && <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button className="primario ancho" style={{ marginTop: 12 }} disabled={guardando}>{guardando ? 'Guardando…' : nuevo ? 'Crear cliente' : 'Guardar cambios'}</button>
      </form>

      {!nuevo && (
        <div className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Acceso y estado</h2>
          {usuarios.length ? (
            <p style={{ marginTop: 0 }}>Ingresa con <b>{usuarios[0].email}</b>{!usuarios[0].activo && ' (bloqueado)'}</p>
          ) : <p style={{ marginTop: 0 }} className="suave">Todavía no tiene acceso a la app.</p>}
          <div className="fila">
            {!usuarios.length ? (
              <>
                <button onClick={() => accion({ accion: 'crear_acceso_cliente', cliente_id: id, modo: 'invitacion' })}>Crear acceso e invitar por email</button>
                <button onClick={() => accion({ accion: 'crear_acceso_cliente', cliente_id: id, modo: 'provisoria' })}>Crear acceso con contraseña provisoria</button>
              </>
            ) : (
              <>
                <button onClick={() => accion({ accion: 'reenviar_acceso', cliente_id: id, modo: 'invitacion' })}>Reenviar invitación</button>
                <button onClick={() => accion({ accion: 'reenviar_acceso', cliente_id: id, modo: 'provisoria' }, 'Se va a generar una contraseña nueva y la anterior deja de funcionar. ¿Seguir?')}>Nueva contraseña provisoria</button>
              </>
            )}
            <Link className="boton" to={`/admin/cargar-pedido?cliente=${id}`}>Cargar pedido</Link>
          </div>
          <div className="fila" style={{ marginTop: 10 }}>
            {original.estado !== 'activo' && <button onClick={() => accion({ accion: 'estado_cliente', cliente_id: id, estado: 'activo' })}>Reactivar</button>}
            {original.estado === 'activo' && <button className="peligro" onClick={() => accion({ accion: 'estado_cliente', cliente_id: id, estado: 'suspendido' }, 'El cliente no va a poder ingresar ni hacer pedidos. ¿Suspender?')}>Suspender</button>}
            {original.estado !== 'baja' && <button className="peligro" onClick={() => accion({ accion: 'estado_cliente', cliente_id: id, estado: 'baja' }, '¿Dar de baja al cliente? Sus pedidos anteriores se conservan.')}>Dar de baja</button>}
          </div>
        </div>
      )}

      {acceso && <AccesoCreado resultado={acceso} email={acceso.email} onCerrar={() => { const nid = acceso.id; setAcceso(null); if (nid) navigate(`/admin/clientes/${nid}`, { replace: true }); }} />}
    </>
  );
}
