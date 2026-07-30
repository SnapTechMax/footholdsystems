import { NextRequest, NextResponse } from "next/server";

/**
 * Gate on the CRO dashboard.
 *
 * It exposes funnel numbers and can change how the live site behaves, so it
 * must not be reachable by anyone who finds the URL. HTTP Basic is enough here:
 * it's one operator, over HTTPS, and it avoids a login page and session store.
 *
 * With ADMIN_PASSWORD unset the dashboard is closed entirely rather than open —
 * failing shut is the only safe default for something that edits the live site.
 */
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return new NextResponse(
      "The CRO dashboard is disabled because ADMIN_PASSWORD is not set.",
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (timingSafeEqual(supplied, password)) {
        return NextResponse.next();
      }
    } catch {
      // Malformed header — fall through to the challenge.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Foothold CRO", charset="UTF-8"',
    },
  });
}

/** Constant-time comparison so the response time can't be used to guess. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const config = {
  matcher: ["/admin/:path*"],
};
