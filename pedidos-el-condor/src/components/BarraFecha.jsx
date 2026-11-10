import { useSearchParams } from 'react-router-dom';
import { ahoraAR, fmtFechaLarga, sumarDias } from '../lib/formato.js';

// Fecha de entrega en la URL (?fecha=), con atajos Hoy / Mañana
export function useFecha() {
  const [params, setParams] = useSearchParams();
  const hoy = ahoraAR().fecha;
  const fecha = params.get('fecha') || sumarDias(hoy, 1);
  const setFecha = (f) => setParams((p) => { const n = new URLSearchParams(p); n.set('fecha', f); return n; });
  return [fecha, setFecha, hoy];
}

export default function BarraFecha({ fecha, setFecha, hoy, children }) {
  const manana = sumarDias(hoy, 1);
  return (
    <div className="tarjeta">
      <div className="fila">
        <button className="chico" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">‹</button>
        <input className="crece" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Fecha de entrega" />
        <button className="chico" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">›</button>
      </div>
      <div className="fila" style={{ marginTop: 8 }}>
        <button className={`chico${fecha === hoy ? ' primario' : ''}`} onClick={() => setFecha(hoy)}>Hoy</button>
        <button className={`chico${fecha === manana ? ' primario' : ''}`} onClick={() => setFecha(manana)}>Mañana</button>
        <span className="crece" style={{ textAlign: 'right' }}>Entrega <b>{fmtFechaLarga(fecha)}</b></span>
      </div>
      {children}
    </div>
  );
}
