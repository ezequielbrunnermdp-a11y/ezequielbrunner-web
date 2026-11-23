import { describe, expect, it } from 'vitest';
import { classifyGeo, haversineMeters } from './geo';

describe('geolocalización (misma regla que el servidor)', () => {
  it('distancia haversine aproximada', () => {
    // 0.01° de latitud ≈ 1112 m
    expect(Math.round(haversineMeters(-38, -57.5, -38.01, -57.5))).toBeGreaterThan(1100);
    expect(Math.round(haversineMeters(-38, -57.5, -38.01, -57.5))).toBeLessThan(1120);
  });
  it('dentro del perímetro con buena precisión', () => expect(classifyGeo(25, 10, 40, 75)).toBe('inside'));
  it('el margen de precisión se acota al radio', () => {
    expect(classifyGeo(75, 50, 40, 75)).toBe('inside');
    expect(classifyGeo(81, 60, 40, 75)).toBe('outside');
  });
  it('precisión peor que el máximo → imprecisa (no rechazo automático)', () => expect(classifyGeo(10, 300, 40, 75)).toBe('imprecise'));
  it('sin coordenadas → no disponible', () => expect(classifyGeo(null, null, 40, 75)).toBe('unavailable'));
});
