import { describe, expect, it } from 'vitest';
import { buildConsolidated, monthsBetween } from '../src/pdf/build';
import type { Audit, Branch } from '../src/lib/types';

const br = (id: string, name: string): Branch => ({ id, name, address: null, legal_name: null, manager_name: null, phone: null, email: null, active: true, assigned_auditor_id: null, notes: null, created_at: '' });
const au = (id: string, branch: string, date: string, score: number): Audit => ({
  id, report_number: id, branch_id: branch, auditor_id: 'u', auditor_name: 'Aud', version_id: 'v', visit_date: date, start_time: null, manager_present: null,
  audit_type: 'programada', initial_notes: null, status: 'finalizada', final_score: score, classification: null, has_critical: false,
  category_results: { final_score: score, classification: null, total_weight: 100, applicable_weight: 100, redistributed: false, pending: 0, errors: [],
    categories: [{ category_id: 'c', code: 'imagen_marca', name: 'Imagen de marca', weight: 5, applicable: true, obtained: 0, max: 0, pct: score, criticals: 0, effective_weight: 5, score: null }] },
  weights_redistributed: false, conclusion: null, recommendations: null, receipt_name: null, receipt_at: null, revision: 1, correction_reason: null,
  created_at: date + 'T10:00:00Z', updated_at: '', finalized_at: '',
});

describe('informe consolidado', () => {
  const branches = [br('b1', 'Colón'), br('b2', 'Alem'), br('b3', 'Chile')];
  const audits = [au('a1', 'b1', '2026-01-10', 78), au('a2', 'b1', '2026-02-10', 84), au('a3', 'b1', '2026-03-10', 92), au('a4', 'b2', '2026-02-15', 65)];
  const d = buildConsolidated({ from: '2026-01-01', to: '2026-03-31', branches, audits, alerts: [], openNcs: [], closedInPeriod: 0, today: '2026-04-01' });

  it('calcula promedio, primera y última por sucursal e indica la cantidad', () => {
    const c = d.branches.find((b) => b.name === 'Colón')!;
    expect(c.count).toBe(3);
    expect(c.avg).toBeCloseTo(84.67, 2);
    expect(c.first).toBe(78);
    expect(c.last).toBe(92);
  });
  it('no inventa datos para sucursales o meses sin auditorías', () => {
    const ch = d.branches.find((b) => b.name === 'Chile')!;
    expect(ch.count).toBe(0);
    expect(ch.avg).toBeNull();
    const alem = d.evolution.series.find((s) => s.name === 'Alem')!;
    expect(alem.values).toEqual([null, 65, null]);
    expect(d.evolution.series.some((s) => s.name === 'Chile')).toBe(false);
  });
  it('genera recomendaciones a partir de los datos', () => {
    expect(d.recommendations.some((r) => r.includes('Alem'))).toBe(true);
    expect(d.recommendations.some((r) => r.includes('Chile'))).toBe(true);
  });
  it('sin auditorías en el período lo informa', () => {
    const e = buildConsolidated({ from: '2025-01-01', to: '2025-01-31', branches, audits: [], alerts: [], openNcs: [], closedInPeriod: 0, today: '2026-04-01' });
    expect(e.audits).toHaveLength(0);
    expect(e.recommendations[0]).toContain('No hay auditorías');
  });
  it('meses entre fechas', () => {
    expect(monthsBetween('2025-11-05', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
