export type Role = 'admin' | 'auditor' | 'franquiciado';
export type AuditStatus = 'borrador' | 'finalizada';
export type AuditType = 'programada' | 'sorpresiva' | 'seguimiento';
export type Severity = 'leve' | 'moderada' | 'grave' | 'critica';
export type NcStatus = 'pendiente' | 'en_proceso' | 'corregido' | 'cerrado';
export type DocStatus = 'verificado' | 'pendiente' | 'no_cumple';
export type AlertType =
  | 'riesgo_sanitario' | 'alimentos_vencidos' | 'temperatura' | 'riesgo_electrico_incendio'
  | 'legal' | 'contractual' | 'reiteracion' | 'accion_vencida' | 'control_critico';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  legal_name: string | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  assigned_auditor_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface BranchOverview extends Branch {
  last_audit_date: string | null;
  last_score: number | null;
  avg_score: number | null;
  audits_count: number;
  open_nc: number;
}

export interface QuestionnaireVersion {
  id: string;
  number: number;
  name: string;
  status: 'borrador' | 'publicada' | 'archivada';
  notes: string | null;
  created_at: string;
  published_at: string | null;
}

export interface Question {
  id: string;
  category_id: string;
  position: number;
  text: string;
  guidance: string | null;
  critical_control: boolean;
  active: boolean;
}

export type CategoryExtras = 'compra_prueba' | 'degustacion' | 'atribucion' | 'caja' | 'indicadores' | 'club' | null;

export interface Category {
  id: string;
  version_id: string;
  position: number;
  code: string;
  name: string;
  weight: number;
  description: string | null;
  extras: CategoryExtras;
  kind: 'puntaje' | 'documento';
  questions: Question[];
}

export interface Audit {
  id: string;
  report_number: string | null;
  branch_id: string;
  auditor_id: string;
  auditor_name: string;
  version_id: string;
  visit_date: string;
  start_time: string | null;
  manager_present: string | null;
  audit_type: AuditType;
  initial_notes: string | null;
  status: AuditStatus;
  final_score: number | null;
  classification: string | null;
  has_critical: boolean;
  category_results: ScoreResult | null;
  weights_redistributed: boolean;
  conclusion: string | null;
  recommendations: string | null;
  receipt_name: string | null;
  receipt_at: string | null;
  revision: number;
  correction_reason: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  branches?: { name: string } | null;
}

export interface Answer {
  audit_id: string;
  question_id: string;
  score: number | null;
  not_applicable: boolean;
  na_reason: string | null;
  observation: string | null;
  recommendation: string | null;
  is_critical: boolean;
  doc_status: DocStatus | null;
  doc_expiry: string | null;
  updated_at?: string;
}

export interface CategoryState {
  audit_id: string;
  category_id: string;
  not_applicable: boolean;
  na_reason: string | null;
  extras: Record<string, unknown>;
}

export interface Nonconformity {
  id: string;
  audit_id: string | null;
  branch_id: string;
  category_id: string | null;
  question_id: string | null;
  description: string;
  severity: Severity;
  alert_type: AlertType | null;
  attributable_to: 'franquicia' | 'franquiciante';
  recommended_action: string | null;
  responsible: string | null;
  due_date: string | null;
  status: NcStatus;
  notes: string | null;
  corrected_at: string | null;
  correction_comment: string | null;
  verified_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  branches?: { name: string } | null;
  categories?: { name: string } | null;
  questions?: { text: string } | null;
  audits?: { visit_date: string; report_number: string | null; status: AuditStatus } | null;
}

export interface NcEvent {
  id: string;
  nonconformity_id: string;
  author_name: string | null;
  from_status: NcStatus | null;
  to_status: NcStatus | null;
  comment: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  branch_id: string;
  audit_id: string | null;
  question_id: string | null;
  nonconformity_id: string | null;
  kind: 'foto' | 'documento' | 'evidencia_correccion';
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  caption: string | null;
  created_at: string;
}

export interface AlertRow {
  id: string;
  branch_id: string;
  audit_id: string | null;
  nonconformity_id: string | null;
  type: AlertType;
  severity: Severity;
  title: string;
  detail: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  branches?: { name: string } | null;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface BrandSettings {
  company_name: string;
  platform_name: string;
  subtitle: string;
  logo_path: string | null;
  color_primary: string;
  color_accent: string;
  color_background: string;
  receipt_enabled: boolean;
}

export interface CommercialIndicator {
  id: string;
  branch_id: string;
  period: string;
  sales: number | null;
  tickets: number | null;
  avg_ticket: number | null;
  cmv: number | null;
  factory_purchases: number | null;
  waste_units: number | null;
  waste_value: number | null;
  top_products: string | null;
  discounts: number | null;
  credit_notes: number | null;
  voids: number | null;
  internal_consumption: number | null;
  source: 'manual' | 'importacion' | 'integracion';
  notes: string | null;
}

export interface CategoryResult {
  category_id: string;
  code: string;
  name: string;
  weight: number;
  applicable: boolean;
  na_reason?: string | null;
  obtained: number;
  max: number;
  pct: number | null;
  criticals: number;
  na_questions?: number;
  effective_weight: number;
  score: number | null;
}

export interface ScoreResult {
  final_score: number | null;
  classification: string | null;
  total_weight: number;
  applicable_weight: number;
  redistributed: boolean;
  pending: number;
  errors: { category: string; error: string }[];
  categories: CategoryResult[];
}
