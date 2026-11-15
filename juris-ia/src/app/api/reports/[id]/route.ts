import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { toDocx, toPdf } from "@/lib/export";
import { REPORT_KINDS, type ReportKind } from "@/lib/reports";
import { PERSPECTIVAS, type Perspectiva } from "@/lib/taxonomy";
import type { Cita } from "@/lib/citations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  const r = await one<{ case_id: string; kind: ReportKind; perspectiva: Perspectiva; markdown: string; citas: Cita[]; created_at: Date; caratula: string; numero: string | null }>(
    "SELECT r.*, c.caratula, c.numero FROM reports r JOIN cases c ON c.id = r.case_id WHERE r.id = $1",
    [id],
  );
  if (!r) return Response.json({ error: "Informe inexistente" }, { status: 404 });
  await requireCaseAccess(user, r.case_id);
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  if (format === "json") return Response.json(r);
  const input = {
    title: REPORT_KINDS[r.kind]?.label ?? r.kind,
    subtitle: `${r.caratula}${r.numero ? ` — Expte. ${r.numero}` : ""} · Perspectiva: ${PERSPECTIVAS[r.perspectiva] ?? r.perspectiva} · Generado: ${new Date(r.created_at).toLocaleString("es-AR")}`,
    markdown: r.markdown,
    citas: r.citas,
  };
  await audit(user, "exportar_informe", r.case_id, { reportId: id, format });
  const base = `${r.kind}-${(r.numero ?? r.case_id).replace(/[^\w-]+/g, "_")}`;
  if (format === "docx")
    return new Response(new Uint8Array(await toDocx(input)), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${base}.docx"` },
    });
  if (format === "pdf")
    return new Response(new Uint8Array(await toPdf(input)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` } });
  return Response.json({ error: "Formato inválido (pdf | docx | json)" }, { status: 400 });
});
