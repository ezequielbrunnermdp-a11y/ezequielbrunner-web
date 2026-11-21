// Genera PDF reales con datos de prueba y verifica que se produzcan documentos A4 multipágina válidos.
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AuditReport, type AuditReportData } from '../src/pdf/AuditReport';
import { ConsolidatedReport, NcReport } from '../src/pdf/ConsolidatedReport';
import { buildConsolidated } from '../src/pdf/build';
import { computeScore } from '../src/lib/scoring';
import type { Audit, BrandSettings, Branch, Nonconformity } from '../src/lib/types';
import { categoriesV1, allAnswers, answer } from './fixtures';

const OUT = process.env.PDF_OUT_DIR;
const brand: BrandSettings = { company_name: 'EL CÓNDOR COFFEE SHOP', platform_name: 'EL CÓNDOR | CONTROL DE FRANQUICIAS', subtitle: 'Sistema Integral de Auditorías y Calidad Operativa', logo_path: null, color_primary: '#2e2016', color_accent: '#b08d3e', color_background: '#f7f1e7', receipt_enabled: true };
// Imagen de prueba (PNG 2×2) para validar la inclusión de fotografías
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';

const branch: Branch = { id: 'b1', name: 'Colón', address: 'Av. Colón 0000', legal_name: 'Franquiciado de prueba S.R.L.', manager_name: 'Responsable de prueba', phone: null, email: null, active: true, assigned_auditor_id: null, notes: null, created_at: '' };

function save(name: string, buf: Buffer) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}`, buf);
}
const pages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe('PDF de auditoría individual', () => {
  it('genera un PDF A4 multipágina con todas las secciones', async () => {
    const cats = categoriesV1();
    const answers = allAnswers(cats, 4);
    const h = cats[3].questions[4];
    answers[h.id] = answer(h.id, { score: 1, observation: 'Heladera de barra a 11 °C, fuera del rango establecido.', is_critical: true, recommendation: 'Revisar termostato y registrar temperaturas cada 4 h.' });
    const m = cats[0].questions[3];
    answers[m.id] = answer(m.id, { score: 2, observation: 'Vidrios con marcas.' });
    const d = cats[12].questions[0];
    answers[d.id] = answer(d.id, { not_applicable: true, na_reason: 'La sucursal no opera delivery por aplicación.' });
    const doc = cats[13].questions[0];
    answers[doc.id] = answer(doc.id, { score: 3, doc_status: 'pendiente', doc_expiry: '2027-03-01', observation: 'No se exhibió durante la visita.' });
    const states = { [cats[11].id]: { audit_id: 'a1', category_id: cats[11].id, not_applicable: true, na_reason: 'No adhiere al Club en esta etapa', extras: {} },
      [cats[2].id]: { audit_id: 'a1', category_id: cats[2].id, not_applicable: false, na_reason: null, extras: { productos: [{ product: 'Medialuna de manteca', result: 'conforme', rating: 5, comment: 'Buena laminación' }] } } };
    const result = computeScore(cats, answers, states);
    const audit: Audit = {
      id: 'a1', report_number: 'EC-2026-00001', branch_id: 'b1', auditor_id: 'u1', auditor_name: 'Auditora de prueba', version_id: 'v1', visit_date: '2026-11-10', start_time: '09:30:00',
      manager_present: 'Encargado de turno', audit_type: 'programada', initial_notes: 'Visita programada.', status: 'finalizada', final_score: result.final_score, classification: result.classification,
      has_critical: true, category_results: result, weights_redistributed: true, conclusion: 'La sucursal mantiene un nivel general adecuado con un riesgo crítico de conservación.',
      recommendations: 'Corregir la cadena de frío de inmediato.', receipt_name: null, receipt_at: null, revision: 1, correction_reason: null,
      created_at: '2026-11-10T12:31:00Z', updated_at: '', finalized_at: '2026-11-10T14:02:00Z',
    };
    const nc: Nonconformity = { id: 'n1', audit_id: 'a1', branch_id: 'b1', category_id: cats[3].id, question_id: h.id, description: 'Temperatura de conservación fuera de rango', severity: 'critica', alert_type: 'temperatura',
      attributable_to: 'franquicia', recommended_action: 'Reparar equipo y descartar mercadería comprometida', responsible: 'Encargado', due_date: '2026-11-12', status: 'pendiente', notes: null, corrected_at: null,
      correction_comment: null, verified_by: null, closed_at: null, created_at: '', updated_at: '' };
    const data: AuditReportData = {
      brand, logo: null, audit, branch, versionNumber: 1, categories: cats, answers, states, result, nonconformities: [nc],
      photos: [{ id: 'p1', questionId: h.id, nonconformityId: null, dataUrl: PNG, caption: null }, { id: 'p2', questionId: null, nonconformityId: 'n1', dataUrl: PNG, caption: null }],
      omittedPhotos: 0, previous: { visit_date: '2026-08-01', final_score: 74.2, classification: 'EN OBSERVACIÓN' }, alerts: [], issuedAt: '2026-11-21T10:00:00Z', issuedBy: 'Administración',
    };
    const buf = await renderToBuffer(<AuditReport d={data} />);
    save('auditoria.pdf', buf);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(buf)).toBeGreaterThanOrEqual(5);
  }, 60000);
});

describe('PDF consolidado y de incumplimientos', () => {
  it('genera el informe general de franquicias', async () => {
    const names = ['San Luis', 'Colón', 'Alem', 'Tucumán', 'San Juan', 'Chile', 'Torreón', 'Rivadavia', 'Balcarce'];
    const branches = names.map((n, i) => ({ ...branch, id: `b${i}`, name: n }));
    const cats = categoriesV1();
    const audits: Audit[] = [];
    branches.slice(0, 7).forEach((b, i) => {
      ['2026-09-12', '2026-10-14', '2026-11-08'].forEach((d, j) => {
        const r = computeScore(cats, allAnswers(cats, 3 + ((i + j) % 3)), {});
        audits.push({ id: `${b.id}-${j}`, report_number: `EC-2026-0${i}${j}`, branch_id: b.id, auditor_id: 'u', auditor_name: 'Auditora', version_id: 'v1', visit_date: d, start_time: null, manager_present: null, audit_type: 'programada', initial_notes: null, status: 'finalizada', final_score: r.final_score, classification: r.classification, has_critical: j === 2 && i === 1, category_results: r, weights_redistributed: false, conclusion: null, recommendations: null, receipt_name: null, receipt_at: null, revision: 1, correction_reason: null, created_at: d + 'T10:00:00Z', updated_at: '', finalized_at: '' });
      });
    });
    const built = buildConsolidated({ from: '2026-09-01', to: '2026-11-30', branches, audits, alerts: [], openNcs: [], closedInPeriod: 2, today: '2026-11-21' });
    const buf = await renderToBuffer(<ConsolidatedReport d={{ brand, logo: null, kind: 'consolidado', title: 'Informe general de franquicias', periodLabel: 'Septiembre – noviembre 2026', from: '2026-09-01', to: '2026-11-30', scopeLabel: 'Todas las sucursales', issuedAt: '2026-11-21T10:00:00Z', issuedBy: 'Administración', ...built }} />);
    save('consolidado.pdf', buf);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(buf)).toBeGreaterThanOrEqual(3);
  }, 60000);

  it('informa períodos sin auditorías sin inventar resultados', async () => {
    const built = buildConsolidated({ from: '2025-01-01', to: '2025-01-31', branches: [branch], audits: [], alerts: [], openNcs: [], closedInPeriod: 0, today: '2026-11-21' });
    const buf = await renderToBuffer(<ConsolidatedReport d={{ brand, logo: null, kind: 'mensual', title: 'Reporte mensual', periodLabel: 'Enero de 2025', from: '2025-01-01', to: '2025-01-31', scopeLabel: 'Sucursal Colón', issuedAt: '2026-11-21T10:00:00Z', issuedBy: 'Admin', ...built }} />);
    save('vacio.pdf', buf);
    expect(pages(buf)).toBe(1);
  }, 30000);

  it('genera el reporte de incumplimientos pendientes', async () => {
    const buf = await renderToBuffer(<NcReport d={{ brand, logo: null, scopeLabel: 'Todas las sucursales', issuedAt: '2026-11-21T10:00:00Z', issuedBy: 'Admin', rows: [] }} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);
});
