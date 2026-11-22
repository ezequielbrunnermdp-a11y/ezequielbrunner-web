import type { Promotion } from '../content/types';
import { todayAR } from './format';

export type PromoState = 'incompleta' | 'proxima' | 'vigente' | 'vencida';

export const PROMO_STATE_LABEL: Record<PromoState, string> = {
  incompleta: 'Incompleta',
  proxima: 'Próxima',
  vigente: 'Dentro de fechas',
  vencida: 'Vencida',
};

/** Campos sin los cuales una promoción no puede informarse. */
export function missingPromoFields(p: Promotion): string[] {
  const m: string[] = [];
  if (!p.entity.trim()) m.push('entidad');
  if (!p.startDate) m.push('fecha de inicio');
  if (!p.endDate) m.push('fecha de finalización');
  if (!p.benefitType) m.push('tipo de beneficio');
  if (p.percent === null) m.push('porcentaje');
  if (!p.paymentMethod.trim()) m.push('medio de pago');
  if (!p.source.trim()) m.push('fuente');
  if (!p.verifiedAt) m.push('fecha de verificación');
  return m;
}

/** Estado por fechas civiles de Argentina. Comparar AAAA-MM-DD como texto evita corrimientos por UTC. */
export function promoState(p: Promotion, today: string = todayAR()): PromoState {
  if (missingPromoFields(p).length) return 'incompleta';
  if (p.startDate! > today) return 'proxima';
  if (p.endDate! < today) return 'vencida';
  return 'vigente';
}

export interface BenefitEstimate {
  byPercent: number;
  cap: number | null;
  estimate: number;
  limitedByCap: boolean;
}

/** Beneficio estimado = mín(importe elegible × porcentaje, tope disponible informado). */
export function estimateBenefit(eligible: number, percent: number, availableCap: number | null): BenefitEstimate {
  const byPercent = Math.round(eligible * percent) / 100;
  if (availableCap === null) return { byPercent, cap: null, estimate: byPercent, limitedByCap: false };
  const estimate = Math.min(byPercent, availableCap);
  return { byPercent, cap: availableCap, estimate, limitedByCap: availableCap < byPercent };
}
