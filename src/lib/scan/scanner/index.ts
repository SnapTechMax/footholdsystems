import type { ScanCheck, ScanLayer, ScanPayload } from "../types";
import { ACCESS_CHECKS } from "./access";
import { DEFAULT_CATEGORY, type BusinessCategory } from "../categories";
import { CHECKS, LAYERS, type CheckDefinition } from "./catalog";
import type { CheckFn, CheckOutcome } from "./check";
import { DISCOVERY_CHECKS } from "./discovery";
import { PAYMENT_CHECKS } from "./payments";
import { ScanError, Site } from "./site";
import { USABILITY_CHECKS } from "./usability";
import { mapLimit } from "./util";

/**
 * The scanner.
 *
 * Runs the 44 checks a report is built from, over `fetch`, from wherever this
 * code is deployed, and hands back a payload in the shape report.ts, the
 * paywall split, the email and the scans table's `raw` column all expect.
 *
 * WHERE IT CAME FROM. Until 2026-09-09 the scan was Ora's, reached through
 * Is Agentic's proxy: two third parties, one metered at thirty scans a day
 * and one undocumented, neither of which had promised to keep answering, and
 * no API key on offer. This module replaced both. The check ids, weights and
 * tiers were taken from Ora's catalog (catalog.ts) and the heuristic behind
 * each check was reverse-engineered from its live results, so a payload
 * stored before the switch and one from this scanner score the same way and
 * read the same way. `npm run scan:compare` measures that, check by check,
 * against Ora's public score endpoint for as long as it answers.
 *
 * WHAT IT IS NOT. Ora ran 125 checks with a headless browser, live LLM
 * evaluation and a paid search index. This runs 44 with `fetch` and regular
 * expressions. On the checks that matter for a business website — can a
 * crawler read you, do you say what you are, does anything outside you
 * corroborate it — the two agreed on every check when compared. On the two
 * checks that need a search engine it depends on a search provider being
 * configured, see search.ts, and says so with an `error` status, which the
 * report excludes, rather than guessing.
 *
 * SCORING. `score` is earned over available across the checks that ran, with
 * N/A checks and unearned bonus checks left out of the denominator. It is
 * informational. The number a customer sees is recomputed by report.ts over
 * the category's subset.
 */

export { ScanError };

const CHECK_FUNCTIONS: Record<string, CheckFn> = {
  ...DISCOVERY_CHECKS,
  ...ACCESS_CHECKS,
  ...USABILITY_CHECKS,
  ...PAYMENT_CHECKS,
};

export interface ScanOptions {
  /**
   * Whole-scan deadline. 45s, which is what fits: the outreach route that
   * drives a crawl is a 60s function, and 75s meant the function was killed
   * mid-scan instead of the scan ending cleanly and storing its result. The
   * remaining 15s covers building the report, writing it, and answering.
   */
  timeoutMs?: number;
  /**
   * Per-check deadline. A check past this reads as `error`, not as a hung
   * scan. Generous because the two search-backed checks wait in one queue
   * behind each other's retries (see search.ts); the scan deadline still
   * bounds the whole thing.
   */
  checkTimeoutMs?: number;
  /** Checks in flight at once. Each may make a few requests of its own. */
  concurrency?: number;
  signal?: AbortSignal;
  /**
   * What the business is being graded as. Reaches the checks through `Site`,
   * so one can skip work that cannot apply to it. Scoring still happens in
   * buildReport; this is only about which questions are worth asking.
   */
  category?: BusinessCategory;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The raw payload's letter scale, kept from Ora's so old and new rows read alike. Not the report's. */
function gradeFor(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 86) return "A";
  if (score >= 70) return "B";
  if (score >= 48) return "C";
  if (score >= 28) return "D";
  return "F";
}

/** Keeps a check honest about its own ceiling. */
function clamp(outcome: CheckOutcome, def: CheckDefinition): CheckOutcome {
  const score = Math.max(0, Math.min(def.maxScore, Math.round(outcome.score * 10) / 10));
  return { ...outcome, score };
}

/** Whether a check counts toward the score. */
function counted(def: CheckDefinition, outcome: CheckOutcome): boolean {
  if (outcome.status === "na" || outcome.status === "error") return false;
  if (def.bonus && outcome.score === 0) return false;
  return true;
}

export async function scanDomain(
  domain: string,
  options: ScanOptions = {}
): Promise<ScanPayload> {
  const started = Date.now();
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 45_000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const checkTimeoutMs = options.checkTimeoutMs ?? 45_000;

  const site = await Site.load(domain, signal, options.category ?? DEFAULT_CATEGORY);

  const outcomes = await mapLimit(CHECKS, options.concurrency ?? 6, async (def) => {
    const run = CHECK_FUNCTIONS[def.id];
    if (!run) return { status: "error", score: 0, details: "Not implemented" } as CheckOutcome;
    try {
      return clamp(await withTimeout(run(site), checkTimeoutMs, def.id), def);
    } catch (error) {
      return {
        status: "error",
        score: 0,
        details: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
      } as CheckOutcome;
    }
  });

  let earned = 0;
  let available = 0;
  CHECKS.forEach((def, i) => {
    if (!counted(def, outcomes[i])) return;
    earned += outcomes[i].score;
    available += def.maxScore;
  });
  const score = available > 0 ? Math.round((earned / available) * 100) : 0;

  const checks: ScanCheck[] = CHECKS.map((def, i) => {
    const outcome = outcomes[i];
    const lost = def.maxScore - outcome.score;
    const actionable = outcome.status === "fail" || outcome.status === "warning";
    // Points on the 100 scale that fixing this recovers. An unearned bonus
    // check would join the denominator once earned, so it is measured
    // against that larger total rather than flattering itself.
    const denominator = counted(def, outcome) ? available : available + def.maxScore;
    const estScoreGain =
      actionable && lost > 0 && denominator > 0
        ? Math.round((lost / denominator) * 1000) / 10
        : undefined;
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      status: outcome.status,
      score: outcome.score,
      maxScore: def.maxScore,
      details: outcome.details,
      bonus: def.bonus,
      specUrl: def.specUrl,
      maturity: "verified",
      tier: def.tier,
      estScoreGain,
    };
  });

  const layers: ScanLayer[] = LAYERS.map((layer) => {
    const own: ScanCheck[] = [];
    let layerEarned = 0;
    let layerAvailable = 0;
    CHECKS.forEach((def, i) => {
      if (def.layer !== layer.id) return;
      own.push(checks[i]);
      if (!counted(def, outcomes[i])) return;
      layerEarned += outcomes[i].score;
      layerAvailable += def.maxScore;
    });
    return {
      id: layer.id,
      name: layer.name,
      description: layer.description,
      checks: own,
      score: layerEarned,
      maxScore: layerAvailable,
    };
  });

  return {
    domain,
    url: `https://${domain}`,
    finalUrl: site.home.finalUrl,
    score,
    maxScore: 100,
    grade: gradeFor(score),
    layers,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    analysisStatus: "complete",
  };
}

/**
 * Whether a failed scan is worth the sweeper's next attempt.
 *
 * A domain that does not resolve will not resolve in ten minutes either; a
 * site that was slow, down or mid-deploy very well might be up. Anything that
 * is not the scanner's own verdict — a thrown bug, a database error — counts
 * as transient, because the alternative is a customer whose report never
 * arrives over a fault that was ours.
 */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ScanError) || error.retryable;
}
