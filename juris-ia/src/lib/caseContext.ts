import { one, query } from "./db";
import { PIEZAS_ESPERADAS, TIPOS_DOCUMENTO, tipoLabel } from "./taxonomy";

export type CaseRow = {
  id: string;
  caratula: string;
  numero: string | null;
  receptoria: string | null;
  departamento: string | null;
  organismo: string | null;
  fuero: string | null;
  objeto: string | null;
  estado_procesal: string | null;
  origen: string;
  reservada: boolean;
};

export type DocRow = {
  id: string;
  filename: string;
  mime_type: string;
  tipo: string;
  titulo: string | null;
  fecha: string | null;
  parte: string | null;
  fojas: string | null;
  resumen: string | null;
  page_count: number;
  paginas_ocr: number;
  paginas_sin_texto: number;
  clasificacion_origen: string;
  status: string;
  status_detail: string | null;
  sha256: string;
  size_bytes: number;
  created_at: string;
};

export async function getCase(caseId: string) {
  return one<CaseRow>("SELECT * FROM cases WHERE id = $1", [caseId]);
}

export async function listDocuments(caseId: string) {
  return query<DocRow>(
    `SELECT d.id, d.filename, d.mime_type, d.tipo, d.titulo, d.fecha, d.parte, d.fojas, d.resumen, d.page_count,
       d.clasificacion_origen, d.status, d.status_detail, d.sha256, d.size_bytes, d.created_at,
       (SELECT count(*)::int FROM document_pages p WHERE p.document_id = d.id AND p.text_source = 'ocr_ia') AS paginas_ocr,
       (SELECT count(*)::int FROM document_pages p WHERE p.document_id = d.id AND p.text_source = 'sin_texto') AS paginas_sin_texto
     FROM documents d WHERE d.case_id = $1 ORDER BY d.fecha NULLS LAST, d.created_at`,
    [caseId],
  );
}

/** Piezas procesales típicas que no figuran entre los documentos incorporados. */
export function piezasFaltantes(docs: Pick<DocRow, "tipo">[]): string[] {
  const tipos = new Set(docs.map((d) => d.tipo));
  return PIEZAS_ESPERADAS.filter((t) => !tipos.has(t)).map((t) => TIPOS_DOCUMENTO[t]);
}

/** Inventario textual de la causa que se le entrega a Claude en cada turno (si cambió). */
export async function caseInventory(caseId: string): Promise<string> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Causa inexistente");
  const docs = await listDocuments(caseId);
  const parties = await query<{ nombre: string; rol: string; identificador: string | null; origen: string }>(
    "SELECT nombre, rol, identificador, origen FROM case_parties WHERE case_id = $1 ORDER BY rol, nombre",
    [caseId],
  );
  const lines: string[] = [];
  lines.push("INVENTARIO ACTUAL DEL EXPEDIENTE INCORPORADO (metadatos; para contenido usá las herramientas y citá los fragmentos)");
  lines.push(`Carátula: ${c.caratula}`);
  lines.push(
    `Número: ${c.numero ?? "no informado"} | Receptoría: ${c.receptoria ?? "no informada"} | Departamento: ${c.departamento ?? "no informado"} | Organismo: ${c.organismo ?? "no informado"} | Fuero: ${c.fuero ?? "no informado"}`,
  );
  if (c.objeto) lines.push(`Objeto (según carga del usuario): ${c.objeto}`);
  if (c.estado_procesal) lines.push(`Estado procesal (según carga del usuario): ${c.estado_procesal}`);
  if (parties.length) {
    lines.push("Partes y sujetos registrados:");
    for (const p of parties)
      lines.push(`- ${p.nombre} (${p.rol}${p.identificador ? `, ${p.identificador}` : ""}${p.origen === "extraido_ia" ? ", extraído por IA, sin verificar" : ""})`);
  }
  lines.push(`Documentos incorporados (${docs.length}):`);
  for (const d of docs) {
    const flags = [
      d.paginas_ocr ? `${d.paginas_ocr} pág. OCR-IA` : "",
      d.paginas_sin_texto ? `${d.paginas_sin_texto} pág. SIN TEXTO (contenido no disponible)` : "",
      d.clasificacion_origen === "ia" ? "clasificación automática" : "",
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `- id=${d.id} | ${tipoLabel(d.tipo)} | ${d.titulo || d.filename} | fecha: ${d.fecha ?? "sin fecha"} | ${d.page_count} ${
        d.mime_type === "application/pdf" ? "páginas" : "secciones"
      }${flags ? ` | ${flags}` : ""}${d.resumen ? `\n  Resumen automático (orientativo, no citable): ${d.resumen}` : ""}`,
    );
  }
  const faltan = piezasFaltantes(docs);
  if (faltan.length) lines.push(`Piezas habituales NO incorporadas (pueden existir en el expediente real): ${faltan.join("; ")}.`);
  lines.push("Advertencia: el expediente incorporado puede no estar completo. No presumas que contiene todas las actuaciones.");
  return lines.join("\n");
}
