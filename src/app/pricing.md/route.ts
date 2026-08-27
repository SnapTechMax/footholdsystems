import { pricingMd } from "@/lib/agent-docs";
import { markdownResponse } from "@/lib/agent-response";

/** /pricing.md — the markdown twin of /pricing. */
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
  return markdownResponse(pricingMd());
}
