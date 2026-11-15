export type Job = {
  id: string;
  status: "pendiente" | "en_curso" | "listo" | "error";
  progreso: string | null;
  texto: string;
  mensajes: { markdown: string; citas: any[] }[];
  result: any;
  error: string | null;
  vencida: boolean;
};

async function jsonOrError(res: Response) {
  let j: any = null;
  try { j = await res.json(); } catch {}
  if (!res.ok) throw new Error(j?.error ?? `Error ${res.status}`);
  return j;
}

/** Sigue una tarea en segundo plano hasta que termina, informando cada actualización. */
export async function followJob(jobId: string, onUpdate: (j: Job) => void, signal?: AbortSignal): Promise<Job> {
  for (;;) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const j: Job = await jsonOrError(await fetch(`/api/jobs/${jobId}`, { cache: "no-store" }));
    onUpdate(j);
    if (j.status === "listo") return j;
    if (j.status === "error") throw new Error(j.error ?? "La tarea falló");
    if (j.vencida) throw new Error("La tarea no respondió a tiempo. Intente nuevamente.");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** POST que inicia una tarea (202 + jobId) o responde directamente (200). */
export async function startTask(url: string, body: unknown): Promise<any> {
  return jsonOrError(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

/** Carga un archivo por partes de 4 MB. */
export async function uploadFile(caseId: string, file: File, onProgress?: (p: number) => void) {
  const base = `/api/cases/${caseId}/uploads`;
  const { uploadId, partMax } = await jsonOrError(await fetch(`${base}?accion=iniciar`, { method: "POST" }));
  const partes = Math.max(1, Math.ceil(file.size / partMax));
  for (let n = 0; n < partes; n++) {
    const blob = file.slice(n * partMax, (n + 1) * partMax);
    await jsonOrError(await fetch(`${base}?accion=parte&uploadId=${uploadId}&n=${n}`, { method: "POST", body: blob }));
    onProgress?.((n + 1) / partes);
  }
  const qs = new URLSearchParams({ accion: "finalizar", uploadId, partes: String(partes), nombre: file.name, tipo: file.type });
  return jsonOrError(await fetch(`${base}?${qs}`, { method: "POST" }));
}
