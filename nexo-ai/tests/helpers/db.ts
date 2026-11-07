import { createPgliteDb, migrate, type Db } from "@/lib/db";
import { createCompany, createUser } from "@/lib/auth/accounts";
import { authorize, type Ctx, type Permission, type Role } from "@/lib/auth/permissions";

/** Postgres real en memoria (PGlite) con el esquema aplicado. */
export async function makeDb(): Promise<Db> {
  const db = await createPgliteDb();
  await migrate(db);
  return db;
}

let n = 0;
export async function makeCompanyWithOwner(db: Db, name = "Empresa") {
  n++;
  const owner = await createUser(db, { email: `owner${n}@test.local`, name: `Owner ${n}`, password: "contraseña-segura-123" });
  const company = await createCompany(db, { name: `${name} ${n}`, ownerId: owner.id });
  const ctx = await authorize(db, owner.id, company.id, "data.read");
  return { owner, company, ctx };
}

export async function addUserWithRole(db: Db, companyId: string, role: Role) {
  n++;
  const u = await createUser(db, { email: `${role}${n}@test.local`, name: `${role} ${n}`, password: "contraseña-segura-123" });
  await db.query(`insert into memberships (user_id, company_id, role) values ($1, $2, $3)`, [u.id, companyId, role]);
  return u;
}

export function ctxFor(db: Db, userId: string, companyId: string, perm: Permission = "data.read"): Promise<Ctx> {
  return authorize(db, userId, companyId, perm);
}

export const enc = (s: string) => new TextEncoder().encode(s);
