import "server-only";
import { env } from "./env";

/**
 * Embeddings semánticos vía Voyage AI (opcional). Anthropic no ofrece un endpoint de
 * embeddings; Voyage es el proveedor que recomienda su documentación. Sin VOYAGE_API_KEY,
 * el sistema funciona con búsqueda léxica (full-text en español + trigramas).
 */
export function embeddingsEnabled(): boolean {
  return Boolean(env.voyageApiKey);
}

export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  if (!embeddingsEnabled()) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.voyageApiKey}` },
      body: JSON.stringify({ input: batch, model: env.voyageModel, input_type: inputType, output_dimension: 1024 }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    json.data.sort((a, b) => a.index - b.index).forEach((d) => out.push(d.embedding));
  }
  return out;
}

export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
