import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtro rápido: sin cookie de sesión, las rutas privadas van al login.
 * La validación real de la sesión, la membresía y los permisos ocurre en el servidor
 * en cada página, acción y endpoint (requireUser / requireCtx).
 */
const PUBLIC = ["/login", "/setup"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("nexo_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
