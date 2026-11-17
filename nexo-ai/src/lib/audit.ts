import type { Queryable } from "./db";

export interface AuditEntry {
  companyId: string | null;
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/** Registro de auditoría append-only. Nunca guarda contenido de mensajes. */
export async function audit(q: Queryable, e: AuditEntry): Promise<void> {
  await q.query(
    `insert into audit_log (company_id, actor_id, action, target_type, target_id, metadata)
     values ($1, $2, $3, $4, $5, $6)`,
    [e.companyId, e.actorId, e.action, e.targetType ?? null, e.targetId ?? null, JSON.stringify(e.metadata ?? {})],
  );
}

export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  "auth.login_failed": "Intento de acceso fallido",
  "auth.logout": "Cierre de sesión",
  "auth.setup": "Configuración inicial",
  "company.create": "Empresa creada",
  "company.delete": "Empresa eliminada",
  "privacy.update": "Privacidad actualizada",
  "privacy.retention_applied": "Retención aplicada",
  "branch.create": "Sucursal creada",
  "branch.delete": "Sucursal eliminada",
  "member.add": "Miembro agregado",
  "member.role": "Rol modificado",
  "member.remove": "Miembro quitado",
  "import.create": "Importación",
  "import.delete": "Importación eliminada",
  "conversation.update": "Conversación editada",
  "conversation.delete": "Conversación eliminada",
  "analysis.run": "Análisis ejecutado",
  "finding.approve": "Hallazgo aprobado",
  "finding.reject": "Hallazgo descartado",
  "finding.insufficient": "Hallazgo sin información suficiente",
  "finding.confirm_completion": "Cumplimiento confirmado",
  "task.create": "Tarea creada",
  "task.update": "Tarea actualizada",
  "task.status": "Cambio de estado",
  "search.ask": "Consulta conversacional",
  "report.export": "Reporte exportado",
};
