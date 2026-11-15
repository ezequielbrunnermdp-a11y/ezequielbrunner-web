import type { Config } from "@netlify/functions";
import { runJob } from "../../src/lib/jobs";

/**
 * Función de segundo plano (hasta 15 minutos): ejecuta las tareas largas de Claude
 * (chat, informes, OCR y clasificación, jurisprudencia). Solo acepta llamadas de la app.
 */
export default async (req: Request) => {
  if (req.headers.get("x-worker-secret") !== Netlify.env.get("WORKER_SECRET")) {
    return new Response("No autorizado", { status: 401 });
  }
  const { jobId } = (await req.json()) as { jobId?: string };
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return new Response("jobId inválido", { status: 400 });
  await runJob(jobId);
};

export const config: Config = { background: true };
