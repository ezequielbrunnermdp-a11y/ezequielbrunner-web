import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ordenClientes, ordenarItems, ordenReparto, totalesProduccion } from '../../../src/lib/resumen.js';
import { cantidadCorta, descripcion, fmtCantidad, fmtFechaLarga, fmtFechaHora, nombreCliente } from '../../../src/lib/formato.js';

const A4 = [595.28, 841.89];
const M = 36; // margen
const GRIS = rgb(0.45, 0.42, 0.4);
const LINEA = rgb(0.75, 0.72, 0.68);
const MARRON = rgb(0.35, 0.18, 0.1);

// Documento simple con salto de página automático y tablas con texto en varias líneas.
export class Doc {
  static async crear() {
    const pdf = await PDFDocument.create();
    const d = new Doc(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold));
    d.nuevaPagina();
    return d;
  }

  constructor(pdf, font, bold) {
    Object.assign(this, { pdf, font, bold, ancho: A4[0] - 2 * M, cache: new Map() });
  }

  nuevaPagina() {
    this.page = this.pdf.addPage(A4);
    this.y = A4[1] - M;
    if (this.alNuevaPagina) this.alNuevaPagina();
  }

  // Reemplaza caracteres que la fuente estándar no puede dibujar
  limpiar(s, font = this.font) {
    return [...String(s ?? '')].map((ch) => {
      const k = `${font === this.bold ? 'b' : 'r'}${ch}`;
      if (!this.cache.has(k)) {
        try { font.widthOfTextAtSize(ch, 10); this.cache.set(k, ch); } catch { this.cache.set(k, '?'); }
      }
      return this.cache.get(k);
    }).join('');
  }

  partir(texto, ancho, size, font = this.font) {
    const lineas = [];
    for (const parrafo of this.limpiar(texto, font).split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (font.widthOfTextAtSize(prueba, size) <= ancho) actual = prueba;
        else { if (actual) lineas.push(actual); actual = palabra; }
      }
      lineas.push(actual);
    }
    return lineas;
  }

  espacio(h) { if (this.y - h < M) this.nuevaPagina(); }

  texto(t, { size = 10, bold = false, color = rgb(0, 0, 0), x = M, ancho = this.ancho, gap = 3 } = {}) {
    const font = bold ? this.bold : this.font;
    for (const l of this.partir(t, ancho, size, font)) {
      this.espacio(size + gap);
      this.page.drawText(l, { x, y: this.y - size, size, font, color });
      this.y -= size + gap;
    }
  }

  linea(grosor = 0.8, color = LINEA) {
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + this.ancho, y: this.y }, thickness: grosor, color });
  }

  saltar(h) { this.y -= h; }

  encabezado(titulo, subtitulo) {
    this.texto('EL CÓNDOR', { size: 20, bold: true, color: MARRON, gap: 2 });
    this.texto('Panadería tradicional · Mar del Plata', { size: 10, color: GRIS, gap: 8 });
    this.linea(1.5, MARRON);
    this.saltar(14);
    this.texto(titulo, { size: 15, bold: true, gap: 4 });
    if (subtitulo) this.texto(subtitulo, { size: 11, gap: 4 });
    this.saltar(6);
  }

  // Par etiqueta: valor en una línea
  dato(etiqueta, valor) {
    if (!valor) return;
    const ancho = 110;
    const lineas = this.partir(valor, this.ancho - ancho, 10);
    this.espacio(13 * lineas.length);
    this.page.drawText(this.limpiar(etiqueta, this.bold), { x: M, y: this.y - 10, size: 10, font: this.bold });
    lineas.forEach((l, i) => this.page.drawText(l, { x: M + ancho, y: this.y - 10 - i * 13, size: 10, font: this.font }));
    this.y -= 13 * lineas.length + 2;
  }

  /**
   * columnas: [{ titulo, ancho (proporción), align }]
   * filas: [[celda, ...]] — celda puede ser string o string[] (varias líneas)
   */
  tabla(columnas, filas, { size = 10, pad = 5, cabeceraBg = rgb(0.93, 0.9, 0.86) } = {}) {
    const total = columnas.reduce((s, c) => s + c.ancho, 0);
    const anchos = columnas.map((c) => (c.ancho / total) * this.ancho);
    const xs = anchos.map((_, i) => M + anchos.slice(0, i).reduce((s, a) => s + a, 0));
    const alto = size + 3;

    const dibujarFila = (celdas, { bold = false, bg } = {}) => {
      const font = bold ? this.bold : this.font;
      const lineas = celdas.map((c, i) =>
        (Array.isArray(c) ? c : [c ?? '']).flatMap((t) => this.partir(t, anchos[i] - 2 * pad, size, font)));
      const h = Math.max(...lineas.map((l) => l.length)) * alto + 2 * pad - 3;
      if (this.y - h < M) { this.nuevaPagina(); if (!bold) dibujarFila(columnas.map((c) => c.titulo), { bold: true, bg: cabeceraBg }); }
      if (bg) this.page.drawRectangle({ x: M, y: this.y - h, width: this.ancho, height: h, color: bg });
      lineas.forEach((ls, i) => ls.forEach((l, j) => {
        const w = font.widthOfTextAtSize(l, size);
        const x = columnas[i].align === 'right' ? xs[i] + anchos[i] - pad - w
          : columnas[i].align === 'center' ? xs[i] + (anchos[i] - w) / 2 : xs[i] + pad;
        this.page.drawText(l, { x, y: this.y - pad - size + 1 - j * alto, size, font });
      }));
      // bordes
      xs.concat(M + this.ancho).forEach((x) =>
        this.page.drawLine({ start: { x, y: this.y }, end: { x, y: this.y - h }, thickness: 0.5, color: LINEA }));
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + this.ancho, y: this.y }, thickness: 0.5, color: LINEA });
      this.y -= h;
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + this.ancho, y: this.y }, thickness: 0.5, color: LINEA });
    };

    dibujarFila(columnas.map((c) => c.titulo), { bold: true, bg: cabeceraBg });
    filas.forEach((f) => dibujarFila(f));
    this.saltar(8);
  }

  pieDePagina(texto) {
    const paginas = this.pdf.getPages();
    paginas.forEach((p, i) => {
      const t = this.limpiar(`${texto} · Página ${i + 1} de ${paginas.length}`);
      p.drawText(t, { x: M, y: 18, size: 8, font: this.font, color: GRIS });
    });
  }

  guardar() { return this.pdf.save(); }
}

// PDF de un pedido individual (para imprimir en la fábrica)
export async function pdfPedido({ pedido, cliente, items, cambios = [] }) {
  const d = await Doc.crear();
  const titulo = `Pedido #${pedido.id}${pedido.version > 1 ? ` · MODIFICADO (versión ${pedido.version})` : ''}`;
  d.encabezado(titulo, `Entrega: ${fmtFechaLarga(pedido.fecha_entrega)}`);
  d.dato('Cliente', nombreCliente(cliente) + (cliente.nombre_fantasia && cliente.razon_social !== cliente.nombre_fantasia ? ` (${cliente.razon_social})` : ''));
  d.dato('Dirección', cliente.direccion);
  d.dato('Horario límite', cliente.horario_limite);
  d.dato('Teléfono', cliente.telefono);
  d.dato('Obs. fijas', cliente.observaciones_fijas);
  d.dato('Obs. del pedido', pedido.observacion);
  d.dato('Recibido', fmtFechaHora(pedido.updated_at) + (pedido.cargado_por_admin ? ' · cargado por El Cóndor' : ''));
  d.saltar(8);

  const marca = new Map(cambios.filter((c) => c.tipo !== 'quitado').map((c) => [c.item.producto_id, c]));
  d.tabla(
    [{ titulo: 'Cant.', ancho: 0.9, align: 'right' }, { titulo: 'Producto', ancho: 4.2 }, { titulo: 'Cambio', ancho: 1.2 }, { titulo: 'OK', ancho: 0.5, align: 'center' }],
    items.map((i) => {
      const c = marca.get(i.producto_id);
      return [cantidadCorta(i.cantidad, i.presentacion), descripcion(i.producto_nombre, i.presentacion),
        c ? (c.tipo === 'agregado' ? 'NUEVO' : `antes: ${cantidadCorta(c.antes, i.presentacion)}`) : '', ''];
    }),
  );
  const quitados = cambios.filter((c) => c.tipo === 'quitado');
  if (quitados.length) {
    d.texto('Quitados del pedido:', { bold: true });
    quitados.forEach((c) => d.texto(`- ${c.item.nombre} (${fmtCantidad(c.item.cantidad, c.item.presentacion)})`));
  }
  d.pieDePagina(`El Cóndor · Pedido #${pedido.id}`);
  return d.guardar();
}

// ---------- PDF "Pedidos del día" (mismo formato que la planilla manual) ----------
export async function pdfPedidosDelDia({ fecha, pedidos }) {
  const activos = ordenClientes(pedidos.filter((p) => p.estado !== 'cancelado'));
  const d = await Doc.crear();
  d.texto('EL CÓNDOR · Panadería tradicional · Mar del Plata', { size: 14, bold: true, color: MARRON, gap: 4 });
  d.texto(`Pedidos del día · ${fmtFechaLarga(fecha)}`, { size: 12, bold: true, gap: 8 });
  d.linea(1.5, MARRON);
  d.saltar(10);

  if (!activos.length) d.texto('No hay pedidos para esta fecha.');
  else {
    d.tabla(
      [{ titulo: 'Cliente', ancho: 1.5 }, { titulo: 'Pedido', ancho: 3.4 }, { titulo: 'Cumplido', ancho: 0.85, align: 'center' },
        { titulo: 'No cumplido', ancho: 0.95, align: 'center' }, { titulo: 'Observaciones', ancho: 1.8 }],
      activos.map((p) => [
        [nombreCliente(p.cliente), ...(p.cliente.horario_limite ? [p.cliente.horario_limite] : []), `#${p.id}${p.modificado ? ' (MODIF.)' : ''}`],
        ordenarItems(p.pedido_items).map((i) => `${cantidadCorta(i.cantidad, i.presentacion)}  ${descripcion(i.producto_nombre, i.presentacion)}`),
        '', '',
        [p.cliente.observaciones_fijas, p.observacion].filter(Boolean),
      ]),
      { size: 9 },
    );
    d.texto(`Total de pedidos: ${activos.length}`, { size: 11, bold: true, gap: 10 });
  }

  const totales = totalesProduccion(activos);
  if (totales.length) {
    d.saltar(10);
    d.espacio(60);
    d.texto('Totales para producción', { size: 14, bold: true, color: MARRON, gap: 6 });
    d.tabla(
      [{ titulo: 'Producto', ancho: 4 }, { titulo: 'Total', ancho: 1.6, align: 'right' }, { titulo: 'Clientes', ancho: 0.8, align: 'center' }],
      totales.map((t) => [descripcion(t.producto_nombre, t.presentacion), fmtCantidad(t.cantidad, t.presentacion).replace(` × ${t.presentacion}`, ''), String(t.clientes)]),
      { size: 10 },
    );
  }
  d.pieDePagina(`El Cóndor · Pedidos del día ${fmtFechaLarga(fecha)} · generado ${fmtFechaHora(new Date())}`);
  return d.guardar();
}

// ---------- Hoja de reparto ----------
export async function pdfReparto({ fecha, pedidos }) {
  const lista = ordenReparto(pedidos);
  const d = await Doc.crear();
  d.encabezado(`Hoja de reparto · ${fmtFechaLarga(fecha)}`, `${lista.length} entregas, ordenadas por horario límite`);
  d.tabla(
    [{ titulo: '#', ancho: 0.35, align: 'center' }, { titulo: 'Cliente y dirección', ancho: 2.6 }, { titulo: 'Horario', ancho: 1.1 },
      { titulo: 'Obs.', ancho: 1.8 }, { titulo: 'Ítems', ancho: 0.55, align: 'center' }, { titulo: 'Entregado / firma', ancho: 1.5 }],
    lista.map((p, n) => [
      String(n + 1),
      [nombreCliente(p.cliente), p.cliente.direccion || '', p.cliente.telefono ? `Tel. ${p.cliente.telefono}` : ''].filter(Boolean),
      p.cliente.horario_limite || '',
      [p.cliente.observaciones_fijas, p.observacion].filter(Boolean),
      String(p.pedido_items.length),
      '',
    ]),
    { size: 9, pad: 7 },
  );
  d.pieDePagina(`El Cóndor · Reparto ${fmtFechaLarga(fecha)}`);
  return d.guardar();
}
