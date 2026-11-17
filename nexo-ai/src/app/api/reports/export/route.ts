import { NextResponse, type NextRequest } from "next/server";
import { requireCtx } from "@/lib/auth/session";
import { buildReport, type Period } from "@/lib/reports/service";
import { reportToPdf, reportToXlsx } from "@/lib/reports/export";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/auth/accounts";
import { errorMessage } from "@/lib/action";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireCtx("reports.read");
    const sp = req.nextUrl.searchParams;
    const period = (["day", "week", "month"].includes(sp.get("period") ?? "") ? sp.get("period") : "week") as Period;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") ?? "") ? sp.get("date")! : new Date().toISOString().slice(0, 10);
    const format = sp.get("format") === "xlsx" ? "xlsx" : "pdf";
    const report = await buildReport(ctx, period, date);
    await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "report.export", metadata: { period, date, format } });
    const name = `nexo-${slugify(report.company)}-${period}-${report.from}.${format}`;
    const body = format === "xlsx" ? await reportToXlsx(report) : Buffer.from(await reportToPdf(report));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 403 });
  }
}
