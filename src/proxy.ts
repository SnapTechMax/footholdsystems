import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";

/**
 * Two jobs, and they do not overlap: the admin gate, and markdown negotiation.
 *
 * They live in one file because Next allows exactly one proxy. The matcher at
 * the bottom lists all three paths and each branch below owns its own, so
 * adding a path to one job cannot silently change the other.
 */

/* ── the admin gate ───────────────────────────────────────────────────────── */

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
function guardAdmin(request: NextRequest): NextResponse {
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

/* ── markdown negotiation ─────────────────────────────────────────────────── */

/**
 * Markdown content negotiation for the homepage and the pricing page.
 *
 * Two checks from the 2026-08-27 agent-readiness scan, and one of them names
 * the real problem: "Cold-arrival agents that land on the homepage from web
 * search cannot get a markdown representation". That is the case this exists
 * for — an agent that arrived at `/` from a search result, without having read
 * llms.txt first and with no reason to guess that /index.md exists. It asks for
 * markdown in the only way it can, in the Accept header, and until now got a
 * sales page back.
 *
 *   markdown-negotiation       Accept: text/markdown returned text/html
 *   markdown-negotiation-vary  Vary did not list Accept
 *
 * `?mode=agent` is handled here too, for the agents that ask that way instead.
 *
 * WHAT THIS DOES NOT DO: it does not sniff user agents. Serving markdown to
 * GPTBot and ClaudeBot because of their name is a separate, tempting, and much
 * worse idea — it would mean the crawlers that matter most to this business
 * stop seeing the homepage's JSON-LD, which is the thing we just spent a schema
 * module publishing for them. Negotiation is opt-in by the client and costs
 * nothing when nobody opts in.
 */

/** Pages that have a markdown twin, and the twin. */
const MARKDOWN_TWINS: Record<string, string> = {
  "/": "/index.md",
  "/pricing": "/pricing.md",
};

/** Next's own headers on a soft navigation. Present means "not a fresh arrival". */
const RSC_HEADERS = ["rsc", "next-router-prefetch", "next-router-state-tree"];

/**
 * True when the client asked for markdown and did not also accept HTML.
 *
 * The second half matters more than the first. A browser sends
 * `text/html,application/xhtml+xml,...,*\/*` — the wildcard technically accepts
 * markdown, and matching loosely enough to catch it would serve markdown to
 * every visitor on the site. So: markdown must be named explicitly, and HTML
 * must not be.
 */
function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const lower = accept.toLowerCase();
  if (!lower.includes("text/markdown")) return false;
  return !lower.includes("text/html");
}

/* ── entry point ──────────────────────────────────────────────────────────── */

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // First, and separately. An auth gate that could be reached through another
  // branch's fall-through is not an auth gate.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return guardAdmin(request);
  }

  const markdownTwin = MARKDOWN_TWINS[pathname];

  // A soft navigation inside the app, not an arrival. Rewriting one would hand
  // React a markdown document where it expected a flight response.
  const isRsc = RSC_HEADERS.some((header) => request.headers.has(header));

  if (
    markdownTwin &&
    !isRsc &&
    (wantsMarkdown(request.headers.get("accept")) ||
      searchParams.get("mode") === "agent")
  ) {
    const response = NextResponse.rewrite(new URL(markdownTwin, request.url));
    // Without this a CDN can serve one variant to the audience that asked for
    // the other, depending only on which landed in the cache first.
    response.headers.set("Vary", "Accept");
    return response;
  }

  /*
   * Not negotiated, so nothing to do.
   *
   * There is deliberately no `Vary: Accept` added here. It belongs on this
   * response by the letter of HTTP — a shared cache storing this HTML should
   * know Accept was part of the key — but Next owns the Vary header on any
   * RSC-capable route and replaces it with its own rsc/Accept-Encoding value
   * after the proxy returns. Both `set` and `append` here, and a Vary entry in
   * next.config.ts, were tried; all three are silently discarded.
   *
   * It costs the negotiation nothing: the markdown responses are the ones the
   * acceptmarkdown.com spec asks to carry it, they are served by
   * markdownResponse() in lib/agent-response.ts, and they do.
   */
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/", "/pricing"],
};
