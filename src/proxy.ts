import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";

/**
 * A cheap cookie-presence check that bounces signed-out visitors before a page renders.
 * This is NOT the authorization boundary — proxy can't reach the database, so the cookie
 * is unvalidated here. Every page and action still calls the guards in src/lib/guards.ts.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except the auth screens, Next internals and static files.
  matcher: [
    "/dashboard/:path*",
    "/students/:path*",
    "/calendar/:path*",
    "/admin/:path*",
    "/onboarding",
  ],
};
