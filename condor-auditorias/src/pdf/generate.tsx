// Generación de PDF reales (vectoriales, multipágina) con @react-pdf/renderer.
// Este módulo se carga bajo demanda para no penalizar la carga inicial de la aplicación.
import { pdf } from '@react-pdf/renderer';
import { supabase, must } from '../lib/supabase';
import { loadAuditBundle, logReport } from '../lib/api';
import { computeScore } from '../lib/scoring';
import { logoPublicUrl } from '../lib/session';
import { signedUrls } from '../lib/files';
import { slug, todayISO, monthLabel, fmtDate } from '../lib/format';
import type { AlertRow, Audit, Branch, BrandSettings, Nonconformity, ScoreResult } from '../lib/types';
import { AuditReport, type AuditReportData, type ReportPhoto } from './AuditReport';
import { ConsolidatedReport, NcReport, type ConsolidatedData } from './ConsolidatedReport';
import { buildConsolidated } from './build';
import { toPdfImage, toWhiteImage } from './images';

const MAX_PHOTOS = 60;

async function brandAndLogo(): Promise<{ brand: BrandSettings; logo: string | null; logoLight: string | null }> {
  const brand = (await must(supabase.from('brand_settings').select('*').eq('id', 1).single())) as BrandSettings;
  const url = logoPublicUrl(brand.logo_path);
  const logo = url ? await toPdfImage(url, 600, 'image/png') : null;
  return { brand, logo, logoLight: await toWhiteImage(logo) };
}

async function whoAmI(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return '—';
  const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', data.user.id).maybeSingle();
  return p?.full_name || p?.email || data.user.email || '—';
}

export function auditFileName(branch: string, date: string) {
  return `El_Condor_Auditoria_${slug(branch)}_${date}.pdf`;
}

export async function buildAuditReportData(auditId: string): Promise<AuditReportData> {
  const b = await loadAuditBundle(auditId);
  const [{ brand, logo, logoLight }, branch, version, prev, alerts, issuedBy] = await Promise.all([
    brandAndLogo(),
    must(supabase.from('branches').select('*').eq('id', b.audit.branch_id).single()),
    must(supabase.from('questionnaire_versions').select('number').eq('id', b.audit.version_id).single()),
    supabase.from('audits').select('visit_date, final_score, classification').eq('branch_id', b.audit.branch_id).eq('status', 'finalizada')
      .neq('id', auditId).lte('visit_date', b.audit.visit_date).order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('alerts').select('type, title').eq('audit_id', auditId),
    whoAmI(),
  ]);

  // Fotografías: las de preguntas e incumplimientos de esta auditoría
  const ncIds = b.nonconformities.map((n) => n.id);
  let atts = b.attachments.filter((a) => a.mime_type?.startsWith('image/'));
  if (ncIds.length) {
    const { data } = await supabase.from('attachments').select('*').in('nonconformity_id', ncIds).eq('kind', 'foto');
    atts = [...atts, ...((data ?? []) as typeof atts).filter((a) => a.mime_type?.startsWith('image/'))];
  }
  const chosen = atts.slice(0, MAX_PHOTOS);
  const urls = await signedUrls(chosen.map((a) => a.storage_path));
  const photos: ReportPhoto[] = [];
  for (const a of chosen) {
    const u = urls[a.storage_path];
    if (!u) continue;
    const dataUrl = await toPdfImage(u, 700);
    if (dataUrl) photos.push({ id: a.id, questionId: a.question_id, nonconformityId: a.nonconformity_id, dataUrl, caption: a.caption });
  }

  const result: ScoreResult = b.audit.status === 'finalizada' && b.audit.category_results
    ? b.audit.category_results
    : computeScore(b.categories, b.answers, b.states);

  return {
    brand, logo, logoLight,
    audit: b.audit,
    branch: branch as Branch,
    versionNumber: (version as { number: number }).number,
    categories: b.categories,
    answers: b.answers,
    states: b.states,
    result,
    nonconformities: b.nonconformities,
    photos,
    omittedPhotos: Math.max(0, atts.length - chosen.length),
    previous: (prev.data as AuditReportData['previous']) ?? null,
    alerts: (alerts.data as { type: string; title: string }[]) ?? [],
    issuedAt: new Date().toISOString(),
    issuedBy,
  };
}

export async function renderAuditPdf(auditId: string): Promise<{ blob: Blob; fileName: string }> {
  const data = await buildAuditReportData(auditId);
  const blob = await pdf(<AuditReport d={data} />).toBlob();
  const fileName = auditFileName(data.branch.name, data.audit.visit_date);
  logReport('individual', { revision: data.audit.revision }, fileName, auditId, data.branch.id).catch(() => undefined);
  return { blob, fileName };
}

export interface PeriodOptions {
  kind: ConsolidatedData['kind'];
  from: string;
  to: string;
  branchId?: string | null;
}

export async function renderConsolidatedPdf(o: PeriodOptions): Promise<{ blob: Blob; fileName: string }> {
  const [{ brand, logo, logoLight }, issuedBy] = await Promise.all([brandAndLogo(), whoAmI()]);
  let bq = supabase.from('branches').select('*').order('name');
  if (o.branchId) bq = bq.eq('id', o.branchId);
  const allBranches = (await must(bq)) as Branch[];

  let aq = supabase.from('audits').select('*, branches(name)').eq('status', 'finalizada').gte('visit_date', o.from).lte('visit_date', o.to).order('visit_date');
  if (o.branchId) aq = aq.eq('branch_id', o.branchId);
  const audits = (await must(aq)) as Audit[];
  // Sucursales inactivas solo si tienen auditorías en el período
  const branches = allBranches.filter((b) => b.active || audits.some((a) => a.branch_id === b.id));

  let alq = supabase.from('alerts').select('*, branches(name)').gte('created_at', o.from).lte('created_at', o.to + 'T23:59:59.999Z');
  if (o.branchId) alq = alq.eq('branch_id', o.branchId);
  const alerts = (await must(alq)) as AlertRow[];

  let nq = supabase.from('nonconformities').select('*, branches(name), categories(name)').neq('status', 'cerrado').order('due_date');
  if (o.branchId) nq = nq.eq('branch_id', o.branchId);
  const openNcs = (await must(nq)) as Nonconformity[];

  let cq = supabase.from('nonconformities').select('id', { count: 'exact', head: true }).eq('status', 'cerrado').gte('closed_at', o.from).lte('closed_at', o.to + 'T23:59:59.999Z');
  if (o.branchId) cq = cq.eq('branch_id', o.branchId);
  const { count: closedInPeriod } = await cq;

  const built = buildConsolidated({ from: o.from, to: o.to, branches, audits, alerts, openNcs, closedInPeriod: closedInPeriod ?? 0, today: todayISO() });
  const scope = o.branchId ? `Sucursal ${allBranches[0]?.name ?? ''}` : 'Todas las sucursales';
  const isMonth = o.from.slice(0, 7) === o.to.slice(0, 7) && o.from.endsWith('-01');
  const periodLabel = isMonth ? monthLabel(o.from.slice(0, 7)).replace(/^\w/, (m) => m.toUpperCase()) : `${fmtDate(o.from)} – ${fmtDate(o.to)}`;
  const titles: Record<ConsolidatedData['kind'], string> = {
    mensual: o.branchId ? 'Reporte mensual de la franquicia' : 'Reporte mensual de franquicias',
    periodo: 'Reporte de período',
    consolidado: 'Informe general de franquicias',
    evolucion: 'Reporte comparativo de evolución',
  };
  const data: ConsolidatedData = { brand, logo, logoLight, kind: o.kind, title: titles[o.kind], periodLabel, from: o.from, to: o.to, scopeLabel: scope, issuedAt: new Date().toISOString(), issuedBy, ...built };
  const blob = await pdf(<ConsolidatedReport d={data} />).toBlob();
  const fileName = `El_Condor_${slug(data.title)}_${o.branchId ? slug(allBranches[0]?.name ?? '') + '_' : ''}${o.from}_${o.to}.pdf`;
  logReport(o.kind, { from: o.from, to: o.to, branchId: o.branchId ?? null }, fileName, undefined, o.branchId ?? undefined).catch(() => undefined);
  return { blob, fileName };
}

export async function renderNcPdf(branchId?: string | null): Promise<{ blob: Blob; fileName: string }> {
  const [{ brand, logo }, issuedBy] = await Promise.all([brandAndLogo(), whoAmI()]);
  let q = supabase.from('nonconformities').select('*, branches(name), categories(name)').neq('status', 'cerrado').order('due_date', { nullsFirst: false });
  if (branchId) q = q.eq('branch_id', branchId);
  const rows = ((await must(q)) as Nonconformity[]).sort((a, b) => (a.branches?.name ?? '').localeCompare(b.branches?.name ?? ''));
  const scope = branchId ? `Sucursal ${rows[0]?.branches?.name ?? (await must(supabase.from('branches').select('name').eq('id', branchId).single()) as { name: string }).name}` : 'Todas las sucursales';
  const blob = await pdf(<NcReport d={{ brand, logo, scopeLabel: scope, rows, issuedAt: new Date().toISOString(), issuedBy }} />).toBlob();
  const fileName = `El_Condor_Incumplimientos_Pendientes_${slug(scope)}_${todayISO()}.pdf`;
  logReport('incumplimientos', { branchId: branchId ?? null }, fileName, undefined, branchId ?? undefined).catch(() => undefined);
  return { blob, fileName };
}
