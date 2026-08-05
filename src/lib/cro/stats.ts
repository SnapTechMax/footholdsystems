/**
 * Frequentist test for comparing two conversion rates.
 *
 * The engine runs unattended, so the job here is mostly to say "not yet". At the
 * traffic a new site gets, almost every apparent difference between two arms is
 * noise, and acting on it makes the page worse while looking like progress.
 */

/** Standard normal CDF via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export interface ComparisonInput {
  a: { impressions: number; conversions: number };
  b: { impressions: number; conversions: number };
}

export interface Comparison {
  rateA: number;
  rateB: number;
  /** Relative change of b against a, as a percentage. */
  liftPct: number | null;
  /**
   * Two-sided p-value from a pooled two-proportion z-test.
   *
   * Reported, but **not** what decisions are made on. It is only valid at a
   * sample size fixed before the test began, and this engine looks every three
   * hours. Use `alwaysValidPValue` for anything that acts.
   */
  pValue: number | null;
  /**
   * Sequential p-value, valid at every look. This is the one `verdict` uses.
   * Always at least as large as `pValue` — that gap is the price of being
   * allowed to stop whenever you like.
   */
  alwaysValidPValue: number | null;
  zScore: number | null;
}

/**
 * Relative effect the mixture is centred to detect.
 *
 * The sequential test needs a scale for the effects worth finding. Too small and
 * it takes forever to conclude anything; too large and it shrugs at real
 * differences. A quarter is about the smallest lift worth rewriting a page for
 * at this traffic — below that the test would outlive the copy.
 */
const TARGET_RELATIVE_LIFT = 0.25;

/**
 * A sequential (always-valid) p-value, via a mixture sequential probability
 * ratio test.
 *
 * The problem this solves: a fixed-horizon p-value is only valid if you decided
 * the sample size before looking. Test repeatedly and stop the first time it
 * dips under 0.05 and the real false-positive rate is nowhere near 5% — with
 * looks every three hours over a week it is comfortably into the twenties. The
 * engine was doing exactly that, so a "winner" could easily be noise that
 * happened to look good at 3am, and the page would then be rewritten around it.
 *
 * The fix is a likelihood ratio mixed over a normal prior on the true effect:
 *
 *     Λ = √(se² / (se² + τ²)) · exp( δ̂²τ² / (2 se² (se² + τ²)) )
 *
 * Under the null Λ is a non-negative martingale starting at 1, so Ville's
 * inequality bounds the chance it *ever* reaches 1/α at α. Rejecting when
 * 1/Λ ≤ α therefore holds the error rate across every look that will ever be
 * taken, which is what makes continuous monitoring legitimate rather than a
 * quiet way of manufacturing significance.
 *
 * τ is taken from the control arm's own rate. Strictly it should be fixed in
 * advance; deriving it from observed data is a small liberty, standard in
 * practice, and far less consequential than the problem it replaces.
 */
export function alwaysValidPValue(
  delta: number,
  standardError: number,
  tau: number
): number | null {
  if (!(standardError > 0) || !(tau > 0)) return null;

  const se2 = standardError * standardError;
  const tau2 = tau * tau;

  const logLambda =
    0.5 * Math.log(se2 / (se2 + tau2)) +
    (delta * delta * tau2) / (2 * se2 * (se2 + tau2));

  // Worked in logs: Λ overflows for a decisive result on a large sample, and an
  // Infinity here would read as a p-value of exactly 0.
  const p = Math.exp(-logLambda);
  return Number.isFinite(p) ? Math.min(1, p) : 0;
}

export function compare({ a, b }: ComparisonInput): Comparison {
  const rateA = a.impressions > 0 ? a.conversions / a.impressions : 0;
  const rateB = b.impressions > 0 ? b.conversions / b.impressions : 0;
  const liftPct = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : null;

  const empty = {
    rateA,
    rateB,
    liftPct,
    pValue: null,
    alwaysValidPValue: null,
    zScore: null,
  };

  if (a.impressions === 0 || b.impressions === 0) return empty;

  const pooled = (a.conversions + b.conversions) / (a.impressions + b.impressions);
  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / a.impressions + 1 / b.impressions)
  );
  if (se === 0) return empty;

  const delta = rateB - rateA;
  const zScore = delta / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  // Scale of effect worth finding, in absolute rate. Falls back to the pooled
  // rate when the control has converted nobody yet, so an experiment that has
  // not seen a conversion on A still has a usable scale rather than none.
  const tau = (rateA > 0 ? rateA : pooled) * TARGET_RELATIVE_LIFT;

  return {
    ...empty,
    pValue,
    alwaysValidPValue: alwaysValidPValue(delta, se, tau),
    zScore,
  };
}

export type Verdict =
  | { kind: "insufficient"; reason: string }
  | { kind: "winner"; winner: "a" | "b"; reason: string }
  | { kind: "rollback"; reason: string };

export interface VerdictOptions {
  minImpressionsPerArm: number;
  significanceLevel: number;
  /** Relative drop, in percent, that triggers an early revert. */
  rollbackDropPct: number;
  /** Impressions per arm before an early revert may fire. */
  rollbackMinImpressions?: number;
}

/**
 * Decide what to do with a running experiment.
 *
 * Three outcomes: keep waiting, promote a winner, or bail out early because the
 * challenger is clearly hurting.
 *
 * Promotion is judged on the sequential p-value, so this may be called as often
 * as the cron fires without inflating the false-positive rate. The impression
 * floor stays on top of it — not for the statistics, which no longer need it,
 * but because a winner declared off forty visitors is not something worth
 * rewriting a live page around however sound the arithmetic.
 *
 * The early bail is deliberately a much lower bar, and deliberately *not* a
 * significance claim. It is a business rule: a challenger this far down is
 * costing real leads every hour it stays up, and reverting to the control is
 * the direction where being wrong is cheap. Treating it as evidence of anything
 * would be a mistake; treating it as a stop-loss is the point.
 */
export function verdict(
  totals: ComparisonInput,
  options: VerdictOptions
): Verdict {
  const { a, b } = totals;
  const {
    minImpressionsPerArm,
    significanceLevel,
    rollbackDropPct,
    rollbackMinImpressions = Math.max(60, Math.floor(minImpressionsPerArm / 4)),
  } = options;

  const result = compare(totals);

  const bothPastRollbackFloor =
    a.impressions >= rollbackMinImpressions &&
    b.impressions >= rollbackMinImpressions;

  if (
    bothPastRollbackFloor &&
    result.liftPct !== null &&
    result.liftPct <= -rollbackDropPct
  ) {
    return {
      kind: "rollback",
      reason:
        `Challenger is ${Math.abs(result.liftPct).toFixed(0)}% worse ` +
        `(${fmtRate(result.rateB)} vs ${fmtRate(result.rateA)}) after ` +
        `${b.impressions} impressions. Reverting rather than waiting for significance.`,
    };
  }

  if (a.impressions < minImpressionsPerArm || b.impressions < minImpressionsPerArm) {
    const shortfall = Math.max(
      minImpressionsPerArm - a.impressions,
      minImpressionsPerArm - b.impressions
    );
    return {
      kind: "insufficient",
      reason:
        `Gathering data — needs ${minImpressionsPerArm} impressions per arm, ` +
        `${shortfall} short (A ${a.impressions}, B ${b.impressions}).`,
    };
  }

  // Sequential, not the fixed-horizon p-value beside it. This is the whole point
  // of the change: the engine looks every three hours, and only this one stays
  // honest when it does.
  const sequentialP = result.alwaysValidPValue;

  if (sequentialP === null || sequentialP > significanceLevel) {
    const p = sequentialP === null ? "n/a" : sequentialP.toFixed(3);
    return {
      kind: "insufficient",
      reason:
        `No significant difference yet (sequential p=${p}, need <${significanceLevel}). ` +
        `A ${fmtRate(result.rateA)}, B ${fmtRate(result.rateB)}.`,
    };
  }

  const winner = result.rateB > result.rateA ? "b" : "a";
  return {
    kind: "winner",
    winner,
    reason:
      `Variant ${winner.toUpperCase()} wins: ${fmtRate(result.rateA)} vs ` +
      `${fmtRate(result.rateB)} (sequential p=${sequentialP.toFixed(4)}, ` +
      `${result.liftPct !== null ? `${result.liftPct >= 0 ? "+" : ""}${result.liftPct.toFixed(1)}%` : "n/a"}).`,
  };
}

function fmtRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Visitors needed per arm to detect a given relative lift, so the UI can be
 * honest about how long a test will actually take at the current traffic.
 * Standard two-proportion sample size at 80% power.
 */
export function requiredSamplePerArm(
  baselineRate: number,
  minDetectableLiftPct: number,
  significanceLevel = 0.05
): number | null {
  if (baselineRate <= 0 || baselineRate >= 1 || minDetectableLiftPct <= 0) {
    return null;
  }
  const p1 = baselineRate;
  const p2 = Math.min(0.999999, p1 * (1 + minDetectableLiftPct / 100));
  // Two-sided z at alpha, and z at 80% power.
  const zAlpha = significanceLevel <= 0.01 ? 2.5758 : significanceLevel <= 0.05 ? 1.96 : 1.6449;
  const zBeta = 0.8416;
  const pBar = (p1 + p2) / 2;
  const numerator =
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((numerator / (p2 - p1)) ** 2);
}
