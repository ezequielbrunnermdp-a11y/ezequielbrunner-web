export type PunchKind = 'in' | 'out' | 'break_start' | 'break_end';

export interface Profile {
  user_id: string; organization_id: string; first_name: string; last_name: string; avatar_path: string | null;
  bio: string | null; interests: string[]; social_enabled: boolean; show_birthday: boolean; birth_month: number | null;
  birth_day: number | null; show_hire_date: boolean; show_read_receipts: boolean; notification_prefs: Record<string, boolean>;
}
export interface EmploymentCtx {
  id: string; status: string; position: string; employee_code: string; legal_entity_id: string; legal_entity: string;
  branch_id: string; branch: string; brand_id: string; brand: string; brand_logo: string | null; brand_color: string | null;
  sector: string | null; hire_date: string | null; has_kiosk_pin: boolean;
}
export interface RoleCtx { role: string; name: string; scope_type: 'organization' | 'legal_entity' | 'branch'; scope_id: string; organization_id: string; permissions: string[] }
export interface AppContext {
  user_id: string; aal: 'aal1' | 'aal2'; profile: Profile | null; is_platform_admin: boolean;
  organization: { id: string; name: string; slug: string; logo_path: string | null; settings: { timezone?: string; cross_brand_social?: boolean; require_mfa?: boolean } } | null;
  employments: EmploymentCtx[]; roles: RoleCtx[]; mfa_required: boolean; unread_notifications: number;
}

export interface PunchResult {
  result: 'confirmed' | 'pending_review' | 'duplicate' | 'already_open' | 'branch_not_allowed' | 'qr_required' | 'qr_invalid' |
          'qr_expired' | 'qr_reused' | 'qr_wrong_branch' | 'geo_outside' | 'geo_imprecise' | 'geo_unavailable' | 'bad_credentials';
  punch_id?: string; kind?: PunchKind; status?: 'confirmed' | 'pending_review' | 'rejected'; server_time?: string;
  branch_name?: string; flags?: string[]; distance_m?: number; accuracy_m?: number; radius_m?: number; review_available?: boolean;
  open_since?: string; first_name?: string; message?: string;
}

export interface ClockStatus {
  server_time: string;
  open_session: { id: string; started_at: string; branch_id: string; branch_name: string; on_break: boolean } | null;
  next_shift: { id: string; starts_at: string; ends_at: string; branch_id: string; branch_name: string } | null;
  branches: { id: string; name: string; require_qr: boolean; require_gps: boolean; radius_m: number; has_coordinates: boolean }[];
}

export interface Shift { id: string; branch_id: string; branch_name: string; sector_name: string | null; starts_at: string; ends_at: string; break_minutes: number; role_label: string | null; notes: string | null; status: string }

export const PUNCH_LABEL: Record<PunchKind, string> = { in: 'Ingreso', out: 'Salida', break_start: 'Inicio de descanso', break_end: 'Fin de descanso' };
export const PUNCH_STATUS: Record<string, string> = { confirmed: 'Confirmada', pending_review: 'Pendiente de revisión', rejected: 'Rechazada' };
export const PUNCH_FLAG: Record<string, string> = {
  late: 'Llegada tarde', early_leave: 'Salida anticipada', no_shift: 'Sin turno asignado', out_without_in: 'Salida sin ingreso',
  long_session: 'Jornada prolongada', offline_declared: 'Declarada sin conexión', geo_outside: 'Fuera del perímetro',
  geo_imprecise: 'Ubicación imprecisa', geo_unavailable: 'Sin ubicación', supervised: 'Supervisada', correction: 'Corrección',
  admin_close: 'Cierre administrativo', branch_without_coordinates: 'Sucursal sin coordenadas', qr_not_required: 'Sin QR (no requerido)',
  break_without_session: 'Descanso sin jornada', already_open: 'Jornada ya abierta',
};
