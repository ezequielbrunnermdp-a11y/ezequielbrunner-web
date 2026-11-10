/** Datos de DEMOSTRACIÓN para una base de pruebas. Requiere ALLOW_DEMO_SEED=true. */
import "./env";
import { pool, tx } from "../src/lib/db";
import { seedDemo } from "../src/lib/demo";
import { createPairingCode } from "../src/lib/terminals";

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Definí ALLOW_DEMO_SEED=true para cargar datos de demostración.");
  const lat = process.env.DEMO_LAT ? Number(process.env.DEMO_LAT) : undefined;
  const lng = process.env.DEMO_LNG ? Number(process.env.DEMO_LNG) : undefined;
  const r = await tx((c) => seedDemo(c, { password: "Demo12345", pin: "1234", lat, lng }));
  const code = await createPairingCode(r.terminalId);
  console.log(`✔ Datos demo cargados.
  Usuarios (contraseña Demo12345): admin@demo.local · gerencia@demo.local · encargado@demo.local · empleado1..3@demo.local
  PIN de terminal de empleados demo: 1234 (legajos 9001, 9002, 9003)
  Código para vincular la terminal demo (15 min): ${code}
  Ubicación del local demo: ${r.lat}, ${r.lng} (radio 100 m)`);
}
main().then(() => pool().end()).catch((e) => { console.error(e.message); process.exit(1); });
