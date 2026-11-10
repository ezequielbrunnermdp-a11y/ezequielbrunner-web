import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { nombreCliente, NOMBRES_DIAS } from '../../lib/formato.js';

const sinAcentos = (s = '') => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function Clientes() {
  const [clientes, setClientes] = useState(null);
  const [accesos, setAccesos] = useState(new Set());
  const [q, setQ] = useState('');
  const [verBajas, setVerBajas] = useState(false);

  useEffect(() => {
    supabase.from('clientes').select('*').order('razon_social').then(({ data }) => setClientes(data || []));
    supabase.from('perfiles').select('cliente_id').eq('rol', 'cliente').then(({ data }) => setAccesos(new Set((data || []).map((p) => p.cliente_id))));
  }, []);

  const lista = useMemo(() => (clientes || []).filter((c) =>
    (verBajas || c.estado !== 'baja') && sinAcentos(`${c.razon_social} ${c.nombre_fantasia || ''} ${c.email || ''}`).includes(sinAcentos(q))), [clientes, q, verBajas]);

  return (
    <>
      <div className="entre">
        <h1>Clientes</h1>
        <Link className="boton primario chico" to="/admin/clientes/nuevo">+ Nuevo cliente</Link>
      </div>
      <input type="search" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
      <label className="check"><input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} /> Mostrar dados de baja</label>
      {clientes === null && <div className="cargando">Cargando…</div>}
      {lista.map((c) => (
        <Link key={c.id} to={`/admin/clientes/${c.id}`} className="tarjeta" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div className="entre">
            <div>
              <h3>{nombreCliente(c)}</h3>
              <small>{c.email || 'sin email'}{c.horario_limite ? ` · ${c.horario_limite}` : ''}</small>
              {c.dias_cerrado?.length > 0 && <div><small>Cerrado: {c.dias_cerrado.map((d) => NOMBRES_DIAS[d]).join(', ')}</small></div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`etiqueta ${c.estado}`}>{c.estado}</span>
              {!accesos.has(c.id) && <div><span className="etiqueta">sin acceso</span></div>}
              {!c.ve_precios && <div><span className="etiqueta">no ve precios</span></div>}
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}
