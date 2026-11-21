// Cálculo puro de los datos del informe consolidado (sin acceso a red: testeable).
import type { Audit, Branch, Nonconformity, AlertRow, ScoreResult } from '../lib/types';
import type { BranchStat, ConsolidatedData } from './ConsolidatedReport';

export interface ConsolidatedInput {
  from: string;
  to: string;
  branches: Branch[];
  audits: Audit[]; // finalizadas en el período
  alerts: AlertRow[]; // del período
  openNcs: Nonconformity[]; // abiertas (estado actual)
  closedInPeriod: number;
  today: string;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
    if (out.length > 60) break;
  }
  return out;
}

export function buildConsolidated(input: ConsolidatedInput): Pick<ConsolidatedData, 'audits' | 'branches' | 'categories' | 'evolution' | 'findings' | 'actions' | 'recommendations'> {
  const byId = new Map(input.branches.map((b) => [b.id, b]));
  const audits = [...input.audits].filter((a) => a.status === 'finalizada' && a.final_score != null)
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date) || a.created_at.localeCompare(b.created_at));

  const branches: BranchStat[] = input.branches.map((b) => {
    const xs = audits.filter((a) => a.branch_id === b.id);
    const scores = xs.map((a) => Number(a.final_score));
    return {
      name: b.name,
      count: xs.length,
      avg: avg(scores),
      last: scores.length ? scores[scores.length - 1] : null,
      lastDate: xs.length ? xs[xs.length - 1].visit_date : null,
      first: scores.length ? scores[0] : null,
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
      criticals: xs.filter((a) => a.has_critical).length,
      openNc: input.openNcs.filter((n) => n.branch_id === b.id).length,
    };
  });

  // Promedio de cumplimiento por categoría (por código, a través de versiones)
  const catMap = new Map<string, { name: string; vals: number[]; pos: number }>();
  audits.forEach((a) => {
    const r = a.category_results as ScoreResult | null;
    r?.categories.forEach((c, i) => {
      const e = catMap.get(c.code) ?? { name: c.name, vals: [], pos: i };
      if (c.pct != null) e.vals.push(Number(c.pct));
      catMap.set(c.code, e);
    });
  });
  const categories = [...catMap.values()].sort((a, b) => a.pos - b.pos).map((c) => ({ name: c.name, avg: avg(c.vals), n: c.vals.length }));

  // Evolución mensual
  const months = monthsBetween(input.from, input.to);
  const series = input.branches.filter((b) => audits.some((a) => a.branch_id === b.id)).map((b) => ({
    name: b.name,
    values: months.map((m) => avg(audits.filter((a) => a.branch_id === b.id && a.visit_date.startsWith(m)).map((a) => Number(a.final_score)))),
  }));
  const labels = months.map((m) => {
    const [y, mm] = m.split('-').map(Number);
    return new Date(y, mm - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  });

  const findings = input.alerts
    .filter((al) => al.severity === 'critica' || al.type === 'reiteracion')
    .map((al) => ({ branch: byId.get(al.branch_id)?.name ?? al.branches?.name ?? '—', date: al.created_at.slice(0, 10), type: al.type, title: al.title, resolved: !!al.resolved_at }));

  const overdue = input.openNcs.filter((n) => n.due_date && n.due_date < input.today && (n.status === 'pendiente' || n.status === 'en_proceso')).length;
  const actions = {
    pending: input.openNcs.filter((n) => n.status === 'pendiente').length,
    inProgress: input.openNcs.filter((n) => n.status === 'en_proceso').length,
    corrected: input.openNcs.filter((n) => n.status === 'corregido').length,
    closed: 0,
    overdue,
    closedInPeriod: input.closedInPeriod,
    list: input.openNcs,
  };

  // Recomendaciones basadas en reglas sobre los datos
  const rec: string[] = [];
  const chainAvg = avg(audits.map((a) => Number(a.final_score)));
  const deficient = branches.filter((b) => b.avg != null && b.avg < 70);
  const observed = branches.filter((b) => b.avg != null && b.avg >= 70 && b.avg < 80);
  const notAudited = branches.filter((b) => b.count === 0);
  const lowCats = categories.filter((c) => c.avg != null && c.avg < 80).sort((a, b) => a.avg! - b.avg!).slice(0, 3);
  const regress = branches.filter((b) => b.count >= 2 && b.first != null && b.last != null && b.last - b.first < -3);
  if (audits.length === 0) {
    rec.push('No hay auditorías finalizadas en el período: programar visitas para disponer de información comparable.');
  } else {
    if (deficient.length) rec.push(`Priorizar un plan de intervención y auditoría de seguimiento en ${deficient.map((b) => b.name).join(', ')} (promedio inferior a 70 puntos).`);
    if (observed.length) rec.push(`Realizar seguimiento cercano en ${observed.map((b) => b.name).join(', ')} (resultado en observación).`);
    if (lowCats.length) rec.push(`Reforzar capacitación y estándares en ${lowCats.map((c) => `${c.name} (${c.avg!.toFixed(1)} %)`).join(', ')}, las categorías con menor cumplimiento de la cadena.`);
    if (regress.length) rec.push(`Analizar las causas del retroceso en ${regress.map((b) => b.name).join(', ')} respecto de su primera auditoría del período.`);
    if (findings.some((f) => !f.resolved)) rec.push(`Atender de inmediato ${findings.filter((f) => !f.resolved).length} hallazgo(s) crítico(s) aún abiertos.`);
    if (overdue) rec.push(`Exigir el cierre de ${overdue} acción(es) correctiva(s) vencida(s) y revisar los plazos asignados.`);
    if (actions.corrected) rec.push(`Verificar en sucursal ${actions.corrected} corrección(es) informada(s) por franquiciados pendientes de verificación.`);
    if (notAudited.length) rec.push(`Programar auditorías en ${notAudited.map((b) => b.name).join(', ')}, sin visitas en el período.`);
    if (chainAvg != null && chainAvg >= 90 && !deficient.length) rec.push('Mantener los estándares actuales y documentar las buenas prácticas de las sucursales mejor calificadas para replicarlas.');
    if (!rec.length) rec.push('Sostener la frecuencia de auditorías y el seguimiento de acciones correctivas.');
  }

  return {
    audits: audits.map((a) => ({ branch: byId.get(a.branch_id)?.name ?? a.branches?.name ?? '—', date: a.visit_date, auditor: a.auditor_name, score: Number(a.final_score), classification: a.classification, critical: a.has_critical, report: a.report_number })),
    branches,
    categories,
    evolution: { labels, series },
    findings,
    actions,
    recommendations: rec,
  };
}
