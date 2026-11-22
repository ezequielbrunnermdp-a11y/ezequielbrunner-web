import type { Product, Promotion, Resource, VideoScript } from './types';

export const VIDEO_SCRIPTS: VideoScript[] = [
  {
    id: 'v1',
    title: 'Bienvenido al equipo',
    moduleId: 'm1',
    summary: 'Cómo se organiza el trabajo y por qué conviene consultar a tiempo.',
    src: null,
    captions: null,
    script:
      'Bienvenido a El Cóndor. En esta primera etapa vas a conocer cómo se organiza el trabajo y qué necesitás para atender con claridad. Vas a aprender a consultar el catálogo, registrar pedidos y coordinarte con el equipo. Cada sector aporta algo a la experiencia del cliente: recibir, preparar, entregar y resolver son partes de un mismo recorrido. Si algo no está claro, preguntá. Una consulta a tiempo puede evitar un error y ayudarte a trabajar con más confianza. Empezá por identificar a tu referente, conocer las novedades del turno y recorrer los materiales de este campus. Después, llevá cada aprendizaje a la práctica.',
  },
  {
    id: 'v2',
    title: 'Una atención que acompaña',
    moduleId: 'm2',
    summary: 'Los momentos de la visita, de la recepción a la despedida.',
    src: null,
    captions: null,
    script:
      'Una buena atención se construye durante toda la visita. Primero, recibimos y orientamos. Después escuchamos qué busca la persona y recomendamos con información real. Al entregar, revisamos que el pedido coincida con lo solicitado y esté en condiciones. Durante la visita observamos si falta algo y nos acercamos con criterio. Al cerrar, gestionamos la cuenta con claridad, escuchamos las observaciones y agradecemos la visita. No hace falta hablar todo el tiempo: hace falta estar disponibles y cumplir lo que comunicamos. Si surge una dificultad, consultamos y buscamos una solución dentro del circuito del local.',
  },
  {
    id: 'v3',
    title: 'Prepararte para cada turno',
    moduleId: 'm6',
    summary: 'Tareas, novedades, orden, registros y pedidos de ayuda.',
    src: null,
    captions: null,
    script:
      'Antes de empezar, revisá tus tareas, las novedades y los materiales del sector. Mantené el orden y seguí los procedimientos de higiene correspondientes. Si cambia un pedido, dejá el registro adecuado y avisá a quienes preparan y cobran. Si encontrás una condición insegura o información que no podés confirmar, consultá a la persona responsable. Durante los primeros días vas a necesitar práctica y acompañamiento. Usá las devoluciones para elegir qué reforzar y volvé al campus cuando quieras repasar. Trabajar en equipo también significa compartir información a tiempo y pedir ayuda cuando hace falta.',
  },
];

/** Biblioteca inicial: no existe ningún archivo oficial todavía. Cada recurso queda pendiente
 *  hasta que se asocie un archivo desde "Gestionar contenido" o se agregue en public/materiales. */
export const BASE_RESOURCES: Resource[] = [
  { id: 'r-carta', title: 'Carta vigente', category: 'Productos', description: 'Carta oficial con productos, variantes y precios de El Cóndor.', kind: 'pdf', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-fichas', title: 'Fichas técnicas de productos', category: 'Productos', description: 'Composición, ingredientes, alérgenos y formato de servicio de cada producto.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-codigos', title: 'Códigos de caja', category: 'Códigos', description: 'Listado oficial de códigos del sistema del local.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-promos', title: 'Promociones y medios de pago vigentes', category: 'Promociones', description: 'Beneficios confirmados, con fuente y fecha de verificación.', kind: 'imagen', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-induccion', title: 'Manual de inducción de El Cóndor', category: 'Cultura', description: 'Historia, organización y cultura de trabajo, cuando la empresa lo disponga.', kind: 'pdf', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-vestimenta', title: 'Vestimenta y presentación personal', category: 'Personal', description: 'Indicaciones propias de presentación para cada sector.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-personal', title: 'Horarios, ausencias, pausas y refrigerios', category: 'Personal', description: 'Procedimientos de personal vigentes de El Cóndor.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-limpieza', title: 'Limpieza y desinfección', category: 'Seguridad e higiene', description: 'Procedimientos de lavado, limpieza y desinfección por tarea.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-conservacion', title: 'Conservación y manipulación de alimentos', category: 'Seguridad e higiene', description: 'Condiciones de conservación y manipulación según fichas propias.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-emergencias', title: 'Plan de emergencias y contactos', category: 'Seguridad e higiene', description: 'Procedimiento ante emergencias y contactos del establecimiento.', kind: 'documento', version: null, updatedAt: null, href: null, fileId: null, searchText: null },
  { id: 'r-guia-atencion', title: 'Guía de atención: cinco momentos', category: 'Atención', description: 'Versión imprimible de la propuesta pedagógica del módulo 2.', kind: 'leccion', version: '1.0', updatedAt: '2026-11-22', href: null, fileId: null, searchText: null, lessonModuleId: 'm2' },
  { id: 'r-recorrido', title: 'Recorrido de una mesa', category: 'Atención', description: 'Versión imprimible de las ocho estaciones del módulo 3.', kind: 'leccion', version: '1.0', updatedAt: '2026-11-22', href: null, fileId: null, searchText: null, lessonModuleId: 'm3' },
];

const practiceBase = {
  code: null,
  description: '',
  price: null,
  currency: 'ARS' as const,
  variants: [],
  ingredients: null,
  ingredientsStatus: 'desconocido' as const,
  allergens: null,
  allergensStatus: 'desconocido' as const,
  availability: 'sin-dato' as const,
  photoFileId: null,
  source: 'Práctica del campus · sin carta oficial',
  verification: 'sin-verificar' as const,
  isExample: true,
};

/** Seis nombres genéricos para practicar la consulta de fichas. No son oferta comercial. */
export const PRACTICE_PRODUCTS: Product[] = [
  { ...practiceBase, id: 'px-1', category: 'Cafetería', name: 'Café con leche', description: 'Nombre genérico de práctica. Composición, tamaños y precio pendientes de la carta oficial.' },
  { ...practiceBase, id: 'px-2', category: 'Cafetería', name: 'Cortado', description: 'Nombre genérico de práctica. Formatos y variantes pendientes de confirmación.' },
  { ...practiceBase, id: 'px-3', category: 'Infusiones', name: 'Té', description: 'Nombre genérico de práctica. Variedades disponibles pendientes de confirmación.' },
  { ...practiceBase, id: 'px-4', category: 'Panadería', name: 'Medialuna', description: 'Nombre genérico de práctica. Ingredientes y alérgenos desconocidos.' },
  { ...practiceBase, id: 'px-5', category: 'Salados', name: 'Tostado', description: 'Nombre genérico de práctica. Rellenos y panes disponibles pendientes de confirmación.' },
  { ...practiceBase, id: 'px-6', category: 'Pastelería', name: 'Porción de torta', description: 'Nombre genérico de práctica. Variedades, ingredientes y alérgenos desconocidos.' },
];

/** Ejemplo de entrenamiento: entidad ficticia, sin nombres de bancos ni apariencia de convenio. */
export const PRACTICE_PROMOTION: Promotion = {
  id: 'promo-practica',
  entity: 'Entidad de ejemplo',
  title: 'Ejemplo de reintegro para practicar',
  startDate: null,
  endDate: null,
  days: [],
  timeFrom: null,
  timeTo: null,
  benefitType: 'reintegro',
  percent: 20,
  paymentMethod: 'Medio de pago de ejemplo',
  cards: '—',
  channel: 'Presencial',
  cap: 5000,
  capPeriod: 'por mes',
  conditions: 'Ejemplo de entrenamiento. No representa ningún beneficio real.',
  exclusions: '—',
  branches: '—',
  source: 'Práctica del campus',
  verifiedAt: null,
  isExample: true,
};

export const FAQ: { id: string; q: string; a: string; link: string }[] = [
  { id: 'f1', q: '¿A quién consulto si tengo una duda durante el turno?', a: 'A la persona responsable del turno o a tu referente de sector. El módulo 1 explica cómo ubicarte antes de actuar.', link: '#/aprender/m1?l=m1-l1' },
  { id: 'f2', q: '¿Qué digo si no conozco el estado de un pedido?', a: 'Consultá con el sector responsable y volvé con información real, sin prometer minutos.', link: '#/aprender/m3?l=m3-l2' },
  { id: 'f3', q: '¿Cómo respondo una consulta por alergias?', a: 'Revisá la ficha técnica y verificá con quien prepara. No garantices ausencia de alérgenos por suposición.', link: '#/aprender/m4?l=m4-l2' },
  { id: 'f4', q: '¿Cómo corrijo un pedido que ya se envió?', a: 'Usá el circuito de corrección del local y avisá a cada sector afectado, incluida caja.', link: '#/aprender/m5?l=m5-l3' },
  { id: 'f5', q: '¿Qué hago con un producto que devolvió una mesa?', a: 'Separalo del servicio y gestionalo según el procedimiento sanitario y el registro del local.', link: '#/aprender/m7?l=m7-l2' },
  { id: 'f6', q: '¿Un reintegro baja el importe que cobra el local?', a: 'No necesariamente. El reintegro lo realiza después la entidad, según sus condiciones y topes.', link: '#/aprender/m9?l=m9-l2' },
  { id: 'f7', q: '¿Dónde consulto horarios, pausas o ausencias?', a: 'En la documentación propia de El Cóndor y con el responsable. Mientras no esté cargada, consultá directamente.', link: '#/aprender/m6?l=m6-l3' },
  { id: 'f8', q: '¿Mi progreso se ve en otro teléfono?', a: 'No. El progreso queda guardado en este navegador y no se sincroniza. Podés exportar un respaldo desde Progreso.', link: '#/acerca' },
];
