import { z } from "zod";
import { audit, handle, requireUser } from "@/lib/auth";
import { one, tx } from "@/lib/db";
import { detectHomonimos, fuentesConsultadas, searchCases } from "@/lib/search";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const u = new URL(req.url);
  const s = {
    q: u.searchParams.get("q") ?? undefined,
    numero: u.searchParams.get("numero") ?? undefined,
    receptoria: u.searchParams.get("receptoria") ?? undefined,
    departamento: u.searchParams.get("departamento") ?? undefined,
    organismo: u.searchParams.get("organismo") ?? undefined,
    fuero: u.searchParams.get("fuero") ?? undefined,
  };
  const hits = await searchCases(user, s);
  await audit(user, "buscar_causas", null, s);
  return Response.json({ resultados: hits, homonimos: detectHomonimos(hits), fuentes: fuentesConsultadas(hits.length) });
});

const CreateCase = z.object({
  caratula: z.string().min(3),
  numero: z.string().optional(),
  receptoria: z.string().optional(),
  departamento: z.string().optional(),
  organismo: z.string().optional(),
  fuero: z.string().optional(),
  objeto: z.string().optional(),
  estado_procesal: z.string().optional(),
  origen: z.string().default("importacion_manual"),
  reservada: z.boolean().default(false),
  autorizacion_acceso: z.string().optional(),
  partes: z
    .array(z.object({ nombre: z.string().min(2), rol: z.string().default("otro"), identificador: z.string().optional() }))
    .default([]),
  declaracion_licitud: z.literal(true, { message: "Debe declarar que obtuvo la documentación legítimamente" }),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = CreateCase.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const d = parsed.data;
  if (d.reservada && !d.autorizacion_acceso?.trim())
    return Response.json({ error: "Las causas reservadas requieren indicar la autorización de acceso (p. ej. carácter de parte o letrado autorizado)." }, { status: 400 });
  const blank = (s?: string) => (s?.trim() ? s.trim() : null);
  const id = await tx(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO cases (owner_id, caratula, numero, receptoria, departamento, organismo, fuero, objeto, estado_procesal, origen, reservada, autorizacion_acceso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [user.id, d.caratula.trim(), blank(d.numero), blank(d.receptoria), blank(d.departamento), blank(d.organismo), blank(d.fuero), blank(d.objeto), blank(d.estado_procesal), d.origen, d.reservada, blank(d.autorizacion_acceso)],
    );
    for (const p of d.partes)
      await c.query("INSERT INTO case_parties (case_id, nombre, rol, identificador) VALUES ($1,$2,$3,$4)", [rows[0].id, p.nombre.trim(), p.rol, blank(p.identificador)]);
    return rows[0].id;
  });
  await audit(user, "crear_causa", id, { caratula: d.caratula, origen: d.origen, reservada: d.reservada });
  return Response.json(await one("SELECT * FROM cases WHERE id = $1", [id]), { status: 201 });
});
