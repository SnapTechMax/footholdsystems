import { agentCard } from "@/lib/agent-manifests";
import { jsonManifestResponse } from "@/lib/agent-response";

/** /.well-known/agent-card.json — A2A capability card. */
export const dynamic = "force-static";

export function GET(): Response {
  return jsonManifestResponse(agentCard());
}
