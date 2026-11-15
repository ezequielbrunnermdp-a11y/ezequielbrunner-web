import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { one } from "./db";
import { runAgent, type AgentEvent } from "./agent";
import { SYSTEM_PROMPT, perspectivaInstruction } from "./prompts";
import { caseInventory } from "./caseContext";
import { allChunks, toSearchResults } from "./retrieval";
import { renderWithCitations, type Cita } from "./citations";
import type { Block, MessageParam } from "./claude";
import type { Perspectiva } from "./taxonomy";

/** Por encima de este volumen el expediente no se envía completo: Claude lee con herramientas. */
const FULL_CONTEXT_MAX_CHARS = 1_400_000;

export const REPORT_KINDS = {
  analisis_integral: {
    label: "ANALIZAR EXPEDIENTE — Informe jurídico integral",
    instructions: `Elaborá un INFORME JURÍDICO INTEGRAL con esta estructura exacta (títulos Markdown):

## A. Identificación de la causa
Partes, juzgado/organismo, fuero, número, objeto, estado procesal. Indicá qué datos surgen de documentos (con cita) y cuáles solo de la carga del usuario.

## B. Historia procesal
Fecha de inicio, principales presentaciones, prueba producida, resoluciones, recursos y últimos movimientos, en orden cronológico.

## C. Análisis probatorio
Pruebas ofrecidas y producidas por cada parte; hechos controvertidos; contradicciones (entre testigos, entre pericias, entre escritos y prueba); debilidades probatorias; hechos pendientes de acreditación.

## D. Análisis jurídico
Normativa argentina aplicable (verificar vigencia); precedentes: solo si constan con fuente verificable en esta conversación, si no indicá qué buscar en JUBA/SAIJ; argumentos del actor; defensas del demandado; fortalezas y debilidades de ambas posiciones; problemas jurídicos no resueltos.

## E. Escenarios procesales
Escenario favorable al actor; escenario favorable al demandado; riesgos jurídicos identificados; posibles actuaciones procesales según la etapa (con la salvedad de verificar plazos y normas vigentes). Expresá la incertidumbre en términos cualitativos; no asignes probabilidades numéricas.

## F. Limitaciones del análisis
Documentación faltante o ilegible, páginas OCR, y qué conclusiones podrían cambiar si se incorpora más documentación.`,
  },
  resumen_ejecutivo: {
    label: "Resumen ejecutivo",
    instructions:
      "Elaborá un RESUMEN EJECUTIVO (máx. 1 página): partes, objeto y monto reclamado si consta, estado procesal, cuestiones centrales, prueba clave, últimas actuaciones y próximos pasos posibles. Con citas.",
  },
  cronologia: {
    label: "Cronología procesal",
    instructions:
      "Elaborá una CRONOLOGÍA PROCESAL completa en forma de tabla Markdown (Fecha | Actuación | Parte | Contenido relevante), solo con actuaciones que surjan de la documentación, con cita en cada fila. Señalá huecos temporales o actuaciones referidas pero no incorporadas.",
  },
  analisis_pruebas: {
    label: "Análisis de pruebas",
    instructions:
      "Elaborá un ANÁLISIS DE LA PRUEBA: para cada medio probatorio (documental, testimonial, pericial, informativa, confesional), qué se ofreció, qué se produjo, qué acredita y qué no, impugnaciones, contradicciones entre testigos o con otras pruebas, y hechos pendientes de acreditación. Distinguí claramente hecho alegado y hecho acreditado.",
  },
  demanda_vs_contestacion: {
    label: "Comparación demanda / contestación",
    instructions:
      "Compará DEMANDA y CONTESTACIÓN punto por punto, en una tabla (Hecho o pretensión de la actora | Respuesta de la demandada | ¿Negado, reconocido o no contestado? | Prueba relacionada). Identificá los argumentos de la demanda que no fueron contestados específicamente y las defensas introducidas por la demandada. Si falta alguna de las dos piezas, decilo y no completes con suposiciones.",
  },
  informe_sentencia: {
    label: "Informe de sentencia",
    instructions:
      "Elaborá un INFORME DE SENTENCIA: qué se resolvió (parte dispositiva), fundamentos de hecho y de derecho, valoración de la prueba, rubros y montos admitidos o rechazados, costas, y puntos débiles o discutibles de la fundamentación. Si no hay sentencia incorporada, indicalo y no la reconstruyas.",
  },
  posibles_agravios: {
    label: "Informe de posibles agravios",
    instructions:
      "Elaborá un INFORME DE POSIBLES AGRAVIOS contra la sentencia o resolución incorporada: para cada agravio posible, el error que se atribuiría (valoración de prueba, aplicación del derecho, incongruencia, arbitrariedad, cuantificación, costas), el pasaje de la resolución que lo motiva (con cita), la prueba o argumento que lo sostiene, y las objeciones previsibles. Es un análisis hipotético; verificá plazos y requisitos recursivos vigentes del CPCCBA.",
  },
  seguimiento: {
    label: "Reporte de seguimiento",
    instructions:
      "Elaborá un REPORTE DE SEGUIMIENTO: estado actual, últimos movimientos registrados, actuaciones pendientes o plazos que podrían estar corriendo (con la advertencia de verificarlos en la MEV y en el CPCCBA), y documentación que convendría incorporar.",
  },
  estrategia: {
    label: "Estrategia procesal",
    instructions:
      "Elaborá un ANÁLISIS DE ESTRATEGIA PROCESAL desde la perspectiva activa: argumentos posibles, prueba que los sostiene, fortalezas, debilidades, objeciones jurídicas previsibles de la contraparte y cuestiones pendientes. Rotulá todo como estrategia hipotética, nunca como conclusión judicial.",
  },
} as const;
export type ReportKind = keyof typeof REPORT_KINDS;

export async function generateReport(opts: {
  caseId: string;
  userId: string;
  kind: ReportKind;
  perspectiva: Perspectiva;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<{ id: string; markdown: string; citas: Cita[]; modo: string }> {
  const spec = REPORT_KINDS[opts.kind];
  const inventory = await caseInventory(opts.caseId);
  const chunks = await allChunks(opts.caseId);
  const totalChars = chunks.reduce((n, c) => n + c.text.length, 0);
  const full = totalChars > 0 && totalChars <= FULL_CONTEXT_MAX_CHARS;

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (full) content.push(...toSearchResults(chunks));
  content.push({
    type: "text",
    text: `${inventory}\n\n${
      full
        ? "Arriba tenés el TEXTO COMPLETO DISPONIBLE del expediente incorporado, fragmentado por documento y página. Leelo íntegramente."
        : chunks.length
          ? "El expediente es extenso: usá leer_documento para leer íntegramente las piezas centrales y buscar_en_expediente para el resto antes de redactar."
          : "No hay texto disponible en los documentos incorporados. Informá esa limitación y no elabores conclusiones sobre el contenido."
    }\n\n${perspectivaInstruction(opts.perspectiva)}\n\n${spec.instructions}\n\nToda afirmación fáctica debe llevar cita al fragmento correspondiente.`,
  });
  const messages: MessageParam[] = [{ role: "user", content }];

  const finals: Block[] = [];
  await runAgent({
    caseId: opts.caseId,
    system: SYSTEM_PROMPT,
    messages,
    effort: "high",
    maxTokens: 64000,
    maxRounds: full ? 4 : 14,
    signal: opts.signal,
    onEvent: (e) => {
      if (e.type === "assistant") finals.push(...e.content);
      opts.onEvent(e);
    },
  });
  const { markdown, citas } = await renderWithCitations(finals);
  const row = await one<{ id: string }>(
    `INSERT INTO reports (case_id, user_id, kind, perspectiva, markdown, citas, meta) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      opts.caseId,
      opts.userId,
      opts.kind,
      opts.perspectiva,
      markdown,
      JSON.stringify(citas),
      JSON.stringify({ modo: full ? "texto_completo" : "lectura_con_herramientas", caracteres: totalChars, fragmentos: chunks.length }),
    ],
  );
  return { id: row!.id, markdown, citas, modo: full ? "texto_completo" : "lectura_con_herramientas" };
}
