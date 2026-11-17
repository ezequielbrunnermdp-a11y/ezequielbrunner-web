import { describe, expect, it } from "vitest";
import { seedDemoCompany } from "@/lib/demo/seed";
import { createUser } from "@/lib/auth/accounts";
import { makeDb } from "./helpers/db";

describe("empresa de demostración", () => {
  it("se procesa con el pipeline real y queda marcada como ficticia", async () => {
    const db = await makeDb();
    const u = await createUser(db, { email: "demo@test.local", name: "Demo", password: "contraseña-segura-123" });
    const id = await seedDemoCompany(db, u.id);
    const c = (await db.query<{ is_demo: boolean }>(`select is_demo from companies where id = $1`, [id])).rows[0];
    expect(c.is_demo).toBe(true);
    const n = async (sql: string) => (await db.query<{ n: number }>(sql, [id])).rows[0].n;
    expect(await n(`select count(*)::int n from messages where company_id = $1`)).toBeGreaterThan(30);
    expect(await n(`select count(*)::int n from findings where company_id = $1 and status = 'proposed'`)).toBeGreaterThan(5);
    // Toda tarea proviene de un hallazgo validado con evidencia.
    expect(await n(`select count(*)::int n from tasks t where company_id = $1 and not exists (select 1 from findings f join finding_evidence e on e.finding_id = f.id where f.task_id = t.id)`)).toBe(0);
    expect(await n(`select count(*)::int n from messages where company_id = $1 and suspicious`)).toBe(1);
    expect(await n(`select count(*)::int n from messages where company_id = $1 and body like '%555 0199%'`)).toBe(0);
  });
});
