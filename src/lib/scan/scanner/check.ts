import type { CheckStatus } from "../types";
import type { Site } from "./site";

/**
 * What one check hands back.
 *
 * Only the three things the check itself decides: how it went, how many of
 * its points were earned, and what it saw. Everything else on an Ora check
 * (name, tier, maxScore, bonus, layer) comes from the catalog, so a check
 * cannot disagree with it.
 *
 * `details` keeps the phrasing the checks have always used — "N chars,
 * semantic headings" — because report.ts quotes it verbatim as the free half
 * of a finding, and a report built before the scanner moved in-house should
 * read exactly like one built after.
 */
export interface CheckOutcome {
  status: CheckStatus;
  score: number;
  details: string;
}

export type CheckFn = (site: Site) => Promise<CheckOutcome>;

export const pass = (score: number, details: string): CheckOutcome => ({
  status: "pass",
  score,
  details,
});

export const warn = (score: number, details: string): CheckOutcome => ({
  status: "warning",
  score,
  details,
});

export const fail = (details: string): CheckOutcome => ({ status: "fail", score: 0, details });

/** Did not apply. Excluded from the score, unless the category asked for it. */
export const na = (details: string): CheckOutcome => ({ status: "na", score: 0, details });

/** Could not be measured. Excluded from the score and never a finding. */
export const error = (details: string): CheckOutcome => ({ status: "error", score: 0, details });
