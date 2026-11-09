/** Worker de tareas programadas: ejecuta los jobs cada minuto. Uso: npm run worker */
import "./env";
import { runAllJobs } from "../src/lib/jobs";

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await runAllJobs();
    console.log(new Date().toISOString(), JSON.stringify(r));
  } catch (e) {
    console.error(new Date().toISOString(), "Error en tareas programadas:", e);
  } finally {
    running = false;
  }
}
tick();
setInterval(tick, 60_000);
