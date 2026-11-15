import "server-only";
import { query } from "./db";
import type { User } from "./auth";

export type CaseSearch = {
  q?: string; // nombre, apellido o razón social / carátula (coincidencia parcial)
  numero?: string;
  receptoria?: string;
  departamento?: string;
  organismo?: string;
  fuero?: string;
};

export type CaseHit = {
  id: string;
  caratula: string;
  numero: string | null;
  receptoria: string | null;
  departamento: string | null;
  organismo: string | null;
  fuero: string | null;
  estado_procesal: string | null;
  reservada: boolean;
  documentos: number;
  updated_at: string;
  coincidencias: { nombre: string; rol: string; identificador: string | null; score: number }[];
  score: number;
};

/**
 * Busca en la base local de causas incorporadas por el usuario (y las compartidas con él).
 * Coincidencias parciales e insensibles a tildes mediante trigramas.
 */
export async function searchCases(user: User, s: CaseSearch): Promise<CaseHit[]> {
  const params: unknown[] = [user.id];
  const where: string[] = ["(c.owner_id = $1 OR EXISTS (SELECT 1 FROM case_members m WHERE m.case_id = c.id AND m.user_id = $1))"];
  let scoreExpr = "0";
  if (s.q?.trim()) {
    params.push(s.q.trim());
    const i = params.length;
    where.push(`(f_unaccent(lower(c.caratula)) LIKE '%' || f_unaccent(lower($${i})) || '%'
      OR word_similarity(f_unaccent(lower($${i})), f_unaccent(lower(c.caratula))) > 0.45
      OR EXISTS (SELECT 1 FROM case_parties p WHERE p.case_id = c.id AND (
           f_unaccent(lower(p.nombre)) LIKE '%' || f_unaccent(lower($${i})) || '%'
           OR word_similarity(f_unaccent(lower($${i})), f_unaccent(lower(p.nombre))) > 0.45)))`);
    scoreExpr = `GREATEST(word_similarity(f_unaccent(lower($${i})), f_unaccent(lower(c.caratula))),
      COALESCE((SELECT max(word_similarity(f_unaccent(lower($${i})), f_unaccent(lower(p.nombre)))) FROM case_parties p WHERE p.case_id = c.id), 0))`;
  }
  const exact = (field: string, value?: string) => {
    if (!value?.trim()) return;
    params.push(value.trim());
    where.push(`f_unaccent(lower(coalesce(c.${field}, ''))) LIKE '%' || f_unaccent(lower($${params.length})) || '%'`);
  };
  exact("numero", s.numero);
  exact("receptoria", s.receptoria);
  exact("departamento", s.departamento);
  exact("organismo", s.organismo);
  exact("fuero", s.fuero);

  const rows = await query<Omit<CaseHit, "coincidencias">>(
    `SELECT c.id, c.caratula, c.numero, c.receptoria, c.departamento, c.organismo, c.fuero, c.estado_procesal, c.reservada,
       c.updated_at, (SELECT count(*)::int FROM documents d WHERE d.case_id = c.id) AS documentos, ${scoreExpr} AS score
     FROM cases c WHERE ${where.join(" AND ")} ORDER BY score DESC, c.updated_at DESC LIMIT 100`,
    params,
  );
  if (!rows.length) return [];
  const parties = s.q?.trim()
    ? await query<{ case_id: string; nombre: string; rol: string; identificador: string | null; score: number }>(
        `SELECT case_id, nombre, rol, identificador, word_similarity(f_unaccent(lower($2)), f_unaccent(lower(nombre))) AS score
         FROM case_parties WHERE case_id = ANY($1::uuid[])
           AND (f_unaccent(lower(nombre)) LIKE '%' || f_unaccent(lower($2)) || '%' OR word_similarity(f_unaccent(lower($2)), f_unaccent(lower(nombre))) > 0.45)`,
        [rows.map((r) => r.id), s.q.trim()],
      )
    : [];
  return rows.map((r) => ({ ...r, coincidencias: parties.filter((p) => p.case_id === r.id) }));
}

export type Homonimo = { nombre: string; causas: { id: string; caratula: string; rol: string; identificador: string | null }[]; motivo: string };

const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|y otro?s?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detecta posibles homónimos: el mismo nombre (normalizado) aparece en varias causas con
 * identificadores distintos, o sin identificador que permita confirmar que es la misma persona.
 */
export function detectHomonimos(hits: CaseHit[]): Homonimo[] {
  const groups = new Map<string, Homonimo>();
  for (const h of hits)
    for (const p of h.coincidencias) {
      const key = normName(p.nombre);
      const g = groups.get(key) ?? { nombre: p.nombre, causas: [], motivo: "" };
      if (!g.causas.some((c) => c.id === h.id)) g.causas.push({ id: h.id, caratula: h.caratula, rol: p.rol, identificador: p.identificador });
      groups.set(key, g);
    }
  const out: Homonimo[] = [];
  for (const g of groups.values()) {
    if (g.causas.length < 2) continue;
    const ids = new Set(g.causas.map((c) => c.identificador?.replace(/\D/g, "")).filter(Boolean));
    const sinId = g.causas.some((c) => !c.identificador);
    if (ids.size > 1) g.motivo = "Mismo nombre con identificadores (DNI/CUIT) distintos: son personas distintas.";
    else if (sinId) g.motivo = "Mismo nombre en varias causas sin identificador suficiente: verificar si es la misma persona.";
    else continue; // mismo identificador: es la misma persona
    out.push(g);
  }
  return out;
}

/** Causas relacionadas: comparten parte (con identificador o nombre) o número base (incidentes). */
export async function relatedCases(user: User, caseId: string) {
  return query<{ id: string; caratula: string; numero: string | null; motivo: string }>(
    `WITH me AS (SELECT * FROM cases WHERE id = $2),
     mine AS (SELECT * FROM case_parties WHERE case_id = $2 AND rol IN ('actor','demandado','tercero'))
     SELECT c.id, c.caratula, c.numero,
       CASE
         WHEN (SELECT numero FROM me) IS NOT NULL AND c.numero IS NOT NULL
              AND split_part(regexp_replace(c.numero, '\\s', '', 'g'), '/', 1) = split_part(regexp_replace((SELECT numero FROM me), '\\s', '', 'g'), '/', 1)
           THEN 'Mismo número base (posible incidente o expediente conexo)'
         WHEN EXISTS (SELECT 1 FROM case_parties p JOIN mine ON p.identificador IS NOT NULL AND p.identificador = mine.identificador WHERE p.case_id = c.id)
           THEN 'Comparte una parte con el mismo DNI/CUIT'
         ELSE 'Comparte una parte con el mismo nombre (verificar identidad)'
       END AS motivo
     FROM cases c
     WHERE c.id <> $2 AND (c.owner_id = $1 OR EXISTS (SELECT 1 FROM case_members m WHERE m.case_id = c.id AND m.user_id = $1))
       AND (
         ((SELECT numero FROM me) IS NOT NULL AND c.numero IS NOT NULL
           AND split_part(regexp_replace(c.numero, '\\s', '', 'g'), '/', 1) = split_part(regexp_replace((SELECT numero FROM me), '\\s', '', 'g'), '/', 1))
         OR EXISTS (SELECT 1 FROM case_parties p JOIN mine ON
             (p.identificador IS NOT NULL AND p.identificador = mine.identificador)
             OR f_unaccent(lower(p.nombre)) = f_unaccent(lower(mine.nombre))
           WHERE p.case_id = c.id))
     LIMIT 30`,
    [user.id, caseId],
  );
}

/** Estado de las fuentes en cada búsqueda: qué se consultó efectivamente y qué no. */
export function fuentesConsultadas(totalLocal: number) {
  return [
    {
      fuente: "Base local de JURIS IA (causas incorporadas por usted o compartidas con usted)",
      consultada: true,
      detalle: `${totalLocal} resultado(s).`,
    },
    {
      fuente: "MEV — Mesa de Entradas Virtual (SCBA)",
      consultada: false,
      detalle:
        "No consultada. La MEV requiere usuario y contraseña personales, y su ayuda indica que los usuarios están destinados a personas, no a sistemas informáticos ni agentes de IA. No existe una API pública documentada. Consulte la MEV personalmente e importe aquí la documentación o el listado de trámites.",
      url: "https://mev.scba.gov.ar/",
    },
    {
      fuente: "Otros organismos / fueros (Penal SIMP, Justicia Nacional/Federal - PJN, etc.)",
      consultada: false,
      detalle: "Sin integración. Requieren acceso propio del profesional; importe la documentación obtenida legítimamente.",
    },
  ];
}
