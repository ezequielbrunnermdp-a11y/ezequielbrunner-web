import { beforeAll, describe, expect, it } from "vitest";
import { authorize, can, canAssignRole, ForbiddenError, ROLES } from "@/lib/auth/permissions";
import { authenticate, createSession, userForToken } from "@/lib/auth/accounts";
import { importChat, deleteConversation } from "@/lib/imports/service";
import { changeTaskStatus, createTask, getTask, listTasks } from "@/lib/tasks/service";
import { searchMessages } from "@/lib/search/service";
import { addMember, changeMemberRole, deleteCompany, removeMember, listAudit } from "@/lib/admin/service";
import { buildReport } from "@/lib/reports/service";
import type { Db } from "@/lib/db";
import { addUserWithRole, enc, makeCompanyWithOwner, makeDb } from "./helpers/db";

describe("matriz de roles", () => {
  it("lectura no puede escribir, analista no valida, encargado no administra", () => {
    expect(can("viewer", "data.read")).toBe(true);
    expect(can("viewer", "tasks.write")).toBe(false);
    expect(can("analyst", "findings.review")).toBe(false);
    expect(can("manager", "findings.review")).toBe(true);
    expect(can("manager", "members.manage")).toBe(false);
    expect(can("admin", "company.delete")).toBe(false);
    expect(can("owner", "company.delete")).toBe(true);
  });
  it("nadie asigna un rol superior al propio", () => {
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(true);
    for (const r of ROLES) expect(canAssignRole("viewer", r)).toBe(r === "viewer");
  });
});

describe("aislamiento entre empresas y control de acceso", () => {
  let db: Db;
  beforeAll(async () => {
    db = await makeDb();
  });

  it("un usuario no accede a otra empresa aunque conozca los IDs", async () => {
    const A = await makeCompanyWithOwner(db, "Parrilla");
    const B = await makeCompanyWithOwner(db, "Pizzería");
    const ctxA = await authorize(db, A.owner.id, A.company.id, "tasks.write");
    const ctxB = await authorize(db, B.owner.id, B.company.id, "tasks.write");
    const imp = await importChat(ctxA, { fileName: "c.txt", bytes: enc("12/03/2024, 09:15 - Ana: Secreto de la parrilla"), title: "Cocina" });
    const taskA = await createTask(ctxA, { title: "Tarea privada de A" });

    await expect(authorize(db, A.owner.id, B.company.id, "data.read")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getTask(ctxB, taskA)).toBeNull();
    expect(await listTasks(ctxB, { status: "all" })).toHaveLength(0);
    expect(await searchMessages(ctxB, "secreto parrilla")).toHaveLength(0);
    expect(await searchMessages(ctxA, "secreto parrilla")).toHaveLength(1);
    await expect(changeTaskStatus(ctxB, taskA, "in_progress")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteConversation(ctxB, imp.conversationId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(importChat(ctxB, { fileName: "c.txt", bytes: enc("12/03/2024, 09:15 - X: y"), conversationId: imp.conversationId }))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect((await buildReport(ctxB, "month", "2024-03-12")).totals.messages).toBe(0);
  });

  it("los roles limitan las acciones dentro de la empresa", async () => {
    const A = await makeCompanyWithOwner(db);
    const viewer = await addUserWithRole(db, A.company.id, "viewer");
    const analyst = await addUserWithRole(db, A.company.id, "analyst");
    await expect(authorize(db, viewer.id, A.company.id, "tasks.write")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(authorize(db, analyst.id, A.company.id, "imports.create")).rejects.toBeInstanceOf(ForbiddenError);
    // Aun con un contexto de lectura válido, los servicios vuelven a verificar el permiso.
    const vctx = await authorize(db, viewer.id, A.company.id, "data.read");
    await expect(createTask(vctx, { title: "No debería" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(importChat(vctx, { fileName: "c.txt", bytes: enc("12/03/2024, 09:15 - X: y") })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("administración de miembros respeta jerarquía y conserva un propietario", async () => {
    const A = await makeCompanyWithOwner(db);
    const admin = await addUserWithRole(db, A.company.id, "admin");
    const actx = await authorize(db, admin.id, A.company.id, "members.manage");
    await expect(addMember(actx, { email: "nuevo@test.local", name: "Nuevo", password: "contraseña-segura-123", role: "owner" }))
      .rejects.toBeInstanceOf(ForbiddenError);
    await addMember(actx, { email: "nuevo@test.local", name: "Nuevo", password: "contraseña-segura-123", role: "manager" });
    await expect(changeMemberRole(actx, A.owner.id, "viewer")).rejects.toBeInstanceOf(ForbiddenError);
    const octx = await authorize(db, A.owner.id, A.company.id, "members.manage");
    await expect(removeMember(octx, A.owner.id)).rejects.toThrow(/al menos un propietario/);
    const audit = await listAudit(octx);
    expect(audit.some((a) => a.action === "member.add")).toBe(true);
  });

  it("sólo el propietario elimina la empresa y con confirmación exacta", async () => {
    const A = await makeCompanyWithOwner(db, "Borrable");
    const admin = await addUserWithRole(db, A.company.id, "admin");
    const actx = await authorize(db, admin.id, A.company.id, "data.read");
    await expect(deleteCompany(actx, A.company.slug)).rejects.toBeInstanceOf(ForbiddenError);
    const octx = await authorize(db, A.owner.id, A.company.id, "company.delete");
    await expect(deleteCompany(octx, "otra-cosa")).rejects.toThrow(/no coincide/);
    await importChat(octx, { fileName: "c.txt", bytes: enc("12/03/2024, 09:15 - Ana: Hola"), title: "Cocina" });
    await deleteCompany(octx, A.company.slug);
    const left = await db.query(`select 1 from messages where company_id = $1`, [A.company.id]);
    expect(left.rows).toHaveLength(0);
  });

  it("sesiones: contraseñas con hash, tokens opacos y usuarios deshabilitados sin acceso", async () => {
    const A = await makeCompanyWithOwner(db);
    expect(await authenticate(db, A.owner.email, "incorrecta-123456")).toBeNull();
    const u = await authenticate(db, A.owner.email.toUpperCase(), "contraseña-segura-123");
    expect(u?.id).toBe(A.owner.id);
    const { token } = await createSession(db, A.owner.id);
    const stored = await db.query<{ token_hash: string }>(`select token_hash from sessions where user_id = $1`, [A.owner.id]);
    expect(stored.rows[0].token_hash).not.toBe(token);
    expect((await userForToken(db, token))?.id).toBe(A.owner.id);
    await db.query(`update users set disabled_at = now() where id = $1`, [A.owner.id]);
    expect(await userForToken(db, token)).toBeNull();
    await expect(authorize(db, A.owner.id, A.company.id, "data.read")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
