import { nombreCliente } from './formato.js';

// Consulta estándar de los pedidos de un día (con datos para ordenar por catálogo)
export const SELECT_DIA = '*, cliente:clientes(*), pedido_items(*, producto:productos(orden, categoria:categorias(nombre, orden)))';

const ordenItem = (i) => [i.producto?.categoria?.orden ?? 99999, i.producto?.orden ?? 99999];

export function ordenarItems(items) {
  return [...items].sort((a, b) => {
    const [ca, pa] = ordenItem(a); const [cb, pb] = ordenItem(b);
    return ca - cb || pa - pb || a.producto_nombre.localeCompare(b.producto_nombre);
  });
}

// Suma por producto de todos los pedidos activos
export function totalesProduccion(pedidos) {
  const m = new Map();
  for (const p of pedidos) {
    if (p.estado === 'cancelado') continue;
    for (const i of p.pedido_items) {
      const t = m.get(i.producto_id) || {
        producto_id: i.producto_id, producto_nombre: i.producto_nombre, presentacion: i.presentacion,
        categoria: i.producto?.categoria?.nombre || '', producto: i.producto, cantidad: 0, clientes: 0,
      };
      t.cantidad += Number(i.cantidad);
      t.clientes += 1;
      m.set(i.producto_id, t);
    }
  }
  return ordenarItems([...m.values()]);
}

// "hasta las 10:30 hs" → 630 (minutos). Sin hora → al final.
export function minutosLimite(txt) {
  const m = String(txt || '').match(/(\d{1,2})(?:[:.](\d{2}))?/);
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : 24 * 60;
}

export const ordenReparto = (pedidos) => pedidos.filter((p) => p.estado !== 'cancelado').sort((a, b) =>
  minutosLimite(a.cliente.horario_limite) - minutosLimite(b.cliente.horario_limite)
  || nombreCliente(a.cliente).localeCompare(nombreCliente(b.cliente)));

export const ordenClientes = (pedidos) => [...pedidos].sort((a, b) => nombreCliente(a.cliente).localeCompare(nombreCliente(b.cliente)));
