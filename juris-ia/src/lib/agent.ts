import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { claude, FALLBACK, MODEL, type Block, type MessageParam } from "./claude";
import { readDocumentPages, searchChunks, toSearchResults } from "./retrieval";
import { query } from "./db";
import { env } from "./env";
import { TIPOS_DOCUMENTO } from "./taxonomy";

/** Dominios oficiales para la búsqueda de jurisprudencia y normativa. */
export const DOMINIOS_OFICIALES = [
  "juba.scba.gov.ar",
  "scba.gov.ar",
  "scba.gob.ar",
  "saij.gob.ar",
  "sj.csjn.gov.ar",
  "csjn.gov.ar",
  "infoleg.gob.ar",
  "argentina.gob.ar",
  "normas.gba.gob.ar",
];

const TIPOS = Object.keys(TIPOS_DOCUMENTO);

const BuscarInput = z.object({
  consulta: z.string().min(2),
  tipos: z.array(z.string()).optional(),
  document_ids: z.array(z.string()).optional(),
  limite: z.number().int().min(1).max(25).optional(),
});
const LeerInput = z.object({
  document_id: z.string(),
  desde: z.number().int().min(1),
  hasta: z.number().int().min(1),
});

export function caseTools(): Anthropic.Beta.BetaToolUnion[] {
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      name: "buscar_en_expediente",
      description:
        "Busca fragmentos textuales del expediente incorporado (búsqueda léxica y semántica). Devuelve fragmentos citables con documento, fecha y página. Usala varias veces con términos distintos (sinónimos, nombres, montos, artículos) para preguntas amplias.",
      input_schema: {
        type: "object",
        properties: {
          consulta: { type: "string", description: "Términos o frase a buscar, en español" },
          tipos: {
            type: "array",
            items: { type: "string", enum: TIPOS },
            description: "Opcional: limitar a tipos de pieza (p. ej. testimonial, pericia, sentencia_primera)",
          },
          document_ids: { type: "array", items: { type: "string" }, description: "Opcional: limitar a documentos del inventario" },
          limite: { type: "integer", description: "Cantidad de fragmentos (1-25, por defecto 12)" },
        },
        required: ["consulta"],
        additionalProperties: false,
      },
    },
    {
      name: "leer_documento",
      description:
        "Lee de forma completa y ordenada un rango de páginas/secciones de un documento del inventario (máximo 15 por llamada). Usala para leer íntegramente piezas centrales (demanda, contestación, sentencia, pericias, declaraciones).",
      input_schema: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          desde: { type: "integer", description: "Primera página/sección (1 = inicio)" },
          hasta: { type: "integer", description: "Última página/sección" },
        },
        required: ["document_id", "desde", "hasta"],
        additionalProperties: false,
      },
    },
    {
      name: "listar_actuaciones",
      description:
        "Devuelve la cronología de actuaciones registradas (fecha, tipo, parte, descripción y documento de origen). Es metadato para orientarte: para afirmar el contenido de una actuación, leé y citá el documento.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];
  if (env.webSearchEnabled) {
    tools.push({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 5,
      allowed_domains: DOMINIOS_OFICIALES,
    });
  }
  return tools;
}

async function runTool(caseId: string, name: string, input: unknown): Promise<Anthropic.Beta.BetaToolResultBlockParam["content"]> {
  if (name === "buscar_en_expediente") {
    const p = BuscarInput.parse(input);
    const hits = await searchChunks(caseId, p.consulta, {
      limit: p.limite ?? 12,
      tipos: p.tipos?.filter((t) => TIPOS.includes(t)),
      documentIds: p.document_ids?.filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
    });
    if (!hits.length) return [{ type: "text", text: `Sin resultados para "${p.consulta}" en la documentación incorporada.` }];
    return toSearchResults(hits);
  }
  if (name === "leer_documento") {
    const p = LeerInput.parse(input);
    if (!/^[0-9a-f-]{36}$/i.test(p.document_id)) return [{ type: "text", text: "document_id inválido" }];
    const hasta = Math.min(p.hasta, p.desde + 14);
    const hits = await readDocumentPages(caseId, p.document_id, p.desde, hasta);
    if (!hits.length) return [{ type: "text", text: "No hay texto disponible para ese documento/rango (puede no existir o carecer de texto legible)." }];
    const total = await query<{ max: number }>("SELECT max(page_number)::int AS max FROM document_pages WHERE document_id = $1", [p.document_id]);
    const note: Anthropic.Beta.BetaTextBlockParam = {
      type: "text",
      text: `Leídas páginas/secciones ${p.desde}-${hasta} de ${total[0]?.max ?? "?"}.${hasta < (total[0]?.max ?? 0) ? " Hay más páginas: volvé a llamar para continuar." : ""}`,
    };
    return [...toSearchResults(hits), note];
  }
  if (name === "listar_actuaciones") {
    const rows = await query<{ fecha: string | null; tipo: string; parte: string | null; descripcion: string; origen: string; filename: string | null }>(
      `SELECT a.fecha, a.tipo, a.parte, a.descripcion, a.origen, d.filename FROM actuaciones a
       LEFT JOIN documents d ON d.id = a.document_id WHERE a.case_id = $1 ORDER BY a.fecha NULLS LAST, a.created_at`,
      [caseId],
    );
    if (!rows.length) return [{ type: "text", text: "No hay actuaciones registradas." }];
    return [
      {
        type: "text",
        text: rows
          .map((r) => `${r.fecha ?? "s/f"} | ${r.tipo} | ${r.parte ?? "-"} | ${r.descripcion} | origen: ${r.origen}${r.filename ? ` (${r.filename})` : ""}`)
          .join("\n"),
      },
    ];
  }
  return [{ type: "text", text: `Herramienta desconocida: ${name}` }];
}

export type AgentEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "assistant"; content: Block[] }
  | { type: "tool_results"; content: Anthropic.Beta.BetaToolResultBlockParam[] };

/**
 * Bucle agéntico con streaming. `messages` es el historial completo; el bucle AGREGA (nunca
 * edita) los turnos del asistente y los resultados de herramientas, y emite cada uno para que
 * el llamador lo persista en el mismo orden.
 */
export async function runAgent(opts: {
  caseId: string;
  system: string;
  messages: MessageParam[];
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  maxRounds?: number;
  onEvent: (e: AgentEvent) => void | Promise<void>;
  signal?: AbortSignal;
}): Promise<{ final: Block[]; stop: string | null }> {
  const tools = caseTools();
  const messages = opts.messages;
  const maxRounds = opts.maxRounds ?? 10;
  for (let round = 0; round < maxRounds; round++) {
    const stream = claude.beta.messages.stream(
      {
        ...FALLBACK,
        betas: [...FALLBACK.betas, "thinking-binding-controls-2026-08-01"],
        model: MODEL,
        max_tokens: opts.maxTokens ?? 32000,
        thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
        output_config: { effort: opts.effort ?? "high" },
        cache_control: { type: "ephemeral" },
        system: opts.system,
        tools,
        messages,
      },
      { signal: opts.signal },
    );
    stream.on("text", (t) => void opts.onEvent({ type: "delta", text: t }));
    const msg = await stream.finalMessage();
    const content = msg.content as Block[];
    messages.push({ role: "assistant", content: content as Anthropic.Beta.BetaContentBlockParam[] });
    await opts.onEvent({ type: "assistant", content });

    if (msg.stop_reason === "refusal") return { final: content, stop: "refusal" };
    if (msg.stop_reason === "pause_turn") continue;
    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (msg.stop_reason !== "tool_use" || !toolUses.length) return { final: content, stop: msg.stop_reason };

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const label =
        tu.name === "buscar_en_expediente"
          ? `Buscando en el expediente: “${(tu.input as { consulta?: string }).consulta ?? ""}”`
          : tu.name === "leer_documento"
            ? "Leyendo documento…"
            : "Revisando la cronología…";
      await opts.onEvent({ type: "status", text: label });
      try {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: await runTool(opts.caseId, tu.name, tu.input) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Error: ${(e as Error).message}` });
      }
    }
    messages.push({ role: "user", content: results });
    await opts.onEvent({ type: "tool_results", content: results });
  }
  return { final: [], stop: "max_rounds" };
}
