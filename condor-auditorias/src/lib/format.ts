import type { AuditType, NcStatus, Severity, DocStatus, AlertType, Role } from './types';

const AR = 'es-AR';

/** Fecha 'YYYY-MM-DD' (sin zona) → 21/11/2026 */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const s = d.length === 10 ? d + 'T12:00:00' : d;
  return new Date(s).toLocaleDateString(AR, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtDateLong(d: string | null | undefined): string {
  if (!d) return '—';
  const s = d.length === 10 ? d + 'T12:00:00' : d;
  return new Date(s).toLocaleDateString(AR, { day: 'numeric', month: 'long', year: 'numeric' });
}
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(AR, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtScore(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(AR, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString(AR, { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}
export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return Number(n).toLocaleString(AR, { maximumFractionDigits: digits });
}
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(AR, { month: 'long', year: 'numeric' });
}
export function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}
export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador general', auditor: 'Auditor', franquiciado: 'Franquiciado' };
export const AUDIT_TYPE_LABEL: Record<AuditType, string> = { programada: 'Programada', sorpresiva: 'Sorpresiva', seguimiento: 'Seguimiento' };
export const SEVERITY_LABEL: Record<Severity, string> = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave', critica: 'Crítica' };
export const NC_STATUS_LABEL: Record<NcStatus, string> = {
  pendiente: 'Pendiente', en_proceso: 'En proceso', corregido: 'Corregido, pendiente de verificación', cerrado: 'Verificado y cerrado',
};
export const DOC_STATUS_LABEL: Record<DocStatus, string> = { verificado: 'Verificado', pendiente: 'Pendiente de verificar', no_cumple: 'No cumple' };
export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  riesgo_sanitario: 'Riesgo sanitario', alimentos_vencidos: 'Alimentos vencidos o deteriorados', temperatura: 'Temperatura de conservación',
  riesgo_electrico_incendio: 'Riesgo eléctrico o de incendio', legal: 'Incumplimiento legal', contractual: 'Problema contractual',
  reiteracion: 'Reiteración de faltas', accion_vencida: 'Acción correctiva vencida', control_critico: 'Control crítico',
};

export function classificationTone(c: string | null | undefined): 'excelente' | 'satisfactoria' | 'observacion' | 'deficiente' | 'neutral' {
  switch (c) {
    case 'EXCELENTE': return 'excelente';
    case 'SATISFACTORIA': return 'satisfactoria';
    case 'EN OBSERVACIÓN': return 'observacion';
    case 'DEFICIENTE': return 'deficiente';
    default: return 'neutral';
  }
}
export const TONE_HEX = { excelente: '#2f6b4f', satisfactoria: '#5a7a3a', observacion: '#b07a1e', deficiente: '#a33b2b', neutral: '#7a6a5a' };
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return TONE_HEX.neutral;
  if (score >= 90) return TONE_HEX.excelente;
  if (score >= 80) return TONE_HEX.satisfactoria;
  if (score >= 70) return TONE_HEX.observacion;
  return TONE_HEX.deficiente;
}
export const SEVERITY_HEX: Record<Severity, string> = { leve: '#7a8a6a', moderada: '#b07a1e', grave: '#c0582b', critica: '#a33b2b' };
