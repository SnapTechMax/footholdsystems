import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";

/**
 * Gate on the CRO dashboard.
 *
 * It exposes funnel numbers and can change how the live site behaves, so it
 * must not be reachable by anyone who finds the URL. HTTP Basic is enough here:
 * it's one operator, over HTTPS, and it avoids a login page and session store.
 *
 * With ADMIN_PASSWORD unset the dashboard is closed entirely rather than open —
 * failing shut is the only safe default for something that edits the live site.
 *
 * This guards *pages*. It is not what protects the Server Actions behind them:
 * an action is dispatched by id and need not arrive as a request to the route
 * it belongs to, so each one checks the password itself. See lib/admin-auth.ts.
 */
export function proxy(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return new NextResponse(
      "The CRO dashboard is disabled because ADMIN_PASSWORD is not set.",
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }

  if (isAdminAuthorised(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Foothold CRO", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
