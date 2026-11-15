import { audit, handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { readOriginal } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Entrega el archivo ORIGINAL descifrado, tras verificar su hash SHA-256. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  const doc = await one<{ case_id: string; storage_key: string; sha256: string; filename: string; mime_type: string }>(
    "SELECT case_id, storage_key, sha256, filename, mime_type FROM documents WHERE id = $1",
    [id],
  );
  if (!doc) return Response.json({ error: "Documento inexistente" }, { status: 404 });
  await requireCaseAccess(user, doc.case_id);
  const buf = await readOriginal(doc.storage_key, doc.sha256);
  await audit(user, "abrir_original", doc.case_id, { documentId: id });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-SHA256": doc.sha256,
      "Cache-Control": "private, no-store",
      // Un HTML importado se muestra como texto plano para no ejecutar su contenido.
      ...(doc.mime_type === "text/html" ? { "Content-Type": "text/plain; charset=utf-8" } : {}),
    },
  });
});
