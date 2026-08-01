import "server-only";
import { neon } from "@neondatabase/serverless";
import { CLARITY_CONFIGURED } from "./cro/clarity";
import { META_CONFIGURED } from "./cro/meta";

/**
 * Numbers for the admin overview, and a read on whether the machinery behind
 * them is actually switched on.
 *
 * The configuration half matters as much as the figures. This project now has
 * eleven environment variables across five services, and every one of them
 * fails quietly: a missing key does not break the site, it just makes some
 * number stay at zero. Without somewhere that says which are set, a zero is
 * indistinguishable from "nobody has visited yet".
 */

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

export interface FunnelCounts {
  views: number;
  downloads: number;
  optedIn: number;
  declined: number;
}

export interface HealthItem {
  label: string;
  ok: boolean;
  detail: string;
}

export async function getFunnelCounts(): Promise<FunnelCounts | null> {
  const url = connectionString();
  if (!url) return null;
  const sql = neon(url);

  try {
    // Baseline events cover the periods with no experiment running; experiment
    // events cover the rest. Summed, because a visitor counts once either way
    // and splitting them here would understate whichever mode was last active.
    const rows = (await sql`
      SELECT
        (SELECT COUNT(*)::int FROM cro_baseline_events WHERE kind = 'impression')
        + (SELECT COUNT(*)::int FROM cro_events WHERE kind = 'impression') AS views,
        (SELECT COUNT(*)::int FROM cro_baseline_events WHERE kind = 'conversion')
        + (SELECT COUNT(*)::int FROM cro_events WHERE kind = 'conversion') AS downloads
    `) as { views: number; downloads: number }[];

    const consent = (await sql`
      SELECT granted, COUNT(DISTINCT email)::int AS n
      FROM marketing_consent GROUP BY granted`) as {
      granted: boolean;
      n: number;
    }[];

    return {
      views: rows[0]?.views ?? 0,
      downloads: rows[0]?.downloads ?? 0,
      optedIn: consent.find((r) => r.granted)?.n ?? 0,
      declined: consent.find((r) => !r.granted)?.n ?? 0,
    };
  } catch {
    // Tables are created on first use, so an empty database is normal rather
    // than an error worth showing.
    return { views: 0, downloads: 0, optedIn: 0, declined: 0 };
  }
}

export function getHealth(): HealthItem[] {
  return [
    {
      label: "Database",
      ok: Boolean(connectionString()),
      detail: "Stores experiments, consent and funnel counts.",
    },
    {
      label: "Resend",
      ok: Boolean(process.env.RESEND_API_KEY),
      detail: "Delivers the guide and runs the sequence.",
    },
    {
      label: "Nurture sequence",
      ok: Boolean(process.env.RESEND_AUTOMATION_ID),
      detail: "Without the automation id, campaign figures stay at zero.",
    },
    {
      label: "Calendly webhook",
      ok: Boolean(process.env.CALENDLY_WEBHOOK_SECRET),
      detail:
        "Marks people who book so the sequence stops asking. Unset means it never fires.",
    },
    {
      label: "Clarity",
      ok: CLARITY_CONFIGURED(),
      detail: "Feeds the CRO engine its hypotheses.",
    },
    {
      label: "Scheduled runs",
      ok: Boolean(process.env.CRON_SECRET),
      detail: "Without it the optimiser cannot be triggered at all.",
    },
    {
      label: "Meta pixel readback",
      ok: META_CONFIGURED(),
      detail:
        "Optional. Server-side conversion counts are used instead, and are the more accurate of the two.",
    },
  ];
}
