import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, FALLBACK, MODEL } from "./claude";
import { TIPOS_DOCUMENTO } from "./taxonomy";

const tipos = Object.keys(TIPOS_DOCUMENTO).filter((t) => t !== "sin_clasificar") as [string, ...string[]];

export const ClasificacionSchema = z.object({
  tipo: z.enum(tipos),
  titulo: z.string().describe("Título descriptivo breve tal como surge del documento"),
  fecha: z
    .string()
    .nullable()
    .describe("Fecha del documento en formato AAAA-MM-DD si consta expresamente; null si no consta"),
  parte: z.string().nullable().describe("Parte o sujeto que presenta o dicta la pieza (actor, demandado, juzgado, perito...); null si no surge"),
  fojas: z.string().nullable().describe("Fojas o número de actuación si constan; null si no"),
  resumen: z.string().describe("Resumen de 2 a 4 oraciones, solo con lo que surge del texto"),
  partes_mencionadas: z
    .array(
      z.object({
        nombre: z.string(),
        rol: z.enum(["actor", "demandado", "tercero", "perito", "testigo", "letrado", "juez", "otro"]),
        identificador: z.string().nullable().describe("DNI/CUIT/CUIL solo si consta literalmente"),
      }),
    )
    .describe("Partes y sujetos procesales mencionados expresamente"),
  actuaciones: z
    .array(
      z.object({
        fecha: z.string().nullable().describe("AAAA-MM-DD si consta"),
        tipo: z.enum(tipos),
        parte: z.string().nullable(),
        descripcion: z.string(),
      }),
    )
    .describe("Actos procesales con fecha que el documento documenta o refiere (máx. 15)"),
  legible: z.boolean().describe("false si el texto está muy dañado o incompleto"),
});
export type Clasificacion = z.infer<typeof ClasificacionSchema>;

const MAX_CHARS = 60000;

export async function classifyDocument(filename: string, pages: { page: number; text: string }[]): Promise<Clasificacion | null> {
  let body = "";
  for (const p of pages) {
    const piece = `\n--- página/sección ${p.page} ---\n${p.text}`;
    if (body.length + piece.length > MAX_CHARS) {
      body += "\n[... texto restante omitido para la clasificación ...]";
      break;
    }
    body += piece;
  }
  const res = await claude.beta.messages.parse({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ClasificacionSchema) },
    system:
      "Sos un asistente de un estudio jurídico argentino que clasifica piezas de expedientes judiciales de la Provincia de Buenos Aires. " +
      "Extraés solo datos que consten literalmente en el texto. Nunca inventes fechas, nombres, montos ni identificadores: si algo no consta, devolvé null.",
    messages: [
      {
        role: "user",
        content: `Archivo: ${filename}\n\nTexto extraído:\n${body}\n\nClasificá la pieza procesal y extraé los datos pedidos.`,
      },
    ],
  });
  if (res.stop_reason === "refusal") return null;
  const out = res.parsed_output as Clasificacion | null;
  if (!out) return null;
  const okDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null);
  return {
    ...out,
    fecha: okDate(out.fecha),
    actuaciones: out.actuaciones.slice(0, 15).map((a) => ({ ...a, fecha: okDate(a.fecha) })),
  };
}
