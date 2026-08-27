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
export const dynamic = "force-static";

export function GET(): Response {
  return markdownResponse(indexMd());
}
