import { q, type Db, pool } from "./db";

export async function audit(
  e: { actorId: string | null; action: string; entity: string; entityId?: string | null; before?: unknown; after?: unknown; ip?: string | null },
  db: Db = pool(),
) {
  await q(
    `insert into audit_log (actor_user_id, action, entity, entity_id, before, after, ip) values ($1,$2,$3,$4,$5,$6,$7)`,
    [e.actorId, e.action, e.entity, e.entityId ?? null, e.before == null ? null : JSON.stringify(e.before), e.after == null ? null : JSON.stringify(e.after), e.ip ?? null],
    db,
  );
}
