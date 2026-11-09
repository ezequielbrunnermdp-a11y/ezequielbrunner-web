/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface GeoFence {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  max_accuracy_m: number;
}

export interface GeoReading {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type GeoResult =
  | { ok: true; distance: number }
  | { ok: false; reason: "branch_not_configured" | "invalid_reading" | "low_accuracy" | "outside_fence"; distance?: number };

/**
 * Valida una lectura GPS contra el perímetro de la sucursal.
 * - Rechaza lecturas imposibles o con precisión peor que la máxima configurada
 *   (no se puede afirmar presencia).
 * - Rechaza si el punto informado queda fuera del radio.
 */
export function validateGeo(fence: GeoFence, r: GeoReading): GeoResult {
  if (fence.latitude == null || fence.longitude == null) return { ok: false, reason: "branch_not_configured" };
  const valid =
    Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && Number.isFinite(r.accuracy) &&
    Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180 && r.accuracy > 0 && r.accuracy < 100000 &&
    !(r.latitude === 0 && r.longitude === 0);
  if (!valid) return { ok: false, reason: "invalid_reading" };
  const distance = haversineMeters(fence.latitude, fence.longitude, r.latitude, r.longitude);
  if (r.accuracy > fence.max_accuracy_m) return { ok: false, reason: "low_accuracy", distance };
  if (distance > fence.radius_m) return { ok: false, reason: "outside_fence", distance };
  return { ok: true, distance };
}

/** Señales de posible ubicación simulada (no bloquean: generan alerta). */
export function suspiciousGeoFlags(r: GeoReading, previous?: { latitude: number; longitude: number; accuracy: number; at: Date } | null, now = new Date()): string[] {
  const flags: string[] = [];
  if (r.accuracy < 1) flags.push("precision_irreal");
  const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;
  if (decimals(r.latitude) <= 3 && decimals(r.longitude) <= 3) flags.push("coordenadas_redondeadas");
  if (previous) {
    if (previous.latitude === r.latitude && previous.longitude === r.longitude && previous.accuracy === r.accuracy)
      flags.push("lectura_identica_repetida");
    const secs = Math.max(1, (now.getTime() - previous.at.getTime()) / 1000);
    const d = haversineMeters(previous.latitude, previous.longitude, r.latitude, r.longitude);
    if (d > 2000 && d / secs > 70) flags.push("desplazamiento_imposible"); // > 250 km/h
  }
  return flags;
}
