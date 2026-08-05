import "server-only";
import { Resend } from "resend";
import { neon } from "@neondatabase/serverless";
import { SEQUENCE_STEPS } from "./sequence-steps";
import { initConsentSchema } from "./consent";

/**
 * Campaign statistics for the nurture sequence.
 *
 * Pulled from two places, because neither alone is the whole picture:
 *
 *  - **Resend** knows who is in the sequence and how far each has got. Its list
 *    endpoint returns run status but not steps, so building the per-email funnel
 *    means fetching runs individually. That is one request each, so it is capped
 *    and the UI says when it is showing a sample.
 *  - **Our database** knows who consented and who downloaded, which Resend never
 *    sees, since people who decline are never enrolled.
 *
 * Not available anywhere: opens and clicks. Resend's API exposes neither for
 * automations, which is why every link in every email carries UTM parameters.
 * Click-through lives in GA4.
 */

const RUN_SAMPLE_LIMIT = 50;

/**
 * Reading the per-email funnel means one API call per run, because Resend only
 * returns step detail on an individual run. That fan-out was the whole problem:
 * fifty requests were fired back to back on every page load, Resend rate-limited
 * most of them, and each failure was swallowed by a bare `continue`. A different
 * subset survived every time, so the same dashboard reported different numbers
 * on every refresh — and never said it was guessing.
 *
 * Three things fix it: pace the requests, retry the ones that are rate-limited,
 * and refuse to present a partial read as a complete one.
 */
const REQUEST_CONCURRENCY = 4;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 400;

/**
 * How long a computed snapshot is reused.
 *
 * The fan-out is slow and rate-limited, so recomputing it on every refresh was
 * both the cause of the flapping and a good way to stay rate-limited. Held in
 * module scope, which means per serverless instance rather than shared — good
 * enough for one operator refreshing a page, and the numbers are correct either
 * way now, so the worst case is a slightly older snapshot rather than a
 * different one.
 */
const CACHE_TTL_MS = 60_000;
let cached: { at: number; stats: CampaignStats } | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(
  error: { statusCode?: number | null; name?: string } | null
): boolean {
  if (!error) return false;
  return error.statusCode === 429 || error.name === "rate_limit_exceeded";
}

/**
 * Run a job over the ids a few at a time, so the API is not hit all at once.
 * Order does not matter here — every result is folded into counters.
 */
async function mapWithConcurrency<T>(
  ids: string[],
  limit: number,
  job: (id: string) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, ids.length) }, async () => {
    while (cursor < ids.length) {
      const index = cursor++;
      results.push(await job(ids[index]));
    }
  });
  await Promise.all(workers);
  return results;
}

const CONNECTION_ENV_VARS = [
  "DATABASE_URL",
  "STORAGE_DATABASE_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_POSTGRES_URL",
];

function connectionString(): string | undefined {
  for (const name of CONNECTION_ENV_VARS) {
    if (process.env[name]) return process.env[name];
  }
  return undefined;
}

export const CAMPAIGN_CONFIGURED = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.RESEND_AUTOMATION_ID);

export interface StepProgress {
  /** 1-based position in the sequence. */
  position: number;
  key: string;
  subject: string;
  day: number;
  /** Runs where this email has been sent. */
  sent: number;
  /** Runs waiting on this step's delay. */
  waiting: number;
  /** Runs that never reached it, because the sequence ended first. */
  notReached: number;
}

export interface CampaignStats {
  automation: { id: string; name: string; status: string } | null;
  runs: { total: number; running: number; completed: number; cancelled: number; failed: number };
  /** True when the funnel below is from a sample rather than every run. */
  sampled: boolean;
  sampleSize: number;
  /**
   * Runs that could not be read even after retries. Any number above zero means
   * every count below is a floor, not a total.
   */
  unreadableRuns: number;
  /** When this snapshot was computed, so the page can say how fresh it is. */
  fetchedAt: string;
  funnel: StepProgress[];
  /** Runs ended early by the booked check. */
  suppressedByBooking: number;
  consent: { granted: number; declined: number };
  downloads: number;
  errors: string[];
}

async function consentAndDownloads(): Promise<{
  granted: number;
  declined: number;
  downloads: number;
}> {
  const url = connectionString();
  if (!url) return { granted: 0, declined: 0, downloads: 0 };
  const sql = neon(url);

  // marketing_consent only exists once somebody has submitted the form, and
  // these two queries used to share a failure: an absent table took the
  // download count down with it.
  try {
    await initConsentSchema();
  } catch (error) {
    console.error("Campaign: consent schema check failed:", error);
  }

  let granted = 0;
  let declined = 0;
  try {
    const consent = (await sql`
      SELECT granted, COUNT(DISTINCT email)::int AS n
      FROM marketing_consent GROUP BY granted`) as { granted: boolean; n: number }[];
    granted = consent.find((r) => r.granted)?.n ?? 0;
    declined = consent.find((r) => !r.granted)?.n ?? 0;
  } catch (error) {
    console.error("Campaign: consent counts failed:", error);
  }

  let downloads = 0;
  try {
    // Both tables, because a download lands in whichever one was active at the
    // time: `cro_baseline_events` between experiments, `cro_events` during one.
    // Counting only the baseline table meant every conversion recorded while a
    // test was running went missing here, so this figure drifted below the same
    // count on the overview page for as long as any experiment lasted, and never
    // caught back up.
    const rows = (await sql`
      SELECT
        (SELECT COUNT(*)::int FROM cro_baseline_events WHERE kind = 'conversion')
        + (SELECT COUNT(*)::int FROM cro_events WHERE kind = 'conversion') AS n`) as {
      n: number;
    }[];
    downloads = rows[0]?.n ?? 0;
  } catch (error) {
    console.error("Campaign: download count failed:", error);
  }

  return { granted, declined, downloads };
}

/**
 * Campaign statistics, reusing a recent snapshot where there is one.
 *
 * The wrapper is the other half of the flapping fix. Even with the fan-out
 * paced and retried, recomputing on every refresh means dozens of API calls
 * each time and a fresh chance to be rate-limited. Within the TTL a refresh now
 * returns the same answer because it is literally the same answer.
 *
 * `force: true` is what the reset control uses, so a deliberate action is never
 * answered with a stale snapshot.
 */
export async function getCampaignStats(
  options: { force?: boolean } = {}
): Promise<CampaignStats> {
  if (!options.force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.stats;
  }
  const stats = await computeCampaignStats();
  cached = { at: Date.now(), stats };
  return stats;
}

/** Clears the snapshot, so the next read is fresh. */
export function invalidateCampaignStats(): void {
  cached = null;
}

async function computeCampaignStats(): Promise<CampaignStats> {
  const errors: string[] = [];
  const empty: CampaignStats = {
    automation: null,
    runs: { total: 0, running: 0, completed: 0, cancelled: 0, failed: 0 },
    sampled: false,
    sampleSize: 0,
    unreadableRuns: 0,
    fetchedAt: new Date().toISOString(),
    funnel: [],
    suppressedByBooking: 0,
    consent: { granted: 0, declined: 0 },
    downloads: 0,
    errors,
  };

  try {
    const db = await consentAndDownloads();
    empty.consent = { granted: db.granted, declined: db.declined };
    empty.downloads = db.downloads;
  } catch (error) {
    errors.push(
      `Database: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const automationId = process.env.RESEND_AUTOMATION_ID;
  if (!process.env.RESEND_API_KEY || !automationId) {
    errors.push(
      "RESEND_AUTOMATION_ID is not set, so sequence progress cannot be read. It is printed when scripts/create-email-sequence.mjs runs."
    );
    return empty;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data: automation, error } = await resend.automations.get(automationId);
    if (error) throw new Error(error.message);
    if (automation) {
      empty.automation = {
        id: automation.id,
        name: automation.name,
        status: automation.status,
      };
    }
  } catch (error) {
    errors.push(
      `Automation lookup: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Is the configured automation the one actually sending?
  //
  // This is the failure that cost an afternoon. create-email-sequence.mjs builds
  // a *new* automation every run rather than editing the live one, because
  // Resend will not let an enabled automation's steps change. So an account
  // accumulates automations, exactly one is enabled, and RESEND_AUTOMATION_ID
  // has to be moved across by hand — switch-sequence.mjs says so on the way out,
  // and it is easy to miss.
  //
  // Miss it and `runs.list` is asked about a retired automation, finds nothing,
  // and reports zero people in the sequence. Which is indistinguishable, on a
  // dashboard, from an automation that is silently failing to enrol anyone —
  // while the real one sends day-1 and day-2 emails perfectly well.
  //
  // Cheap to check and it removes the ambiguity, so it is checked on every load.
  try {
    const { data, error } = await resend.automations.list();
    if (!error) {
      const all = data?.data ?? [];
      const enabled = all.filter((a) => a.status === "enabled");

      if (enabled.length === 0) {
        errors.push(
          "No automation is enabled in Resend, so nobody is being enrolled. " +
            "create-email-sequence.mjs builds them disabled on purpose — open " +
            "Resend → Automations and press Start."
        );
      } else if (!enabled.some((a) => a.id === automationId)) {
        const live = enabled[0];
        errors.push(
          `RESEND_AUTOMATION_ID is ${automationId}, which is not the automation ` +
            `currently running. The live one is "${live.name}" (${live.id}). ` +
            "Every figure below is being read off the wrong automation and will " +
            "stay at zero until the variable is updated and the site redeployed."
        );
      } else if (enabled.length > 1) {
        errors.push(
          `${enabled.length} automations are enabled at once, so a download may ` +
            "enrol someone in more than one sequence. Retire all but the live " +
            "one in Resend."
        );
      }
    }
  } catch {
    // A failed cross-check is not worth a visible error of its own — the
    // numbers below still stand on the automation that was configured.
  }

  let runIds: string[] = [];
  try {
    const { data, error } = await resend.automations.runs.list({
      automationId,
      limit: RUN_SAMPLE_LIMIT,
    });
    if (error) throw new Error(error.message);
    const runs = data?.data ?? [];
    runIds = runs.map((r) => r.id);
    empty.runs = {
      total: runs.length,
      running: runs.filter((r) => r.status === "running").length,
      completed: runs.filter((r) => r.status === "completed").length,
      cancelled: runs.filter((r) => r.status === "cancelled").length,
      failed: runs.filter((r) => r.status === "failed").length,
    };
    empty.sampled = Boolean(data?.has_more);
  } catch (error) {
    errors.push(
      `Run list: ${error instanceof Error ? error.message : String(error)}`
    );
    return empty;
  }

  // One request per run, because Resend returns step detail only on the run
  // itself. Paced and retried rather than fired all at once — see the constants
  // at the top of this file for why that mattered.
  const sent = new Map<string, number>();
  const waiting = new Map<string, number>();
  let suppressed = 0;
  let inspected = 0;
  let unreadable = 0;

  await mapWithConcurrency(runIds, REQUEST_CONCURRENCY, async (runId) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await resend.automations.runs.get({
          automationId,
          runId,
        });

        if (error) {
          // Only a rate limit is worth waiting out. Anything else is a fact
          // about this run that another attempt will not change.
          if (isRateLimited(error) && attempt < MAX_RETRIES) {
            await sleep(RETRY_BASE_MS * 2 ** attempt);
            continue;
          }
          unreadable += 1;
          return;
        }
        if (!data) {
          unreadable += 1;
          return;
        }

        inspected += 1;

        for (const step of data.steps) {
          if (step.type === "send_email" && step.status === "completed") {
            sent.set(step.key, (sent.get(step.key) ?? 0) + 1);
          }
          if (
            step.type === "delay" &&
            (step.status === "waiting" || step.status === "running")
          ) {
            waiting.set(step.key, (waiting.get(step.key) ?? 0) + 1);
          }
        }

        // A condition that completed with no send after it is someone who booked.
        const endedOnCondition = data.steps.some(
          (s) => s.type === "condition" && s.status === "completed"
        );
        if (endedOnCondition && data.status !== "running") {
          const sends = data.steps.filter(
            (s) => s.type === "send_email" && s.status === "completed"
          ).length;
          if (sends < SEQUENCE_STEPS.length) suppressed += 1;
        }
        return;
      } catch {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        unreadable += 1;
        return;
      }
    }
    unreadable += 1;
  });

  empty.unreadableRuns = unreadable;
  if (unreadable > 0) {
    // Said out loud rather than absorbed. This is exactly the number whose
    // silent absence made the funnel change on every refresh, and a count that
    // is quietly a floor is worse than one that admits it.
    errors.push(
      `${unreadable} of ${runIds.length} runs could not be read from Resend, ` +
        "most likely rate limiting. Every per-email figure below is a floor " +
        "rather than a total until this is zero."
    );
  }

  empty.sampleSize = inspected;
  empty.suppressedByBooking = suppressed;
  empty.funnel = SEQUENCE_STEPS.map((step, index) => {
    const sentCount = sent.get(`send_${step.key}`) ?? 0;
    return {
      position: index + 1,
      key: step.key,
      subject: step.subject,
      day: step.day,
      sent: sentCount,
      waiting: waiting.get(`wait_${step.key}`) ?? 0,
      notReached: Math.max(0, inspected - sentCount),
    };
  });

  return empty;
}
