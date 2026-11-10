import { admin, appUrl } from './supa.js';
import { enviarEmail, emailsPedidos, esc, plantilla } from './email.js';
import { pdfPedido } from './pdf.js';
import {
  cantidadCorta, descripcion, diferencias, fmtCantidad, fmtFechaCorta, fmtFechaLarga, fmtMoneda, nombreCliente,
} from '../../../src/lib/formato.js';

export async function cargarPedido(id) {
  const { data: pedido, error } = await admin.from('pedidos').select('*, cliente:clientes(*)').eq('id', id).single();
  if (error) throw error;
  const { data: items } = await admin.from('pedido_items').select('*').eq('pedido_id', id).order('id');
  return { pedido, cliente: pedido.cliente, items: items || [] };
}

const fila = (izq, der, estilo = '') =>
  `<tr style="${estilo}"><td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap;text-align:right;vertical-align:top"><b>${izq}</b></td><td style="padding:6px 8px;border-bottom:1px solid #eee">${der}</td></tr>`;

const dato = (etiqueta, valor, destacar = false) =>
  valor ? `<div style="margin:2px 0${destacar ? ';background:#fff4d6;padding:4px 6px;border-radius:4px' : ''}"><b>${esc(etiqueta)}:</b> ${esc(valor)}</div>` : '';

/**
 * Envía el email a El Cóndor (con PDF) y la confirmación al cliente.
 * resultado: lo que devolvió guardar_pedido (para saber si es modificación y qué cambió)
 */
export async function notificarPedido(pedidoId, resultado = {}) {
  const { pedido, cliente, items } = await cargarPedido(pedidoId);
  const esMod = pedido.version > 1 && !resultado.reactivado;
  const actuales = items.map((i) => ({ producto_id: i.producto_id, nombre: i.producto_nombre, presentacion: i.presentacion, cantidad: Number(i.cantidad) }));
  const cambios = esMod ? diferencias(resultado.items_anteriores || [], actuales) : [];
  const obsCambio = esMod && (resultado.observacion_anterior || '') !== (pedido.observacion || '');
  const nombre = nombreCliente(cliente);
  const fecha = fmtFechaCorta(pedido.fecha_entrega);

  // ---------- Email a El Cóndor ----------
  const marca = new Map(cambios.map((c) => [c.item.producto_id, c]));
  const filas = items.map((i) => {
    const c = marca.get(i.producto_id);
    const extra = c?.tipo === 'agregado' ? ' <span style="color:#1d7a35;font-weight:bold">NUEVO</span>'
      : c?.tipo === 'cambiado' ? ` <span style="color:#b25b00;font-weight:bold">(antes ${esc(cantidadCorta(c.antes, i.presentacion))})</span>` : '';
    return fila(esc(cantidadCorta(i.cantidad, i.presentacion)), esc(descripcion(i.producto_nombre, i.presentacion)) + extra, c ? 'background:#fff4d6' : '');
  }).join('');
  const quitados = cambios.filter((c) => c.tipo === 'quitado').map((c) =>
    fila(`<s>${esc(cantidadCorta(c.item.cantidad, c.item.presentacion))}</s>`, `<s>${esc(descripcion(c.item.nombre, c.item.presentacion))}</s> <span style="color:#b00020;font-weight:bold">QUITADO</span>`, 'background:#fde8ea')).join('');

  const resumenCambios = esMod ? `<div style="background:#fff4d6;border:1px solid #e9c46a;padding:10px;border-radius:6px;margin-bottom:12px">
      <b>⚠ PEDIDO MODIFICADO (versión ${pedido.version})</b><br>
      ${cambios.map((c) => c.tipo === 'agregado' ? `+ Agregado: ${esc(c.item.nombre)} ${esc(fmtCantidad(c.item.cantidad, c.item.presentacion))}`
        : c.tipo === 'quitado' ? `− Quitado: ${esc(c.item.nombre)}`
        : `↻ ${esc(c.item.nombre)}: ${esc(fmtCantidad(c.antes, c.item.presentacion))} → ${esc(fmtCantidad(c.item.cantidad, c.item.presentacion))}`).join('<br>')}
      ${obsCambio ? `<br>↻ Cambió la observación` : ''}
      ${!cambios.length && !obsCambio ? 'Se volvió a confirmar sin cambios en los productos.' : ''}
    </div>` : '';

  const htmlFabrica = plantilla(`Pedido #${pedido.id} – ${nombre}`, `
    ${resumenCambios}
    <div style="margin-bottom:12px">
      ${dato('Entrega', fmtFechaLarga(pedido.fecha_entrega))}
      ${dato('Cliente', nombre)}
      ${dato('Dirección', cliente.direccion)}
      ${dato('Horario límite', cliente.horario_limite)}
      ${dato('Teléfono', cliente.telefono)}
      ${dato('Obs. fijas', cliente.observaciones_fijas, true)}
      ${dato('Observación del pedido', pedido.observacion, true)}
      ${pedido.cargado_por_admin ? '<div style="color:#777">Cargado por El Cóndor en nombre del cliente.</div>' : ''}
    </div>
    <table style="border-collapse:collapse;width:100%;font-size:15px">${filas}${quitados}</table>
    <p style="color:#777;font-size:13px">El PDF para imprimir va adjunto.</p>`);

  const pdf = await pdfPedido({ pedido, cliente, items, cambios });
  const asunto = `${esMod ? 'MODIFICADO – ' : ''}Pedido #${pedido.id} – ${nombre} – entrega ${fecha}`;
  const resultadoEnvio = { fabrica: false, cliente: false };

  try {
    await enviarEmail({
      to: emailsPedidos(), subject: asunto, html: htmlFabrica,
      attachments: [{ filename: `pedido-${pedido.id}${esMod ? `-v${pedido.version}` : ''}.pdf`, content: pdf }],
    });
    resultadoEnvio.fabrica = true;
  } catch (e) { console.error('Email a El Cóndor', e); }

  // ---------- Confirmación al cliente ----------
  const destinoCliente = cliente.email;
  if (destinoCliente) {
    const conPrecio = cliente.ve_precios;
    const filasCli = items.map((i) => fila(esc(cantidadCorta(i.cantidad, i.presentacion)),
      esc(descripcion(i.producto_nombre, i.presentacion)) + (conPrecio ? `<div style="color:#777;font-size:13px">${fmtMoneda(i.cantidad * i.precio_unitario)}</div>` : ''))).join('');
    const htmlCliente = plantilla(esMod ? `Modificamos tu pedido #${pedido.id}` : `¡Recibimos tu pedido #${pedido.id}!`, `
      <p>Entrega: <b>${esc(fmtFechaLarga(pedido.fecha_entrega))}</b>${cliente.direccion ? ` en ${esc(cliente.direccion)}` : ''}.</p>
      <table style="border-collapse:collapse;width:100%;font-size:15px">${filasCli}</table>
      ${conPrecio ? `<p style="text-align:right"><b>Total: ${fmtMoneda(pedido.total_sin_iva)}</b> <span style="color:#777">+ IVA</span></p>` : ''}
      ${pedido.observacion ? `<p><b>Tu observación:</b> ${esc(pedido.observacion)}</p>` : ''}
      <p>Podés modificarlo hasta la hora de corte desde <a href="${appUrl()}">la app de pedidos</a>.</p>`);
    try {
      await enviarEmail({ to: destinoCliente, subject: `${esMod ? 'Pedido modificado' : 'Pedido recibido'} #${pedido.id} – entrega ${fecha}`, html: htmlCliente });
      resultadoEnvio.cliente = true;
    } catch (e) { console.error('Email al cliente', e); }
  }
  return resultadoEnvio;
}

// Aviso de cancelación a El Cóndor y al cliente
export async function notificarCancelacion(pedidoId) {
  const { pedido, cliente } = await cargarPedido(pedidoId);
  const nombre = nombreCliente(cliente);
  const fecha = fmtFechaCorta(pedido.fecha_entrega);
  const r = { fabrica: false, cliente: false };
  try {
    await enviarEmail({
      to: emailsPedidos(),
      subject: `CANCELADO – Pedido #${pedido.id} – ${nombre} – entrega ${fecha}`,
      html: plantilla(`Pedido #${pedido.id} CANCELADO`, `<div style="background:#fde8ea;color:#b00020;padding:10px;border-radius:6px"><b>${esc(nombre)}</b> canceló su pedido para el <b>${esc(fmtFechaLarga(pedido.fecha_entrega))}</b>. No hay que prepararlo.</div>`),
    });
    r.fabrica = true;
  } catch (e) { console.error(e); }
  if (cliente.email) {
    try {
      await enviarEmail({
        to: cliente.email,
        subject: `Pedido cancelado #${pedido.id} – entrega ${fecha}`,
        html: plantilla(`Cancelamos tu pedido #${pedido.id}`, `<p>El pedido para el <b>${esc(fmtFechaLarga(pedido.fecha_entrega))}</b> quedó cancelado.</p><p>Si fue un error, podés volver a cargarlo desde <a href="${appUrl()}">la app</a> antes de la hora de corte.</p>`),
      });
      r.cliente = true;
    } catch (e) { console.error(e); }
  }
  return r;
}
