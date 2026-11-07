/** Aplica las migraciones pendientes a DATABASE_URL (o a la base embebida local). */
import { getDb } from "../src/lib/db";

const db = await getDb();
const r = await db.query<{ name: string }>(`select name from schema_migrations order by name`);
console.log(`Migraciones aplicadas: ${r.rows.map((x) => x.name).join(", ")}`);
await db.close();
