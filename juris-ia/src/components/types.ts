export type Cita = {
  n: number;
  kind: "expediente" | "web";
  cited_text: string;
  chunk_id?: string;
  document_id?: string;
  filename?: string;
  titulo?: string | null;
  tipo?: string;
  fecha?: string | null;
  page?: number;
  unidad?: string;
  ocr?: boolean;
  verificada: boolean;
  url?: string;
  title?: string | null;
};
export type Doc = {
  id: string; filename: string; mime_type: string; tipo: string; titulo: string | null; fecha: string | null; parte: string | null;
  fojas: string | null; resumen: string | null; page_count: number; paginas_ocr: number; paginas_sin_texto: number;
  clasificacion_origen: string; status: string; status_detail: string | null; sha256: string; size_bytes: number; created_at: string;
};
export type Party = { id: string; nombre: string; rol: string; identificador: string | null; origen: string };
export type Causa = {
  id: string; caratula: string; numero: string | null; receptoria: string | null; departamento: string | null; organismo: string | null;
  fuero: string | null; objeto: string | null; estado_procesal: string | null; origen: string; reservada: boolean; notas: string | null;
};
