import "server-only";
import { Resend } from "resend";
import { neon } from "@neondatabase/serverless";
import { SEQUENCE_STEPS } from "./sequence-steps";

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

  const consent = (await sql`
    SELECT granted, COUNT(DISTINCT email)::int AS n
    FROM marketing_consent GROUP BY granted`) as { granted: boolean; n: number }[];

  const downloads = (await sql`
    SELECT COUNT(*)::int AS n FROM cro_baseline_events
    WHERE kind = 'conversion'`) as { n: number }[];

  return {
    granted: consent.find((r) => r.granted)?.n ?? 0,
    declined: consent.find((r) => !r.granted)?.n ?? 0,
    downloads: downloads[0]?.n ?? 0,
  };
}

export async function getCampaignStats(): Promise<CampaignStats> {
  const errors: string[] = [];
  const empty: CampaignStats = {
    automation: null,
    runs: { total: 0, running: 0, completed: 0, cancelled: 0, failed: 0 },
    sampled: false,
    sampleSize: 0,
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

  // Steps are only on the individual run, so this is one request per run. Capped
  // deliberately: a dashboard that fans out unboundedly gets slower every week.
  const sent = new Map<string, number>();
  const waiting = new Map<string, number>();
  let suppressed = 0;
  let inspected = 0;

  for (const runId of runIds) {
    try {
      const { data, error } = await resend.automations.runs.get({
        automationId,
        runId,
      });
      if (error || !data) continue;
      inspected += 1;

      for (const step of data.steps) {
        if (step.type === "send_email" && step.status === "completed") {
          sent.set(step.key, (sent.get(step.key) ?? 0) + 1);
        }
        if (step.type === "delay" && (step.status === "waiting" || step.status === "running")) {
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
    } catch {
      // One unreadable run should not blank the whole dashboard.
    }
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
