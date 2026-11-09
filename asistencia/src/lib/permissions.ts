import { forbidden } from "./errors";

export type Role = "superadmin" | "company_admin" | "manager" | "supervisor" | "employee";
export interface Scope { company_id: string; branch_id: string | null }
export interface Actor {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  scopes: Scope[];
  employee_id: string | null;
  must_change_password: boolean;
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Administrador general",
  company_admin: "Administrador de empresa",
  manager: "Gerencia",
  supervisor: "Encargado",
  employee: "Empleado",
};

/** Capacidades por rol. Toda acción del servidor consulta esta tabla. */
const CAPS = {
  "companies.manage": ["superadmin"],
  "branches.manage": ["superadmin", "company_admin"],
  "employees.manage": ["superadmin", "company_admin"],
  "users.manage": ["superadmin", "company_admin"],
  "terminals.manage": ["superadmin", "company_admin"],
  "schedules.manage": ["superadmin", "company_admin"],
  "corrections.request": ["superadmin", "company_admin", "manager", "supervisor"],
  "corrections.review": ["superadmin", "company_admin", "manager"],
  "alerts.ack": ["superadmin", "company_admin", "manager", "supervisor"],
  "reports.view": ["superadmin", "company_admin", "manager", "supervisor"],
  "audit.view": ["superadmin", "company_admin"],
  "dashboard.view": ["superadmin", "company_admin", "manager", "supervisor"],
} as const satisfies Record<string, readonly Role[]>;
export type Cap = keyof typeof CAPS;

export function can(actor: Actor, cap: Cap): boolean {
  return (CAPS[cap] as readonly Role[]).includes(actor.role);
}
export function requireCap(actor: Actor, cap: Cap) {
  if (!can(actor, cap)) throw forbidden();
}

export const isStaff = (a: Actor) => a.role !== "employee";

export function canAccessCompany(actor: Actor, companyId: string): boolean {
  if (actor.role === "superadmin") return true;
  return actor.scopes.some((s) => s.company_id === companyId);
}

export function canAccessBranch(actor: Actor, companyId: string, branchId: string): boolean {
  if (actor.role === "superadmin") return true;
  return actor.scopes.some((s) => s.company_id === companyId && (s.branch_id === null || s.branch_id === branchId));
}

/** El usuario tiene alcance sobre toda la empresa (no sólo algunas sucursales). */
export function hasCompanyWideScope(actor: Actor, companyId: string): boolean {
  if (actor.role === "superadmin") return true;
  return actor.scopes.some((s) => s.company_id === companyId && s.branch_id === null);
}

export function assertBranch(actor: Actor, companyId: string, branchId: string) {
  if (!canAccessBranch(actor, companyId, branchId)) throw forbidden("No tenés acceso a esa sucursal.");
}
export function assertCompany(actor: Actor, companyId: string) {
  if (!canAccessCompany(actor, companyId)) throw forbidden("No tenés acceso a esa empresa.");
}

/**
 * Fragmento SQL que restringe filas al alcance del actor.
 * Agrega los parámetros a `params` y devuelve la condición.
 */
export function scopeSql(actor: Actor, companyCol: string, branchCol: string, params: unknown[]): string {
  if (actor.role === "superadmin") return "true";
  if (actor.scopes.length === 0) return "false";
  const parts = actor.scopes.map((s) => {
    params.push(s.company_id);
    const c = `${companyCol} = $${params.length}`;
    if (s.branch_id === null) return `(${c})`;
    params.push(s.branch_id);
    return `(${c} and ${branchCol} = $${params.length})`;
  });
  return `(${parts.join(" or ")})`;
}
