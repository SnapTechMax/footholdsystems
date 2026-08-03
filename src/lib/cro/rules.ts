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

  // There used to be a scroll-depth rule here, which moved the capture form up
  // the page when Clarity reported that most visitors never reached it. The form
  // now sits in the hero permanently, so the fix it reached for is already in
  // place and low scroll depth no longer implies the form went unseen. Scroll
  // depth is still captured and still shown on the dashboard; nothing acts on it
  // automatically. Deliberately not replaced with a copy test — the remaining
  // rules already cover every field, and a second rule competing for the same
  // fields would just make which test runs depend on rule order.

  // 1. Rage clicks: something reads as interactive and isn't behaving.
  if (per100(signals.rageClicks) > THRESHOLDS.rageClicksPer100) {
    const result = swap(
      "submitLabel",
      `${signals.rageClicks} rage clicks across ${signals.sessions} sessions`,
      "Repeated frustrated clicking suggests the call to action isn't doing what people expect. A more literal button label should set the right expectation."
    );
    if (result) return result;
  }

  // 2. Dead clicks: people click things that aren't clickable.
  if (per100(signals.deadClicks) > THRESHOLDS.deadClicksPer100) {
    const result = swap(
      "captureHeading",
      `${signals.deadClicks} dead clicks across ${signals.sessions} sessions`,
      "Visitors are clicking elements that do nothing, which usually means the real next step isn't obvious. A more direct heading above the form should pull attention to it."
    );
    if (result) return result;
  }

  // 3. Quickbacks: the page didn't match what they expected on arrival.
  if (per100(signals.quickbacks) > THRESHOLDS.quickbacksPer100) {
    const result = swap(
      "heroCtaLabel",
      `${signals.quickbacks} quickbacks across ${signals.sessions} sessions`,
      "A large share of visitors leave almost immediately, which points at a mismatch between what they expected and what the top of the page offers. A clearer hero call to action should hold more of them."
    );
    if (result) return result;
  }

  // 4. Low engagement: they stay, but the copy isn't landing.
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

  // 5. Nothing is obviously broken — keep improving the highest-leverage copy.
  for (const field of [
    "submitLabel",
    "captureHeading",
    "captureSubcopy",
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
    default:
      return field;
  }
}

export { BASE_CONTENT };
