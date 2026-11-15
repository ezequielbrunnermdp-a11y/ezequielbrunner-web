import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export const claude = new Anthropic({ maxRetries: 3 });
export const MODEL = env.claudeModel;

/**
 * Fallback del lado del servidor ante rechazos de los clasificadores de seguridad:
 * la API reintenta en otro modelo dentro de la misma llamada.
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

export type Block = Anthropic.Beta.BetaContentBlock;
export type MessageParam = Anthropic.Beta.BetaMessageParam;

export function textOf(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
