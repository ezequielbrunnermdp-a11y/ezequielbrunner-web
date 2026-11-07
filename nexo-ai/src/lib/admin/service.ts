import { z } from "zod";
import { assertCan, canAssignRole, ForbiddenError, ROLES, type Ctx, type Role } from "../auth/permissions";
import { createUser, emailSchema } from "../auth/accounts";
import { audit } from "../audit";
import { readPrivacy, type PrivacySettings } from "../privacy";
import { ValidationError } from "../tasks/service";
import { cleanupOrphanFindings } from "../imports/service";

export async function listBranches(ctx: Ctx) {
  assertCan(ctx, "data.read");
  return (await ctx.db.query<{ id: string; name: string; tasks_open: number }>(
    `select b.id, b.name, (select count(*)::int from tasks t where t.branch_id = b.id and t.status in ('pending','in_progress','insufficient_info')) as tasks_open
     from branches b where b.company_id = $1 order by b.name`,
    [ctx.companyId],
  )).rows;
}

export async function createBranch(ctx: Ctx, name: string) {
  assertCan(ctx, "branches.manage");
  const n = z.string().trim().min(2, "Nombre muy corto.").max(80).parse(name);
  const r = await ctx.db.query<{ id: string }>(
    `insert into branches (company_id, name) values ($1, $2) on conflict (company_id, name) do nothing returning id`,
    [ctx.companyId, n],
  );
  if (!r.rows[0]) throw new ValidationError("Ya existe una sucursal con ese nombre.");
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "branch.create", targetType: "branch", targetId: r.rows[0].id });
}

export async function deleteBranch(ctx: Ctx, branchId: string) {
  assertCan(ctx, "branches.manage");
  const r = await ctx.db.query(`delete from branches where id = $1 and company_id = $2 returning id`, [branchId, ctx.companyId]);
  if (!r.rows.length) throw new ForbiddenError("Sucursal inexistente.");
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "branch.delete", targetType: "branch", targetId: branchId });
}

export async function listMembers(ctx: Ctx) {
  assertCan(ctx, "data.read");
  return (await ctx.db.query<{ user_id: string; name: string; email: string; role: Role; disabled: boolean }>(
    `select u.id as user_id, u.name, u.email, m.role, u.disabled_at is not null as disabled
     from memberships m join users u on u.id = m.user_id where m.company_id = $1
     order by array_position(array['owner','admin','manager','analyst','viewer'], m.role), u.name`,
    [ctx.companyId],
  )).rows;
}

export async function addMember(ctx: Ctx, input: { email: string; name?: string; role: Role; password?: string }) {
  assertCan(ctx, "members.manage");
  if (!ROLES.includes(input.role)) throw new ValidationError("Rol inválido.");
  if (!canAssignRole(ctx.role, input.role)) throw new ForbiddenError("No podés asignar un rol superior al tuyo.");
  const email = emailSchema.parse(input.email);
  await ctx.db.tx(async (q) => {
    let user = (await q.query<{ id: string }>(`select id from users where email = $1`, [email])).rows[0];
    if (!user) {
      if (!input.name?.trim() || !input.password) throw new ValidationError("Usuario nuevo: indicá nombre y contraseña inicial.");
      user = await createUser(q, { email, name: input.name, password: input.password });
    }
    const r = await q.query(
      `insert into memberships (user_id, company_id, role) values ($1, $2, $3) on conflict do nothing returning user_id`,
      [user.id, ctx.companyId, input.role],
    );
    if (!r.rows.length) throw new ValidationError("Esa persona ya es miembro de la empresa.");
    await audit(q, { companyId: ctx.companyId, actorId: ctx.userId, action: "member.add", targetType: "user", targetId: user.id, metadata: { role: input.role } });
  });
}

async function ownersCount(ctx: Ctx) {
  return Number((await ctx.db.query<{ n: number }>(`select count(*)::int n from memberships where company_id = $1 and role = 'owner'`, [ctx.companyId])).rows[0].n);
}

export async function changeMemberRole(ctx: Ctx, userId: string, role: Role) {
  assertCan(ctx, "members.manage");
  if (!ROLES.includes(role)) throw new ValidationError("Rol inválido.");
  const cur = (await ctx.db.query<{ role: Role }>(`select role from memberships where user_id = $1 and company_id = $2`, [userId, ctx.companyId])).rows[0];
  if (!cur) throw new ForbiddenError("Miembro inexistente.");
  if (!canAssignRole(ctx.role, role) || !canAssignRole(ctx.role, cur.role)) throw new ForbiddenError("No podés modificar ese rol.");
  if (cur.role === "owner" && role !== "owner" && (await ownersCount(ctx)) <= 1) throw new ValidationError("Debe quedar al menos un propietario.");
  await ctx.db.query(`update memberships set role = $3 where user_id = $1 and company_id = $2`, [userId, ctx.companyId, role]);
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "member.role", targetType: "user", targetId: userId, metadata: { from: cur.role, to: role } });
}

export async function removeMember(ctx: Ctx, userId: string) {
  assertCan(ctx, "members.manage");
  const cur = (await ctx.db.query<{ role: Role }>(`select role from memberships where user_id = $1 and company_id = $2`, [userId, ctx.companyId])).rows[0];
  if (!cur) throw new ForbiddenError("Miembro inexistente.");
  if (!canAssignRole(ctx.role, cur.role)) throw new ForbiddenError("No podés quitar a alguien con un rol superior.");
  if (cur.role === "owner" && (await ownersCount(ctx)) <= 1) throw new ValidationError("Debe quedar al menos un propietario.");
  await ctx.db.query(`delete from memberships where user_id = $1 and company_id = $2`, [userId, ctx.companyId]);
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "member.remove", targetType: "user", targetId: userId });
}

export async function getPrivacy(ctx: Ctx): Promise<PrivacySettings> {
  assertCan(ctx, "data.read");
  const r = await ctx.db.query<{ settings: unknown }>(`select settings from companies where id = $1`, [ctx.companyId]);
  return readPrivacy(r.rows[0]?.settings);
}

export async function updatePrivacy(ctx: Ctx, s: PrivacySettings) {
  assertCan(ctx, "privacy.manage");
  const parsed = z.object({
    redact_phones: z.boolean(),
    redact_emails: z.boolean(),
    ai_enabled: z.boolean(),
    retention_days: z.number().int().min(7).max(3650).nullable(),
  }).parse(s);
  await ctx.db.query(`update companies set settings = $2 where id = $1`, [ctx.companyId, JSON.stringify(parsed)]);
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "privacy.update", metadata: parsed });
}

/** Elimina mensajes más antiguos que el período de retención. Las tareas validadas se conservan. */
export async function applyRetention(ctx: Ctx): Promise<number> {
  assertCan(ctx, "privacy.manage");
  const p = await getPrivacy(ctx);
  if (!p.retention_days) throw new ValidationError("No hay un período de retención configurado.");
  const r = await ctx.db.query<{ id: string }>(
    `delete from messages where company_id = $1 and sent_at < (now() - ($2 || ' days')::interval) returning id`,
    [ctx.companyId, String(p.retention_days)],
  );
  await cleanupOrphanFindings(ctx);
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "privacy.retention_applied", metadata: { deleted: r.rows.length, days: p.retention_days } });
  return r.rows.length;
}

/** Borrado total e irreversible de la empresa y todos sus datos (cascada). */
export async function deleteCompany(ctx: Ctx, confirmSlug: string) {
  assertCan(ctx, "company.delete");
  const c = (await ctx.db.query<{ slug: string }>(`select slug from companies where id = $1`, [ctx.companyId])).rows[0];
  if (!c || c.slug !== confirmSlug.trim()) throw new ValidationError("La confirmación no coincide con el identificador de la empresa.");
  await ctx.db.query(`delete from companies where id = $1`, [ctx.companyId]);
  await audit(ctx.db, { companyId: null, actorId: ctx.userId, action: "company.delete", targetType: "company", targetId: ctx.companyId });
}

export async function listAudit(ctx: Ctx, limit = 200) {
  assertCan(ctx, "audit.read");
  return (await ctx.db.query<{ id: string; action: string; actor: string | null; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string }>(
    `select a.id, a.action, u.name as actor, a.target_type, a.target_id, a.metadata, a.created_at
     from audit_log a left join users u on u.id = a.actor_id where a.company_id = $1 order by a.created_at desc limit $2`,
    [ctx.companyId, limit],
  )).rows;
}
