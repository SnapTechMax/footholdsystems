import "server-only";
import {
  DATABASE_CONFIGURED,
  getBaselineContent,
  getRunningExperiment,
} from "./db";
import { resolveAssignment } from "./assign";
import { resolveContent } from "./variants";
import type { VariantContent, VariantKey } from "./types";

/**
 * What a sales page should render right now.
 *
 * Falls back to the shipped copy whenever anything is missing or broken — no
 * database, no running experiment, a query that throws. The page must render
 * correctly before the optimiser is set up, and must not go down with it.
 */
export interface ActiveVariant {
  content: Required<VariantContent>;
  experimentId: number | null;
  variant: VariantKey | null;
  visitorId: string | null;
}

export async function getActiveVariant(pagePath: string): Promise<ActiveVariant> {
  const fallback: ActiveVariant = {
    content: resolveContent(),
    experimentId: null,
    variant: null,
    visitorId: null,
  };

  if (!DATABASE_CONFIGURED) return fallback;

  try {
    const baseline = await getBaselineContent(pagePath);
    const experiment = await getRunningExperiment(pagePath);

    // No test running: serve whatever last won.
    if (!experiment) {
      return { ...fallback, content: resolveContent(baseline) };
    }

    const { visitorId, variant } = await resolveAssignment(experiment.id);
    const chosen = variant === "b" ? experiment.variantB : experiment.variantA;

    return {
      content: resolveContent(baseline, chosen),
      experimentId: experiment.id,
      variant,
      visitorId,
    };
  } catch (error) {
    console.error("CRO: falling back to shipped copy —", error);
    return fallback;
  }
}
