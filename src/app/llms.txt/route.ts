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
export const dynamic = "force-static";

export function GET(): Response {
  return markdownResponse(llmsTxt(), "text/plain; charset=utf-8");
}
