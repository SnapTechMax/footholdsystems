import { indexMd } from "@/lib/agent-docs";
import { markdownResponse } from "@/lib/agent-response";

/**
 * /index.md — the homepage as markdown.
 *
 * Advertised three ways, because agents look in three different places: as
 * `<link rel="alternate" type="text/markdown">` in the homepage head, as an
 * RFC 8288 Link header (next.config.ts), and as the target the proxy rewrites
 * to when a request asks for markdown by Accept header or `?mode=agent`.
 */
/*
 * Dynamic, not prerendered, and only because of one header.
 *
 * `Vary: Accept` is set on the response in lib/agent-response.ts and again in
 * next.config.ts, and deployed it was stripped from both: these routes were
 * prerendered, and Vercel served them from an edge cache entry carrying Next's
 * own rsc Vary and nothing else. Rendering per request is the one lever left.
 *
 * The cost is a function invocation per fetch, which is nothing — these are
 * three small documents fetched by crawlers, not a hot path. s-maxage on the
 * response still lets the CDN hold them.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return markdownResponse(indexMd());
}
