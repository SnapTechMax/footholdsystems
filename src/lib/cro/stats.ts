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
  /** Two-sided p-value from a pooled two-proportion z-test. */
  pValue: number | null;
  zScore: number | null;
}

export function compare({ a, b }: ComparisonInput): Comparison {
  const rateA = a.impressions > 0 ? a.conversions / a.impressions : 0;
  const rateB = b.impressions > 0 ? b.conversions / b.impressions : 0;
  const liftPct = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : null;

  if (a.impressions === 0 || b.impressions === 0) {
    return { rateA, rateB, liftPct, pValue: null, zScore: null };
  }

  const pooled = (a.conversions + b.conversions) / (a.impressions + b.impressions);
  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / a.impressions + 1 / b.impressions)
  );
  if (se === 0) {
    return { rateA, rateB, liftPct, pValue: null, zScore: null };
  }

  const zScore = (rateB - rateA) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
  return { rateA, rateB, liftPct, pValue, zScore };
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
 * challenger is clearly hurting. The early bail deliberately uses a much lower
 * bar than declaring a winner — shipping a loser costs real leads every day it
 * stays up, so the asymmetry is intentional.
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

  if (result.pValue === null || result.pValue > significanceLevel) {
    const p = result.pValue === null ? "n/a" : result.pValue.toFixed(3);
    return {
      kind: "insufficient",
      reason:
        `No significant difference yet (p=${p}, need <${significanceLevel}). ` +
        `A ${fmtRate(result.rateA)}, B ${fmtRate(result.rateB)}.`,
    };
  }

  const winner = result.rateB > result.rateA ? "b" : "a";
  return {
    kind: "winner",
    winner,
    reason:
      `Variant ${winner.toUpperCase()} wins: ${fmtRate(result.rateA)} vs ` +
      `${fmtRate(result.rateB)} (p=${result.pValue.toFixed(4)}, ` +
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
