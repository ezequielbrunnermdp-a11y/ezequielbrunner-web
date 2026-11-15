/**
 * Evaluación de respuestas contra las fuentes (requiere ANTHROPIC_API_KEY y base configurada).
 * Usa el expediente FICTICIO de tests/fixtures (generarlo antes con
 * `npx tsx tests/fixtures/generar-expediente-ficticio.ts`).
 *
 * Para cada pregunta verifica:
 *  - que la respuesta tenga citas y que TODAS se verifiquen contra el texto almacenado;
 *  - que contenga los datos esperados (montos, decisiones) y no contenga datos falsos;
 *  - que reconozca la falta de información cuando corresponde.
 * Uso: npm run eval:citas
 */
import fs from "node:fs";
import { getPool, one, query } from "../src/lib/db";
import { ingestDocument, enrichDocument } from "../src/lib/ingest";
import { getOrCreateThread, sendChat } from "../src/lib/chat";
import { hashPassword } from "../src/lib/crypto";
import type { Cita } from "../src/lib/citations";

type Caso = { pregunta: string; debeContener: RegExp[]; noDebeContener?: RegExp[]; requiereCitas: boolean };
const CASOS: Caso[] = [
  { pregunta: "¿Qué reclama la actora y cuánto dinero solicita?", debeContener: [/5\.000\.000|cinco millones/i], requiereCitas: true },
  { pregunta: "¿Qué decidió el juez y por qué monto condenó?", debeContener: [/3\.200\.000|tres millones doscientos/i], noDebeContener: [/rechaz[óo] la demanda/i], requiereCitas: true },
  { pregunta: "¿Encontrás contradicciones entre los testigos sobre el semáforo?", debeContener: [/Testigo Dos|María/i], requiereCitas: true },
  { pregunta: "¿Qué concluyó la pericia médica producida en autos?", debeContener: [/no (surge|consta|se (encuentra|incorpor))|no (hay|figura)/i], requiereCitas: false },
  { pregunta: "Citame un fallo de la SCBA sobre culpa de la víctima con su carátula y fecha.", debeContener: [/JUBA|verific|no (puedo|cuento)/i], requiereCitas: false },
];

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY: la evaluación necesita llamar a Claude.");
  process.exit(1);
}
const pdf = fs.readFileSync(new URL("../tests/fixtures/expediente-ficticio.pdf", import.meta.url));
const user = (await one<{ id: string }>(
  "INSERT INTO users (email, name, password_hash) VALUES ($1,'Eval',$2) RETURNING id",
  [`eval-${Date.now()}@juris.local`, hashPassword("x".repeat(16))],
))!;
const causa = (await one<{ id: string }>("INSERT INTO cases (owner_id, caratula) VALUES ($1,'EVAL — expediente ficticio') RETURNING id", [user.id]))!;
let fallas = 0;
try {
  const r = await ingestDocument(causa.id, user.id, { name: "expediente-ficticio.pdf", type: "application/pdf", buf: pdf });
  await enrichDocument(r.documentId);
  for (const c of CASOS) {
    const threadId = await getOrCreateThread(causa.id, user.id, null);
    let markdown = "";
    let citas: Cita[] = [];
    await sendChat({
      caseId: causa.id, threadId, question: c.pregunta, perspectiva: "neutral",
      onEvent: (e) => { if (e.type === "message") { markdown += e.markdown + "\n"; citas = citas.concat(e.citas); } },
    });
    const problemas: string[] = [];
    if (c.requiereCitas && !citas.length) problemas.push("sin citas");
    const noVerif = citas.filter((x) => x.kind === "expediente" && !x.verificada);
    if (noVerif.length) problemas.push(`${noVerif.length} cita(s) no verificadas`);
    for (const re of c.debeContener) if (!re.test(markdown)) problemas.push(`falta ${re}`);
    for (const re of c.noDebeContener ?? []) if (re.test(markdown)) problemas.push(`contiene ${re}`);
    if (problemas.length) fallas++;
    console.log(`\n${problemas.length ? "✗" : "✓"} ${c.pregunta}\n  citas: ${citas.length} (${citas.filter((x) => x.verificada).length} verificadas)${problemas.length ? `\n  problemas: ${problemas.join("; ")}` : ""}`);
    await query("DELETE FROM chat_threads WHERE id = $1", [threadId]);
  }
} finally {
  await query("DELETE FROM cases WHERE id = $1", [causa.id]);
  await query("DELETE FROM users WHERE id = $1", [user.id]);
  await getPool().end();
}
console.log(`\nResultado: ${CASOS.length - fallas}/${CASOS.length} casos sin problemas.`);
process.exit(fallas ? 1 : 0);
