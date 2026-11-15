/**
 * Parser de listados de movimientos/trámites copiados como texto (por ejemplo, desde la
 * pantalla de trámites de la MEV consultada personalmente por el usuario, o desde una
 * planilla). Formato esperado: una línea por movimiento que empieza con una fecha
 * dd/mm/aaaa (o dd-mm-aaaa / dd.mm.aaaa), seguida de la descripción. Las líneas sin fecha
 * se consideran continuación del movimiento anterior.
 *
 * No depende del HTML de la MEV (que no está documentado públicamente): trabaja sobre texto.
 */
export type Movimiento = { fecha: string; descripcion: string; linea: number };

const DATE_RE = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b[\s\-–:|\t]*(.*)$/;

export function parseMovimientos(text: string): { movimientos: Movimiento[]; descartadas: string[] } {
  const movimientos: Movimiento[] = [];
  const descartadas: string[] = [];
  text
    .replace(/\r/g, "")
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const m = line.match(DATE_RE);
      if (m) {
        const [, d, mo, y, rest] = m;
        const year = y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y;
        const iso = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
        if (!isValidDate(iso)) {
          descartadas.push(line);
          return;
        }
        movimientos.push({ fecha: iso, descripcion: rest.trim(), linea: i + 1 });
      } else if (movimientos.length) {
        const last = movimientos[movimientos.length - 1];
        last.descripcion = `${last.descripcion} ${line}`.trim();
      } else {
        descartadas.push(line);
      }
    });
  return { movimientos: movimientos.filter((m) => m.descripcion), descartadas };
}

function isValidDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Clasificación heurística del movimiento por palabras clave (el usuario puede corregir). */
export function categorizarMovimiento(desc: string): { tipo: string; categoria: string } {
  const d = desc
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const rules: [RegExp, string, string][] = [
    [/sentencia.*(camara|alzada)|(camara|alzada).*sentencia/, "sentencia_camara", "sentencia"],
    [/sentencia/, "sentencia_primera", "sentencia"],
    [/expres(a|ion de) agravios|memorial/, "expresion_agravios", "recurso"],
    [/apela|recurso|queja|extraordinario|inaplicabilidad/, "recurso", "recurso"],
    [/contesta(cion)? (de )?demanda|contesta traslado de (la )?demanda/, "contestacion", "contestacion"],
    [/excepcion/, "excepciones", "contestacion"],
    [/amplia(cion)? (de )?demanda/, "ampliacion_demanda", "demanda"],
    [/demanda|inicia/, "demanda", "demanda"],
    [/pericia|perito|dictamen pericial/, "pericia", "prueba"],
    [/testig|testimonial|declaracion/, "testimonial", "prueba"],
    [/absolucion|posiciones/, "absolucion_posiciones", "prueba"],
    [/oficio|informativa|informe de/, "informativa", "prueba"],
    [/prueba|documental/, "prueba_documental", "prueba"],
    [/liquidacion/, "liquidacion", "otro"],
    [/cedula|notifica/, "cedula_notificacion", "resolucion"],
    [/resolucion|interlocutori|auto /, "resolucion", "resolucion"],
    [/provei|providencia|despacho|tengase|agreguese|autos/, "providencia", "resolucion"],
  ];
  for (const [re, tipo, categoria] of rules) if (re.test(d)) return { tipo, categoria };
  return { tipo: "otro", categoria: "otro" };
}
