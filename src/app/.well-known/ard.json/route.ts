import { ardCatalog } from "@/lib/agent-manifests";
import { jsonManifestResponse } from "@/lib/agent-response";

/** /.well-known/ard.json — Agentic Resource Discovery. See lib/agent-manifests.ts. */
export const dynamic = "force-static";

export function GET(): Response {
  return jsonManifestResponse(ardCatalog());
}
