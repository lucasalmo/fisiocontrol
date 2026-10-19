import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authMode, verifySessionToken } from "@/lib/auth/token";

/**
 * Optimistic redirect to /login for unauthenticated visitors. The real
 * authorization check happens on the server in requireAuth().
 */
export async function proxy(request: NextRequest) {
  const mode = authMode();
  if (mode.mode === "disabled-dev") return NextResponse.next();
  const valid =
    mode.mode === "enabled" && (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, mode.secret));
  if (valid) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
