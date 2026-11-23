// Réplica de la lógica del servidor solo para orientar a la persona en pantalla.
// La decisión real la toma SIEMPRE el servidor (clock_punch).
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GeoClass = 'inside' | 'outside' | 'imprecise' | 'unavailable';
export function classifyGeo(distance: number | null, accuracy: number | null, radius: number, maxAccuracy: number): GeoClass {
  if (distance == null) return 'unavailable';
  if (accuracy == null || accuracy > maxAccuracy) return 'imprecise';
  return distance - Math.min(accuracy, radius) <= radius ? 'inside' : 'outside';
}

export interface Fix { lat: number; lng: number; accuracy: number; at: number }

/**
 * Obtiene una ubicación puntual (no hay seguimiento continuo).
 * Toma la mejor lectura durante unos segundos para mejorar la precisión en interiores.
 */
export function getBestFix(timeoutMs = 9000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(Object.assign(new Error('unsupported'), { code: 'unsupported' })); return; }
    let best: Fix | null = null;
    const done = (err?: GeolocationPositionError) => {
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(err ?? Object.assign(new Error('timeout'), { code: 3 }));
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= 15) done();
      },
      (err) => { if (err.code === err.PERMISSION_DENIED) { best = null; done(err); } },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    const timer = setTimeout(() => done(), timeoutMs);
  });
}
