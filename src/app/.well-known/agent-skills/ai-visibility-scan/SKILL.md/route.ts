import { skillMarkdown } from "@/lib/agent-manifests";
import { markdownResponse } from "@/lib/agent-response";

/** The skill body the index points at, and the body its digest is taken over. */
export const dynamic = "force-static";

export function GET(): Response {
  return markdownResponse(skillMarkdown());
}
