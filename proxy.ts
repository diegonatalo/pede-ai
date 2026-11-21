import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { signInPath } from "@/lib/auth/paths";

/**
 * Checagem otimista: sem o cookie de sessão, a conta manda direto para entrar,
 * sem renderizar nada. A sessão de verdade é conferida pela API (`/api/account/...`)
 * e pela tela da conta, que volta para entrar se o cookie não valer mais.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(signInPath(pathname + search), request.url));
}

export const config = {
  matcher: ["/conta", "/conta/:path*"],
};
