import { NextResponse, type NextRequest } from "next/server";

import { CHILD_SESSION_COOKIE } from "@/lib/auth/child-session";

/**
 * Edge-side route gate (Next.js 16 "proxy", formerly middleware).
 *
 * This is an OPTIMISTIC check based on cookie presence only: it gives fast
 * redirects for obviously unauthenticated requests. Real authorization is
 * always enforced server-side in layouts, server actions and route handlers
 * (see src/server/policies). Never rely on this file alone.
 */
const PARENT_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/parent")) {
    const hasParentCookie = PARENT_COOKIE_NAMES.some((name) => request.cookies.has(name));
    if (!hasParentCookie) {
      const url = new URL("/sign-in", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/child") && pathname !== "/child/sign-in") {
    if (!request.cookies.has(CHILD_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/child/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/parent/:path*", "/child/:path*"],
};
