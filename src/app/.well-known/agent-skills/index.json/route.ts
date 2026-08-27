import { agentSkillsIndex } from "@/lib/agent-manifests";
import { jsonManifestResponse } from "@/lib/agent-response";

/**
 * /.well-known/agent-skills/index.json
 *
 * A route and not a static file specifically because of the digest: it is
 * computed from the SKILL.md body at build time, so the two cannot disagree.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return jsonManifestResponse(agentSkillsIndex());
}
