import { pricingMd } from "@/lib/agent-docs";
import { markdownResponse } from "@/lib/agent-response";

/** /pricing.md — the markdown twin of /pricing. */
export const dynamic = "force-static";

export function GET(): Response {
  return markdownResponse(pricingMd());
}
