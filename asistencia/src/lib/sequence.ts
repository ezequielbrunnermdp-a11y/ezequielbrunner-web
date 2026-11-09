/** Reglas de coherencia entrada/salida. Puras para poder testearlas. */
export interface LastPunch { type: "in" | "out"; occurred_at: Date }

export type SequenceResult =
  | { ok: true; flags: string[] }
  | { ok: false; code: "already_in" | "not_in" | "open_in_expired" | "too_soon"; message: string };

export const MIN_GAP_SECONDS = 60;

export function checkSequence(type: "in" | "out", last: LastPunch | null, now: Date, maxShiftHours: number): SequenceResult {
  const hoursSince = last ? (now.getTime() - last.occurred_at.getTime()) / 3600000 : Infinity;
  if (last && (now.getTime() - last.occurred_at.getTime()) / 1000 < MIN_GAP_SECONDS)
    return { ok: false, code: "too_soon", message: "Ya registraste una fichada hace instantes. Esperá un minuto antes de volver a fichar." };

  if (type === "in") {
    if (last?.type === "in" && hoursSince < maxShiftHours)
      return { ok: false, code: "already_in", message: "Ya tenés una entrada registrada. El próximo registro debe ser la salida." };
    // Entrada abierta demasiado vieja: queda como jornada incompleta y se permite iniciar otra.
    return { ok: true, flags: last?.type === "in" ? ["entrada_previa_sin_salida"] : [] };
  }
  if (!last || last.type === "out")
    return { ok: false, code: "not_in", message: "No tenés una entrada abierta. Registrá primero tu entrada." };
  if (hoursSince >= maxShiftHours)
    return {
      ok: false,
      code: "open_in_expired",
      message: `Tu última entrada tiene más de ${maxShiftHours} horas. Pedile a tu encargado que registre la corrección.`,
    };
  return { ok: true, flags: [] };
}
