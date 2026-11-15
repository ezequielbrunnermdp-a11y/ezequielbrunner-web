import { handle, requireUser } from "@/lib/auth";
import { isConfigured, MODEL } from "@/lib/claude";
import { embeddingsEnabled } from "@/lib/embeddings";
import { env } from "@/lib/env";

/** Estado real de las integraciones configuradas (para mostrar en la interfaz). */
export const GET = handle(async () => {
  await requireUser();
  return Response.json({
    claude: { configurado: isConfigured(), modelo: MODEL },
    embeddings: { configurado: embeddingsEnabled(), proveedor: embeddingsEnabled() ? `Voyage AI (${env.voyageModel})` : null },
    busqueda: embeddingsEnabled() ? "híbrida (léxica + semántica)" : "léxica (full-text español + trigramas)",
    jurisprudenciaWeb: env.webSearchEnabled,
    mev: { integrada: false, motivo: "Requiere credenciales personales; la SCBA no publica API para sistemas. Importación manual." },
  });
});
