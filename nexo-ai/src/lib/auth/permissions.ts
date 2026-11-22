import type { Db } from "../db";

export const ROLES = ["owner", "admin", "manager", "analyst", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propietario",
  admin: "Administrador",
  manager: "Encargado",
  analyst: "Analista",
  viewer: "Lectura",
};

export type Permission =
  | "data.read"
  | "imports.create"
  | "imports.delete"
  | "analysis.run"
  | "findings.review"
  | "tasks.write"
  | "reports.read"
  | "branches.manage"
  | "members.manage"
  | "privacy.manage"
  | "audit.read"
  | "company.delete";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "data.read", "imports.create", "imports.delete", "analysis.run", "findings.review", "tasks.write",
    "reports.read", "branches.manage", "members.manage", "privacy.manage", "audit.read", "company.delete",
  ],
  admin: [
    "data.read", "imports.create", "imports.delete", "analysis.run", "findings.review", "tasks.write",
    "reports.read", "branches.manage", "members.manage", "privacy.manage", "audit.read",
  ],
  manager: ["data.read", "imports.create", "analysis.run", "findings.review", "tasks.write", "reports.read"],
  analyst: ["data.read", "analysis.run", "reports.read"],
  viewer: ["data.read", "reports.read"],
};

export function can(role: Role, perm: Permission): boolean {
  return MATRIX[role]?.includes(perm) ?? false;
}

/** Un rol sólo puede asignar roles de igual o menor jerarquía (nadie crea propietarios salvo otro propietario). */
export function canAssignRole(actor: Role, target: Role): boolean {
  return ROLES.indexOf(target) >= ROLES.indexOf(actor);
}

export class ForbiddenError extends Error {
  constructor(message = "No tenés permiso para realizar esta acción.") {
    super(message);
  }
}

export interface Ctx {
  db: Db;
  userId: string;
  companyId: string;
  role: Role;
}

/**
 * Punto único de control de acceso a datos de una empresa.
 * Verifica en la base que el usuario sea miembro de esa empresa y tenga el permiso.
 * Ser administrador de plataforma NO otorga acceso a datos de empresas.
 */
export async function authorize(db: Db, userId: string, companyId: string, perm: Permission): Promise<Ctx> {
  const r = await db.query<{ role: Role }>(
    `select m.role from memberships m join users u on u.id = m.user_id
     where m.user_id = $1 and m.company_id = $2 and u.disabled_at is null`,
    [userId, companyId],
  );
  const role = r.rows[0]?.role;
  if (!role) throw new ForbiddenError("No pertenecés a esta empresa.");
  if (!can(role, perm)) throw new ForbiddenError();
  return { db, userId, companyId, role };
}

export function assertCan(ctx: Ctx, perm: Permission) {
  if (!can(ctx.role, perm)) throw new ForbiddenError();
}
