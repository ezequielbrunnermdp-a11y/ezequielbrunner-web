import { supabase, must } from './supabase';
import type {
  Answer, Attachment, Audit, BranchOverview, Category, CategoryState, Nonconformity, Question,
} from './types';

const versionCache = new Map<string, Category[]>();

export async function loadQuestionnaire(versionId: string, fresh = false): Promise<Category[]> {
  if (!fresh && versionCache.has(versionId)) return versionCache.get(versionId)!;
  const cats = await must(supabase.from('categories').select('*, questions(*)').eq('version_id', versionId).order('position'));
  const out = (cats as (Category & { questions: Question[] })[]).map((c) => ({
    ...c,
    weight: Number(c.weight),
    questions: [...c.questions].sort((a, b) => a.position - b.position),
  }));
  versionCache.set(versionId, out);
  return out;
}

export async function publishedVersionId(): Promise<string | null> {
  const { data } = await supabase.from('questionnaire_versions').select('id').eq('status', 'publicada').maybeSingle();
  return data?.id ?? null;
}

export interface AuditBundle {
  audit: Audit;
  categories: Category[];
  answers: Record<string, Answer>;
  states: Record<string, CategoryState>;
  nonconformities: Nonconformity[];
  attachments: Attachment[];
}

export async function loadAuditBundle(id: string): Promise<AuditBundle> {
  const audit = await must(supabase.from('audits').select('*, branches(name)').eq('id', id).single()) as Audit;
  const [categories, answers, states, ncs, atts] = await Promise.all([
    loadQuestionnaire(audit.version_id),
    must(supabase.from('audit_answers').select('*').eq('audit_id', id)),
    must(supabase.from('audit_category_states').select('*').eq('audit_id', id)),
    must(supabase.from('nonconformities').select('*').eq('audit_id', id).order('created_at')),
    must(supabase.from('attachments').select('*').eq('audit_id', id).order('created_at')),
  ]);
  return {
    audit,
    categories,
    answers: Object.fromEntries((answers as Answer[]).map((a) => [a.question_id, a])),
    states: Object.fromEntries((states as CategoryState[]).map((s) => [s.category_id, s])),
    nonconformities: ncs as Nonconformity[],
    attachments: atts as Attachment[],
  };
}

export interface AuditFilters {
  branchId?: string;
  auditorId?: string;
  from?: string;
  to?: string;
  status?: string;
  classification?: string;
  critical?: boolean;
}

export async function listAudits(f: AuditFilters = {}, limit = 500): Promise<Audit[]> {
  let q = supabase.from('audits').select('*, branches(name)').order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
  if (f.branchId) q = q.eq('branch_id', f.branchId);
  if (f.auditorId) q = q.eq('auditor_id', f.auditorId);
  if (f.from) q = q.gte('visit_date', f.from);
  if (f.to) q = q.lte('visit_date', f.to);
  if (f.status) q = q.eq('status', f.status);
  if (f.classification) q = q.eq('classification', f.classification);
  if (f.critical) q = q.eq('has_critical', true);
  return (await must(q)) as Audit[];
}

export async function branchOverview(): Promise<BranchOverview[]> {
  return (await must(supabase.from('branch_overview').select('*').order('name'))) as BranchOverview[];
}

export interface NcFilters { branchId?: string; status?: string; severity?: string; categoryName?: string; responsible?: string; dueFrom?: string; dueTo?: string; auditId?: string; onlyOpen?: boolean }

export async function listNonconformities(f: NcFilters = {}): Promise<Nonconformity[]> {
  let q = supabase.from('nonconformities')
    .select('*, branches(name), categories(name), questions(text), audits(visit_date, report_number, status)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (f.branchId) q = q.eq('branch_id', f.branchId);
  if (f.status) q = q.eq('status', f.status);
  if (f.onlyOpen) q = q.neq('status', 'cerrado');
  if (f.severity) q = q.eq('severity', f.severity);
  if (f.responsible) q = q.ilike('responsible', `%${f.responsible}%`);
  if (f.dueFrom) q = q.gte('due_date', f.dueFrom);
  if (f.dueTo) q = q.lte('due_date', f.dueTo);
  if (f.auditId) q = q.eq('audit_id', f.auditId);
  let rows = (await must(q)) as Nonconformity[];
  if (f.categoryName) rows = rows.filter((r) => r.categories?.name === f.categoryName);
  return rows;
}

export async function logReport(kind: string, params: Record<string, unknown>, fileName: string, auditId?: string, branchId?: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('generated_reports').insert({ kind, params, file_name: fileName, audit_id: auditId ?? null, branch_id: branchId ?? null, generated_by: data.user.id });
}

/** Auditores (solo visible para administración; otros perfiles reciben su propio usuario). */
export async function listStaff() {
  const { data } = await supabase.from('profiles').select('id, full_name, email, role, active').in('role', ['admin', 'auditor']).order('full_name');
  return (data ?? []) as { id: string; full_name: string; email: string; role: string; active: boolean }[];
}
