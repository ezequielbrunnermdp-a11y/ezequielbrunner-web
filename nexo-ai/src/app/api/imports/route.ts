import { NextResponse, type NextRequest } from "next/server";
import { requireCtx } from "@/lib/auth/session";
import { importChat } from "@/lib/imports/service";
import { errorMessage } from "@/lib/action";
import { MAX_UPLOAD_BYTES } from "@/lib/whatsapp/archive";
import type { DateOrder } from "@/lib/whatsapp/parser";

export const runtime = "nodejs";

/** Subida de chats (.txt / .zip). Verifica origen, sesión, membresía y permiso antes de leer el archivo. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  try {
    const ctx = await requireCtx("imports.create");
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 1024 * 64) return NextResponse.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 413 });
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    const s = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const order = s("date_order");
    const summary = await importChat(ctx, {
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      conversationId: s("conversation_id"),
      title: s("title"),
      branchId: s("branch_id"),
      dateOrder: order === "DMY" || order === "MDY" || order === "YMD" ? (order as DateOrder) : "auto",
    });
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }
}
