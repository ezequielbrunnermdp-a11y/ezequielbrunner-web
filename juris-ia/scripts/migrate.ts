import fs from "node:fs";
import pg from "pg";

/** Aplica db/schema.sql (idempotente). */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await client.end();
console.log("Esquema aplicado.");
