import type { ClaritySignals, Experiment, VariantContent } from "./types";
import {
  BASE_CONTENT,
  nextCandidate,
  resolveContent,
  type LibraryField,
} from "./variants";

/**
 * Turns Clarity's page-level aggregates into the next thing to try.
 *
 * Clarity's API gives no element-level detail, so these rules read a whole-page
 * symptom and reach for the move that most often addresses it. Ordered by how
 * strongly the signal implies the fix — the first rule that fires wins, because
 * running one test at a time is what lets it reach significance.
 */

export interface Hypothesis {
  trigger: string;
  hypothesis: string;
  /** Overrides applied on top of the current baseline to form variant B. */
  changes: VariantContent;
}

/** Thresholds at which a signal is considered a problem worth acting on. */
export const THRESHOLDS = {
  /** Average scroll depth below this suggests the form is never seen. */
  scrollDepthPct: 55,
  /** Rage clicks per 100 sessions. */
  rageClicksPer100: 2,
  /** Dead clicks per 100 sessions. */
  deadClicksPer100: 4,
  /** Quickbacks per 100 sessions — arrived, bounced straight back. */
  quickbacksPer100: 25,
  /** Engagement seconds below this suggests the promise isn't landing. */
  engagementSeconds: 20,
  /** Below this many sessions, no signal is trustworthy. */
  minSessions: 30,
};

/** Values already tested for a field, so the engine doesn't repeat itself. */
function triedValues(history: Experiment[], field: LibraryField): string[] {
  const values: string[] = [];
  for (const experiment of history) {
    for (const variant of [experiment.variantA, experiment.variantB]) {
      const value = variant[field];
      if (typeof value === "string") values.push(value);
    }
  }
  return values;
}

/**
 * Choose the next experiment, or null if there's nothing worth testing.
 *
 * `baseline` is the currently-winning content; `history` is past experiments on
 * this page, used to avoid re-testing copy that has already run.
 */
export function nextHypothesis(
  signals: ClaritySignals,
  baseline: VariantContent,
  history: Experiment[]
): Hypothesis | null {
  const live = resolveContent(baseline);
  const per100 = (count: number) =>
    signals.sessions > 0 ? (count / signals.sessions) * 100 : 0;

  // Too little traffic for any of this to mean anything.
  if (signals.sessions < THRESHOLDS.minSessions) return null;

  const swap = (
    field: LibraryField,
    trigger: string,
    hypothesis: string
  ): Hypothesis | null => {
    const candidate = nextCandidate(field, live[field], triedValues(history, field));
    if (!candidate) return null;
    return { trigger, hypothesis, changes: { [field]: candidate } };
  };

  // 1. They never reach the form. Strongest signal available, and the fix is
  //    structural rather than cosmetic, so it takes priority.
  if (
    signals.scrollDepth !== null &&
    signals.scrollDepth < THRESHOLDS.scrollDepthPct &&
    !live.formAboveFold
  ) {
    return {
      trigger: `Average scroll depth ${signals.scrollDepth.toFixed(0)}% over ${signals.sessions} sessions`,
      hypothesis:
        "Most visitors never scroll far enough to see the capture form. Putting a second form high on the page should let them convert without scrolling.",
      changes: { formAboveFold: true },
    };
  }

  // 2. Rage clicks: something reads as interactive and isn't behaving.
  if (per100(signals.rageClicks) > THRESHOLDS.rageClicksPer100) {
    const result = swap(
      "submitLabel",
      `${signals.rageClicks} rage clicks across ${signals.sessions} sessions`,
      "Repeated frustrated clicking suggests the call to action isn't doing what people expect. A more literal button label should set the right expectation."
    );
    if (result) return result;
  }

  // 3. Dead clicks: people click things that aren't clickable.
  if (per100(signals.deadClicks) > THRESHOLDS.deadClicksPer100) {
    const result = swap(
      "captureHeading",
      `${signals.deadClicks} dead clicks across ${signals.sessions} sessions`,
      "Visitors are clicking elements that do nothing, which usually means the real next step isn't obvious. A more direct heading above the form should pull attention to it."
    );
    if (result) return result;
  }

  // 4. Quickbacks: the page didn't match what they expected on arrival.
  if (per100(signals.quickbacks) > THRESHOLDS.quickbacksPer100) {
    const result = swap(
      "heroCtaLabel",
      `${signals.quickbacks} quickbacks across ${signals.sessions} sessions`,
      "A large share of visitors leave almost immediately, which points at a mismatch between what they expected and what the top of the page offers. A clearer hero call to action should hold more of them."
    );
    if (result) return result;
  }

  // 5. Low engagement: they stay, but the copy isn't landing.
  if (
    signals.engagementTime !== null &&
    signals.engagementTime < THRESHOLDS.engagementSeconds
  ) {
    const result = swap(
      "captureSubcopy",
      `Average engagement ${signals.engagementTime.toFixed(0)}s over ${signals.sessions} sessions`,
      "Visitors aren't spending long enough to absorb the offer. Tighter supporting copy should get the value across faster."
    );
    if (result) return result;
  }

  // 6. Nothing is obviously broken — keep improving the highest-leverage copy.
  for (const field of [
    "submitLabel",
    "captureHeading",
    "captureSubcopy",
    "formFootnote",
  ] as LibraryField[]) {
    const result = swap(
      field,
      `No blocking signal; ${signals.sessions} sessions in the window`,
      `Nothing in the Clarity data stands out, so this tests the next untried ${labelFor(field)} to keep improving the baseline.`
    );
    if (result) return result;
  }

  return null;
}

function labelFor(field: LibraryField): string {
  switch (field) {
    case "submitLabel":
      return "button label";
    case "captureHeading":
      return "form heading";
    case "captureSubcopy":
      return "supporting copy";
    case "formFootnote":
      return "reassurance line";
    default:
      return field;
  }
}

export { BASE_CONTENT };
