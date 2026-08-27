import { llmsTxt } from "@/lib/agent-docs";
import { markdownResponse } from "@/lib/agent-response";

/**
 * /llms.txt
 *
 * A route rather than a file in public/ so the prices inside it come from
 * lib/scan/pricing.ts. See lib/agent-docs.ts for why that matters.
 *
 * text/plain, not text/markdown: llms.txt is specified as plain text, and Ora's
 * check wants "your text, not HTML" — which is the failure mode this is really
 * guarding against, since a single-page app that returns its shell for every
 * unknown URL passes a naive existence test and fails a content one.
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
  return markdownResponse(llmsTxt(), "text/plain; charset=utf-8");
}
