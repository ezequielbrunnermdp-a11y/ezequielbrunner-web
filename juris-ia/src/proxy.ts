import { NextResponse, type NextRequest } from "next/server";

/** Redirige al login si no hay cookie de sesión (la validación real ocurre en el servidor). */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("juris_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!login|api|_next|favicon.ico).*)"] };
