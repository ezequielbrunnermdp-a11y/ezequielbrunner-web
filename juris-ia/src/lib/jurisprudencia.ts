import type Anthropic from "@anthropic-ai/sdk";
import { claude, FALLBACK, MODEL, type Block } from "./claude";
import { env } from "./env";
import { DOMINIOS_OFICIALES } from "./agent";
import { renderWithCitations, type Cita } from "./citations";

/**
 * Fuentes oficiales. Ninguna publica una API documentada para consultas automatizadas
 * (ver docs/INVESTIGACION-INTEGRACIONES.md), por eso se ofrecen enlaces para búsqueda manual
 * y, si está habilitada, una búsqueda web de Claude restringida a estos dominios.
 */
export const FUENTES_JURISPRUDENCIA = [
  { nombre: "JUBA — SCBA (jurisprudencia de la Provincia de Buenos Aires)", url: "https://juba.scba.gov.ar/" },
  { nombre: "SAIJ — Sistema Argentino de Información Jurídica", url: "https://www.saij.gob.ar/" },
  { nombre: "CSJN — Secretaría de Jurisprudencia", url: "https://sj.csjn.gov.ar/" },
  { nombre: "InfoLEG — normativa nacional", url: "https://www.infoleg.gob.ar/" },
  { nombre: "Normas GBA — normativa bonaerense", url: "https://normas.gba.gob.ar/" },
];

export type JurisQuery = { hechos: string; materia?: string; tribunal?: string; normativa?: string; argumentos?: string };

export function buildQueryText(q: JurisQuery): string {
  return [q.materia, q.tribunal, q.normativa, q.hechos, q.argumentos].filter(Boolean).join(" · ");
}

export async function buscarJurisprudencia(q: JurisQuery): Promise<
  { disponible: false; motivo: string; fuentes: typeof FUENTES_JURISPRUDENCIA; consulta: string } | {
    disponible: true;
    markdown: string;
    citas: Cita[];
    fuentes: typeof FUENTES_JURISPRUDENCIA;
    consulta: string;
  }
> {
  const consulta = buildQueryText(q);
  if (!env.webSearchEnabled) {
    return {
      disponible: false,
      motivo:
        "La búsqueda automática está deshabilitada (JURISPRUDENCIA_WEB_SEARCH=false). Use los enlaces oficiales para buscar manualmente con la consulta sugerida.",
      fuentes: FUENTES_JURISPRUDENCIA,
      consulta,
    };
  }
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: DOMINIOS_OFICIALES },
  ];
  const res = await claude.beta.messages
    .stream({
      ...FALLBACK,
      model: MODEL,
      max_tokens: 32000,
      output_config: { effort: "high" },
      tools,
      system:
        "Sos un investigador de jurisprudencia argentina. Solo informás precedentes que encontrás con la herramienta web_search en fuentes oficiales, citando la página consultada. " +
        "Para cada precedente indicá tribunal, carátula, fecha y número si constan en la fuente, y el criterio relevante. Nunca completes datos que no figuren en la fuente. " +
        "Si no encontrás precedentes pertinentes, decilo. Aclarás que cada antecedente debe verificarse en la fuente oficial antes de citarlo en un escrito.",
      messages: [
        {
          role: "user",
          content: `Buscá antecedentes jurisprudenciales para:\n- Hechos relevantes: ${q.hechos}\n- Materia: ${q.materia ?? "-"}\n- Tribunal preferido: ${q.tribunal ?? "-"}\n- Normativa: ${q.normativa ?? "-"}\n- Argumentos: ${q.argumentos ?? "-"}`,
        },
      ],
    })
    .finalMessage();
  const { markdown, citas } = await renderWithCitations(res.content as Block[]);
  return { disponible: true, markdown, citas, fuentes: FUENTES_JURISPRUDENCIA, consulta };
}
