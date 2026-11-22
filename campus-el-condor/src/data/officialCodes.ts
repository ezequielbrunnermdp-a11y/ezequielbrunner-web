import type { CodeRecord } from '../content/types';
import raw from './codigos-guemes.json';

/* Listado oficial de códigos de El Cóndor, Sucursal Güemes.
   Fuente: exportación del sistema de gestión (archivo Codigos_El_Condor_Guemes.xlsx, hoja “Activos”),
   recibida el 22/11/2026. Solo productos activos (los inhabilitados quedan afuera).
   Los códigos se guardan como texto para conservar los ceros iniciales.
   Para actualizarlo: reemplazar codigos-guemes.json (ver README) y volver a compilar. */
export const OFFICIAL_CODES: CodeRecord[] = raw as CodeRecord[];

export const OFFICIAL_CODES_INFO = {
  source: 'Listado oficial · Sucursal Güemes · exportación del sistema de gestión recibida el 22/11/2026 (productos activos)',
  importedAt: null as string | null,
};

export const OFFICIAL_BRANCH = 'Sucursal Güemes';
export const OFFICIAL_DATE = '2026-11-22';
