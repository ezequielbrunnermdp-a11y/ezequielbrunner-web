import { OFFICIAL_CODES, OFFICIAL_CODES_INFO } from '../data/officialCodes';
import type { CodeRecord, ContentMeta, Product, Promotion, Resource } from '../content/types';

export const SCHEMA_VERSION = 1;

export interface Profile {
  id: string;
  alias: string; // opcional: puede quedar vacío
  sector: string; // opcional
  createdAt: string;
}

export interface Attempt {
  id: string;
  kind: 'module' | 'final';
  moduleId: string | null;
  questionIds: string[];
  optionOrder: Record<string, string[]>; // orden fijado al crear el intento
  answers: Record<string, string>;
  startedAt: string;
  finishedAt: string | null;
  score: number | null; // respuestas correctas
  total: number;
  threshold: number; // umbral pedagógico vigente al crear el intento
}

export interface PracticeRecord {
  completedAt: string | null;
  attempts: number;
  lastResult: string; // resumen legible
  lastAt: string;
  state?: unknown; // estado propio del ejercicio (por ejemplo, orden actual)
}

export interface VideoRecord {
  intervals: [number, number][];
  duration: number | null;
  readEquivalentAt: string | null;
}

export interface Progress {
  schemaVersion: number;
  lessonsRead: Record<string, string>;
  practices: Record<string, PracticeRecord>;
  attempts: Attempt[]; // finalizados
  active: Record<string, Attempt>; // en curso, por clave ("final" o id de módulo)
  wrong: Record<string, { at: string; count: number }>;
  favorites: string[];
  checklist: { referente: string; sector: string; canal: string; materiales: Record<string, boolean>; notas: string };
  reviewPlan: { tema: string; como: string; quien: string; updatedAt: string | null };
  videos: Record<string, VideoRecord>;
  lastActivity: { at: string; label: string; href: string } | null;
}

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    lessonsRead: {},
    practices: {},
    attempts: [],
    active: {},
    wrong: {},
    favorites: [],
    checklist: { referente: '', sector: '', canal: '', materiales: {}, notas: '' },
    reviewPlan: { tema: '', como: '', quien: '', updatedAt: null },
    videos: {},
    lastActivity: null,
  };
}

export interface TimeGoal {
  id: string;
  label: string;
  start: string;
  end: string;
  minutes: number | null;
}

export interface LocalContent {
  schemaVersion: number;
  updatedAt: string | null;
  texts: {
    homeTitle: string | null;
    homeText: string | null;
    modules: Record<string, { objective?: string; intro?: string; closing?: string }>;
  };
  meta: Record<string, Partial<ContentMeta>>;
  categories: string[];
  products: Product[];
  codes: CodeRecord[];
  codesInfo: { source: string; importedAt: string | null };
  promotions: Promotion[];
  resources: Record<string, Partial<Resource>>;
  customResources: Resource[];
  videos: Record<string, { fileId: string | null; captionsFileId: string | null; title?: string }>;
  timeGoals: TimeGoal[];
  settings: { threshold: number };
}

export function defaultTimeGoals(): TimeGoal[] {
  return [
    { id: 'tg-recepcion', label: 'Recepción', start: 'La persona ingresa al salón', end: 'Recibe un saludo y una indicación concreta', minutes: null },
    { id: 'tg-pedido', label: 'Toma de pedido', start: 'La mesa está ubicada y tiene la carta', end: 'El pedido queda confirmado y registrado', minutes: null },
    { id: 'tg-cafeteria', label: 'Cafetería', start: 'El pedido queda registrado', end: 'La bebida se entrega en la mesa', minutes: null },
    { id: 'tg-comidas', label: 'Comidas', start: 'El pedido queda registrado', end: 'El plato se entrega en la mesa', minutes: null },
  ];
}

export function emptyContent(): LocalContent {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: null,
    texts: { homeTitle: null, homeText: null, modules: {} },
    meta: {},
    categories: ['Cafetería', 'Infusiones', 'Panadería', 'Pastelería', 'Salados', 'Bebidas'],
    products: [],
    codes: OFFICIAL_CODES,
    codesInfo: { ...OFFICIAL_CODES_INFO },
    promotions: [],
    resources: {},
    customResources: [],
    videos: {},
    timeGoals: defaultTimeGoals(),
    settings: { threshold: 80 },
  };
}
