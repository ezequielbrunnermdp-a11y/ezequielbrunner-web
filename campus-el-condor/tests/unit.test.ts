import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/content/questions';
import { MODULES } from '../src/content/modules';
import { SCENARIOS } from '../src/content/scenarios';
import { PRACTICE_PRODUCTS } from '../src/content/library';
import { createFinalAttempt, createModuleAttempt, scoreAttempt, answerInProgress, finishAttempt, moduleStats } from '../src/lib/learning';
import { emptyProgress } from '../src/storage/schema';
import { estimateBenefit, promoState } from '../src/lib/promo';
import { formatCivil, formatMoney, parseAmount, todayAR, weekdayOfCivil } from '../src/lib/format';
import { previewCodes, mergeCodes } from '../src/lib/codesImport';
import { normalize, snippet } from '../src/lib/text';
import { validateProgressBackup, validateContentBackup, buildProgressBackup, PROGRESS_KIND } from '../src/storage/backup';
import { PRACTICE_PROMOTION } from '../src/content/library';
import { OFFICIAL_CODES } from '../src/data/officialCodes';
import { mergeContent } from '../src/storage/store';

describe('contenido', () => {
  it('tiene 10 módulos, 30 preguntas con 3 opciones y respuesta esperada', () => {
    expect(MODULES).toHaveLength(10);
    expect(QUESTIONS).toHaveLength(30);
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(3);
      expect(q.options.map((o) => o.id)).toContain(q.correct);
      expect(q.expected.length).toBeGreaterThan(10);
      expect(q.criteria.length).toBeGreaterThan(10);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
    for (const m of MODULES) expect(QUESTIONS.filter((q) => q.moduleId === m.id)).toHaveLength(3);
  });
  it('cada caso tiene exactamente una decisión esperada por paso', () => {
    expect(SCENARIOS.filter((s) => s.id.startsWith('c'))).toHaveLength(6);
    for (const s of SCENARIOS) for (const st of s.steps) expect(st.choices.filter((c) => c.quality === 'best')).toHaveLength(1);
  });
  it('los productos de práctica no tienen precio ni código', () => {
    expect(PRACTICE_PRODUCTS).toHaveLength(6);
    for (const p of PRACTICE_PRODUCTS) { expect(p.price).toBeNull(); expect(p.code).toBeNull(); expect(p.allergens).toBeNull(); expect(p.isExample).toBe(true); }
  });
  it('ningún módulo figura como aprobado', () => {
    for (const m of MODULES) { expect(m.meta.approvalStatus).toBe('sin-aprobar'); expect(m.meta.approvedBy).toBeNull(); expect(m.meta.approvedAt).toBeNull(); }
  });
});

describe('evaluaciones', () => {
  it('el integrador tiene 15 preguntas distintas y cubre los 10 módulos', () => {
    for (let i = 0; i < 50; i++) {
      const a = createFinalAttempt(80);
      expect(a.questionIds).toHaveLength(15);
      expect(new Set(a.questionIds).size).toBe(15);
      const mods = new Set(a.questionIds.map((id) => QUESTIONS.find((q) => q.id === id)!.moduleId));
      expect(mods.size).toBe(10);
      for (const id of a.questionIds) expect([...a.optionOrder[id]].sort()).toEqual(['a', 'b', 'c']);
    }
  });
  it('registra respuestas, errores para repasar y resultado', () => {
    let p = emptyProgress();
    const a = createModuleAttempt('m1', 80);
    p = { ...p, active: { m1: a } };
    p = answerInProgress(p, 'm1', 'Q01', 'b'); // incorrecta
    expect(p.wrong.Q01.count).toBe(1);
    p = answerInProgress(p, 'm1', 'Q01', 'a'); // no se puede cambiar dentro del intento
    expect(p.active.m1.answers.Q01).toBe('b');
    p = answerInProgress(p, 'm1', 'Q02', 'b');
    p = answerInProgress(p, 'm1', 'Q03', 'c');
    expect(scoreAttempt(p.active.m1)).toBe(2);
    p = finishAttempt(p, 'm1');
    expect(p.attempts[0].score).toBe(2);
    expect(p.active.m1).toBeUndefined();
    expect(moduleStats(p, MODULES[0]).quizPassed).toBe(false); // 67 % < 80 %
  });
  it('leer no equivale a completar', () => {
    const p = emptyProgress();
    for (const l of MODULES[0].lessons) p.lessonsRead[l.id] = 'x';
    expect(moduleStats(p, MODULES[0]).status).toBe('practica-pendiente');
  });
});

describe('promociones y fechas', () => {
  const base = { ...PRACTICE_PROMOTION, isExample: false, startDate: '2026-11-01', endDate: '2026-11-30', verifiedAt: '2026-11-01', source: 'Prueba' };
  it('calcula estados por fecha civil', () => {
    expect(promoState(base, '2026-11-22')).toBe('vigente');
    expect(promoState(base, '2026-11-30')).toBe('vigente');
    expect(promoState(base, '2026-12-01')).toBe('vencida');
    expect(promoState(base, '2026-10-31')).toBe('proxima');
    expect(promoState({ ...base, verifiedAt: null }, '2026-11-22')).toBe('incompleta');
  });
  it('estima el beneficio con tope', () => {
    expect(estimateBenefit(30000, 20, 5000)).toMatchObject({ estimate: 5000, limitedByCap: true, byPercent: 6000 });
    expect(estimateBenefit(10000, 20, 5000)).toMatchObject({ estimate: 2000, limitedByCap: false });
    expect(estimateBenefit(10000, 20, null).estimate).toBe(2000);
  });
  it('hoy en Argentina no se corre por UTC', () => {
    expect(todayAR(new Date('2026-11-23T02:30:00Z'))).toBe('2026-11-22');
    expect(todayAR(new Date('2026-11-23T03:30:00Z'))).toBe('2026-11-23');
    expect(weekdayOfCivil('2026-11-22')).toBe(0);
    expect(formatCivil('2026-11-01')).toBe('1 de noviembre de 2026');
  });
  it('null no se muestra como cero', () => {
    expect(formatMoney(null)).toBe('Precio sin informar');
    expect(formatMoney(1500)).toMatch(/1\.500,00/);
    expect(parseAmount('12.500,50')).toBe(12500.5);
    expect(parseAmount('30.000')).toBe(30000);
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('listado oficial de códigos', () => {
  it('incluye los 1.025 códigos activos de la Sucursal Güemes como texto', () => {
    expect(OFFICIAL_CODES).toHaveLength(1025);
    expect(new Set(OFFICIAL_CODES.map((c) => c.code)).size).toBe(1025);
    expect(OFFICIAL_CODES.every((c) => typeof c.code === 'string' && c.name.length > 0 && c.category.length > 0)).toBe(true);
    expect(OFFICIAL_CODES.some((c) => c.code === '00001')).toBe(true);
  });
  it('se usa por defecto y vuelve cuando se descarta una importación local', () => {
    expect(mergeContent(null).codes).toHaveLength(1025);
    expect(mergeContent({ codes: [], codesInfo: { source: '', importedAt: null } }).codes).toHaveLength(1025);
    expect(mergeContent({ codes: [{ code: 'X1', name: 'X', category: '', variant: '', notes: '' }], codesInfo: { source: 'local', importedAt: '2026-11-22T10:00:00Z' } }).codes).toHaveLength(1);
  });
});

describe('importación de códigos', () => {
  it('valida columnas, duplicados y conserva ceros', () => {
    const csv = 'codigo;nombre;categoria\n012;Café chico;Cafetería\n12;Café grande;Cafetería\n012;Duplicado;X\n;Sin código;X\n045;;X\n';
    const r = previewCodes(csv, 'csv', []);
    expect(r.valid.map((c) => c.code)).toEqual(['012', '12']);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6]);
  });
  it('rechaza columnas faltantes', () => {
    expect(previewCodes('id_x,producto\n1,a', 'csv', []).missingColumns).toEqual(['codigo']);
  });
  it('acepta JSON y combina', () => {
    const r = previewCodes(JSON.stringify([{ code: '001', name: 'A' }, { code: 2, name: 'B' }]), 'json', [{ code: '001', name: 'Viejo', category: '', variant: '', notes: '' }]);
    expect(r.valid.map((c) => c.code)).toEqual(['001', '2']);
    expect(r.warnings.some((w) => w.message.includes('reemplazará'))).toBe(true);
    expect(mergeCodes([{ code: '9', name: 'Z', category: '', variant: '', notes: '' }], r.valid, 'merge')).toHaveLength(3);
  });
});

describe('búsqueda y respaldos', () => {
  it('ignora tildes', () => {
    expect(normalize('Alérgenos')).toBe('alergenos');
    expect(snippet('Revisá los alérgenos del producto', 'alergenos')?.match).toBe('alérgenos');
  });
  it('valida respaldos', () => {
    expect(validateProgressBackup({ foo: 1 }).ok).toBe(false);
    expect(validateProgressBackup({ kind: PROGRESS_KIND, schemaVersion: 99, profile: { id: 'x' }, progress: emptyProgress() }).ok).toBe(false);
    const good = buildProgressBackup({ id: 'p1', alias: '', sector: '', createdAt: '' }, emptyProgress());
    expect(validateProgressBackup(JSON.parse(JSON.stringify(good))).ok).toBe(true);
    expect(validateContentBackup(good).ok).toBe(false);
  });
});
