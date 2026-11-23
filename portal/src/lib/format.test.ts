import { describe, expect, it } from 'vitest';
import { addDays, buildShiftRange, durationLabel, localDate, mondayOf, zonedToUtc, fmtTime } from './format';

describe('zonas horarias (America/Argentina/Buenos_Aires, UTC-3)', () => {
  it('convierte hora local a UTC', () => {
    expect(zonedToUtc('2026-11-23', '09:00')).toBe('2026-11-23T12:00:00.000Z');
  });
  it('la fecha local de un instante nocturno es la del día argentino', () => {
    expect(localDate('2026-11-24T02:30:00Z')).toBe('2026-11-23');
  });
  it('formatea en hora local de 24 h', () => {
    expect(fmtTime('2026-11-24T01:00:00Z')).toBe('22:00');
  });
});

describe('turnos que cruzan la medianoche', () => {
  it('22:00 → 06:00 termina al día siguiente y dura 8 h', () => {
    const r = buildShiftRange('2026-11-23', '22:00', '06:00');
    expect(r.overnight).toBe(true);
    expect(r.startsAt).toBe('2026-11-24T01:00:00.000Z');
    expect(r.endsAt).toBe('2026-11-24T09:00:00.000Z');
    expect((Date.parse(r.endsAt) - Date.parse(r.startsAt)) / 36e5).toBe(8);
  });
  it('un turno diurno no se marca como nocturno', () => {
    expect(buildShiftRange('2026-11-23', '08:00', '16:00').overnight).toBe(false);
  });
});

describe('fechas', () => {
  it('lunes de la semana', () => {
    expect(mondayOf('2026-11-23')).toBe('2026-11-23');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(mondayOf('2026-11-30')).toBe('2026-11-30');
  });
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('duraciones legibles', () => {
    expect(durationLabel(479)).toBe('7 h 59 min');
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(null)).toBe('—');
  });
});
