// Función programada de Netlify: dispara las tareas del sistema cada 5 minutos
// (alertas, reporte diario, envío de correos y retención de datos).
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("Faltan URL o CRON_SECRET");
    return;
  }
  const r = await fetch(`${base}/api/cron`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log("tareas:", r.status, (await r.text()).slice(0, 300));
};

export const config = { schedule: "*/5 * * * *" };
