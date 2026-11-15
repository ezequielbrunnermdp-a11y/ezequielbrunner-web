/** Tipos de documento/actuación del proceso (compartido cliente/servidor). */
export const TIPOS_DOCUMENTO = {
  demanda: "Demanda",
  ampliacion_demanda: "Ampliación de demanda",
  contestacion: "Contestación de demanda",
  reconvencion: "Reconvención",
  excepciones: "Excepciones y defensas",
  prueba_documental: "Prueba documental",
  testimonial: "Testimonial / declaración",
  absolucion_posiciones: "Absolución de posiciones",
  pericia: "Pericia",
  observacion_pericia: "Observación / impugnación de pericia",
  informativa: "Prueba informativa",
  providencia: "Providencia / proveído",
  resolucion: "Resolución interlocutoria",
  sentencia_primera: "Sentencia de primera instancia",
  recurso: "Recurso / apelación",
  expresion_agravios: "Expresión de agravios / memorial",
  contestacion_agravios: "Contestación de agravios",
  sentencia_camara: "Sentencia de Cámara",
  liquidacion: "Liquidación",
  cedula_notificacion: "Cédula / notificación",
  escrito: "Otro escrito de parte",
  otro: "Otra actuación",
  sin_clasificar: "Sin clasificar",
} as const;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export function tipoLabel(t: string): string {
  return (TIPOS_DOCUMENTO as Record<string, string>)[t] ?? t;
}

/** Categorías para filtrar la cronología. */
export const CATEGORIAS = {
  demanda: "Demandas y escritos de inicio",
  contestacion: "Contestaciones y defensas",
  prueba: "Prueba",
  resolucion: "Providencias y resoluciones",
  sentencia: "Sentencias",
  recurso: "Recursos",
  otro: "Otras actuaciones",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export function categoriaDeTipo(tipo: string): Categoria {
  switch (tipo) {
    case "demanda":
    case "ampliacion_demanda":
      return "demanda";
    case "contestacion":
    case "reconvencion":
    case "excepciones":
      return "contestacion";
    case "prueba_documental":
    case "testimonial":
    case "absolucion_posiciones":
    case "pericia":
    case "observacion_pericia":
    case "informativa":
      return "prueba";
    case "providencia":
    case "resolucion":
    case "cedula_notificacion":
      return "resolucion";
    case "sentencia_primera":
    case "sentencia_camara":
      return "sentencia";
    case "recurso":
    case "expresion_agravios":
    case "contestacion_agravios":
      return "recurso";
    default:
      return "otro";
  }
}

/** Piezas que normalmente integran un expediente civil/laboral completo (para detectar faltantes). */
export const PIEZAS_ESPERADAS: TipoDocumento[] = [
  "demanda",
  "contestacion",
  "prueba_documental",
  "testimonial",
  "pericia",
  "resolucion",
  "sentencia_primera",
];

/**
 * Departamentos judiciales de la Provincia de Buenos Aires (listado de referencia; verificar
 * contra la nómina vigente de la SCBA, que puede modificarse por ley).
 */
export const DEPARTAMENTOS_PBA = [
  "Avellaneda-Lanús",
  "Azul",
  "Bahía Blanca",
  "Dolores",
  "Junín",
  "La Matanza",
  "La Plata",
  "Lomas de Zamora",
  "Mar del Plata",
  "Mercedes",
  "Moreno-General Rodríguez",
  "Morón",
  "Necochea",
  "Pergamino",
  "Quilmes",
  "San Isidro",
  "San Martín",
  "San Nicolás",
  "Trenque Lauquen",
  "Zárate-Campana",
];

export const FUEROS = [
  "Civil y Comercial",
  "Laboral",
  "Familia",
  "Contencioso Administrativo",
  "Paz",
  "Penal",
  "Penal Juvenil",
  "Otro",
];

export const PERSPECTIVAS = {
  neutral: "Analista neutral",
  actor: "Abogado de la parte actora",
  demandado: "Abogado de la parte demandada",
  juez: "Juez / tribunal",
} as const;
export type Perspectiva = keyof typeof PERSPECTIVAS;
