// Formatos compartidos entre la app y el servidor (es-AR, hora de Buenos Aires).
export const TZ = 'America/Argentina/Buenos_Aires';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const NOMBRES_DIAS = DIAS_LARGOS;

// Fecha y hora actuales en Buenos Aires: { fecha: 'YYYY-MM-DD', hora: 'HH:MM:SS' }
export function ahoraAR(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` };
}

export const hoyAR = () => ahoraAR().fecha;

export function sumarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const fmtFechaCorta = (iso) => (iso ? `${DIAS[diaSemana(iso)]} ${ddmm(iso)}` : '');
export const fmtFechaLarga = (iso) => (iso ? `${DIAS_LARGOS[diaSemana(iso)]} ${ddmm(iso)}/${iso.slice(0, 4)}` : '');

export function fmtFechaHora(ts) {
  if (!ts) return '';
  const { fecha, hora } = ahoraAR(new Date(ts));
  return `${ddmm(fecha)} ${hora.slice(0, 5)}`;
}

const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
// "$ 1.890,00" (con espacio común para que se lea igual en email y PDF)
export const fmtMoneda = (n) => moneda.format(Number(n) || 0).replace(/\s/g, ' ');

const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
export const fmtNumero = (n) => numero.format(Number(n) || 0);

// "2,5 kg" · "12 u." · "3 × Docena (12 unidades)"
export function fmtCantidad(cant, presentacion = '') {
  const p = presentacion.trim().toLowerCase();
  if (p === 'kg') return `${fmtNumero(cant)} kg`;
  if (p === 'unidad') return `${fmtNumero(cant)} u.`;
  return `${fmtNumero(cant)} × ${presentacion}`;
}

// Hora de corte: un pedido para el día D se puede cargar o modificar hasta la hora de corte de D-1.
export function limitePedido(fechaEntrega, horaCorte = '20:00:00') {
  const hora = horaCorte.length === 5 ? `${horaCorte}:00` : horaCorte;
  return { fecha: sumarDias(fechaEntrega, -1), hora };
}

export function pedidoAbierto(fechaEntrega, horaCorte, ahora = ahoraAR()) {
  const lim = limitePedido(fechaEntrega, horaCorte);
  return `${ahora.fecha} ${ahora.hora}` <= `${lim.fecha} ${lim.hora}`;
}

export const nombreCliente = (c) => (c ? c.nombre_fantasia || c.razon_social : '');

export const ESTADOS = {
  recibido: 'Recibido',
  en_preparacion: 'En preparación',
  entregado: 'Entregado',
  entregado_faltantes: 'Entregado con faltantes',
  cancelado: 'Cancelado',
};

// Diferencias entre dos listas de ítems [{producto_id, nombre, presentacion, cantidad}]
export function diferencias(anteriores = [], actuales = []) {
  const prev = new Map(anteriores.map((i) => [i.producto_id, i]));
  const now = new Map(actuales.map((i) => [i.producto_id, i]));
  const cambios = [];
  for (const i of actuales) {
    const a = prev.get(i.producto_id);
    if (!a) cambios.push({ tipo: 'agregado', item: i });
    else if (Number(a.cantidad) !== Number(i.cantidad)) cambios.push({ tipo: 'cambiado', item: i, antes: Number(a.cantidad) });
  }
  for (const a of anteriores) if (!now.has(a.producto_id)) cambios.push({ tipo: 'quitado', item: a });
  return cambios;
}

// Para tablas: "7,5 kg" / "12 u." / "2"  +  "MEDIALUNAS ... (Caja de 120 unidades)"
const esSimple = (p = '') => ['kg', 'unidad'].includes(p.trim().toLowerCase());
export const cantidadCorta = (cant, presentacion) => (esSimple(presentacion) ? fmtCantidad(cant, presentacion) : fmtNumero(cant));
export const descripcion = (nombre, presentacion) => (esSimple(presentacion) ? nombre : `${nombre} (${presentacion})`);
