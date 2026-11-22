/* Modelo de contenido del campus. Todo lo que no esté confirmado por El Cóndor
   lleva approvalStatus "sin-aprobar" y se muestra como "Contenido propuesto". */

export type PublicationStatus = 'borrador' | 'publicado-en-campus' | 'archivado';
export type ApprovalStatus = 'sin-aprobar' | 'en-revision' | 'aprobado';
export type SourceType = 'propuesta-pedagogica' | 'documento-el-condor' | 'confirmacion-el-condor' | 'practica';

export interface ContentMeta {
  publicationStatus: PublicationStatus;
  approvalStatus: ApprovalStatus;
  sourceType: SourceType;
  sourceReference: string;
  version: string;
  updatedAt: string; // fecha civil AAAA-MM-DD
  approvedAt: string | null;
  approvedBy: string | null;
}

export type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'example'; title?: string; text: string }
  | { type: 'phrases'; items: string[] }
  | { type: 'callout'; tone: 'info' | 'warning' | 'pending'; title: string; text: string }
  | { type: 'dodont'; doText: string[]; dontText: string[] }
  | { type: 'moments'; items: MomentDetail[] }
  | { type: 'stations'; items: { title: string; text: string }[] }
  | { type: 'timeGoals' }
  | { type: 'pendingDoc'; resourceId: string; text: string };

export interface MomentDetail {
  title: string;
  summary: string;
  useful: string;
  mistake: string;
  example: string;
  question: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  blocks: Block[];
}

export interface McqOption {
  id: string;
  text: string;
}

export interface Question {
  id: string; // Q01..Q30
  moduleId: string;
  prompt: string;
  options: McqOption[]; // siempre tres
  correct: string; // id de opción
  explanation: string;
  expected: string; // respuesta esperada para evaluación oral
  criteria: string; // criterio breve para calificar
}

export interface ScenarioChoice {
  id: string;
  text: string;
  quality: 'best' | 'partial' | 'poor';
  feedback: string;
}

export interface ScenarioStep {
  id: string;
  situation: string;
  prompt: string;
  choices: ScenarioChoice[];
}

export interface Scenario {
  id: string;
  title: string;
  moduleId: string;
  context: string;
  steps: ScenarioStep[];
  expected: string;
  explanation: string;
  resolved: string;
  stillToCheck: string[];
}

export type Exercise =
  | { kind: 'order'; id: string; title: string; instructions: string; items: { id: string; text: string }[]; explanation: string }
  | { kind: 'scenario'; id: string; title: string; scenarioId: string }
  | { kind: 'flashcards'; id: string; title: string; cards: { front: string; back: string }[] }
  | { kind: 'checklist'; id: string; title: string }
  | { kind: 'classify'; id: string; title: string; instructions: string; categories: { id: string; label: string }[]; cases: { id: string; text: string; answer: string; missing: string }[] }
  | { kind: 'multiselect'; id: string; title: string; situation: string; prompt: string; options: { id: string; text: string; correct: boolean; why: string }[] }
  | { kind: 'hazards'; id: string; title: string }
  | { kind: 'promoCalc'; id: string; title: string }
  | { kind: 'reviewPlan'; id: string; title: string }
  | { kind: 'comanda'; id: string; title: string };

export interface Module {
  id: string; // m1..m10
  number: number;
  title: string;
  short: string;
  objective: string;
  intro: string;
  lessons: Lesson[];
  exercises: Exercise[];
  synthesis: string[];
  closing: string;
  meta: ContentMeta;
}

export interface Product {
  id: string;
  code: string | null; // siempre texto para conservar ceros
  category: string;
  name: string;
  description: string;
  price: number | null;
  currency: 'ARS';
  variants: string[];
  ingredients: string[] | null; // null = desconocido
  ingredientsStatus: 'desconocido' | 'parcial' | 'verificado';
  allergens: string[] | null; // null = desconocido
  allergensStatus: 'desconocido' | 'parcial' | 'verificado';
  availability: 'sin-dato' | 'disponible' | 'no-disponible' | 'temporada';
  photoFileId: string | null;
  source: string;
  verification: 'sin-verificar' | 'verificado';
  isExample: boolean;
}

export interface CodeRecord {
  code: string;
  name: string;
  category: string;
  variant: string;
  notes: string;
}

export type BenefitType = 'descuento-inmediato' | 'reintegro' | 'cuotas' | 'otro';

export interface Promotion {
  id: string;
  entity: string;
  title: string;
  startDate: string | null; // AAAA-MM-DD, fecha civil Argentina
  endDate: string | null;
  days: number[]; // 0 = domingo ... 6 = sábado; vacío = sin dato
  timeFrom: string | null; // HH:MM
  timeTo: string | null;
  benefitType: BenefitType | null;
  percent: number | null;
  paymentMethod: string;
  cards: string;
  channel: string;
  cap: number | null;
  capPeriod: string;
  conditions: string;
  exclusions: string;
  branches: string;
  source: string;
  verifiedAt: string | null;
  isExample: boolean;
}

export interface Resource {
  id: string;
  title: string;
  category: 'Atención' | 'Productos' | 'Códigos' | 'Promociones' | 'Personal' | 'Seguridad e higiene' | 'Cultura' | 'Videos';
  description: string;
  kind: 'pdf' | 'imagen' | 'video' | 'documento' | 'leccion';
  version: string | null;
  updatedAt: string | null;
  href: string | null; // archivo estático en /materiales
  fileId: string | null; // archivo guardado en este dispositivo
  searchText: string | null; // texto extraído, si existe
  lessonModuleId?: string;
}

export interface VideoScript {
  id: string;
  title: string;
  moduleId: string;
  summary: string;
  script: string;
  /** Video publicado con el sitio (por ejemplo 'materiales/video-1.mp4'), o null si está pendiente. */
  src: string | null;
  captions: string | null;
}
