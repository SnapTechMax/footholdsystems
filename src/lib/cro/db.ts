import { neon } from "@neondatabase/serverless";
import type {
  ArmTotals,
  ClaritySignals,
  ConversionSource,
  Experiment,
  ExperimentTotals,
  RunLog,
  Settings,
  VariantContent,
  VariantKey,
} from "./types";

/**
 * Postgres access for the CRO engine.
 *
 * Uses Neon's HTTP driver rather than a pooled TCP client because every caller
 * is a short-lived serverless invocation, where a connection pool is a liability.
 */

/**
 * Connection string, under whichever name the provider used.
 *
 * The Neon integration, the older Vercel Postgres integration and a hand-added
 * variable all pick different names, and the difference is invisible until
 * something 503s in production. Pooled URLs come first — every caller here is a
 * short-lived serverless invocation, so the pooler is what should absorb them.
 */
const BASE_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  // Direct (non-pooled) endpoints last: every caller here is a short-lived
  // serverless invocation, so the pooler should absorb them where one exists.
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

// Vercel's marketplace integrations let you namespace the variables they create,
// and Neon's defaults to STORAGE_. Checking each base name bare and prefixed
// covers both without needing to know how the integration was set up.
// POSTGRES_URL_NO_SSL is deliberately absent — Neon requires TLS.
const NAME_PREFIXES = ["", "STORAGE_", "NEON_"] as const;

export const CONNECTION_ENV_VARS: string[] = BASE_NAMES.flatMap((base) =>
  NAME_PREFIXES.map((prefix) => `${prefix}${base}`)
);

function connectionString(): string | undefined {
  for (const name of CONNECTION_ENV_VARS) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

/** Which variable was actually used, for the dashboard to show. */
export function connectionVarName(): string | null {
  for (const name of CONNECTION_ENV_VARS) {
    if (process.env[name]) return name;
  }
  return null;
}

export const DATABASE_CONFIGURED = Boolean(connectionString());

/** Shown when no connection string is found, so the cause is diagnosable from the response. */
export const DATABASE_HINT =
  `No Postgres connection string found. Looked for: ${CONNECTION_ENV_VARS.join(", ")}. ` +
  "Vercel only exposes environment variables to deployments built after they were added — redeploying is often the fix.";

function sql() {
  const url = connectionString();
  if (!url) {
    throw new Error(
      `No Postgres connection string found. Looked for: ${CONNECTION_ENV_VARS.join(", ")}. ` +
        "Note that Vercel only exposes environment variables to deployments built after they were added, so a redeploy may be all that's needed."
    );
  }
  return neon(url);
}

export const DEFAULT_SETTINGS: Settings = {
  intervalHours: 24,
  enabled: true,
  pagePath: "/guide",
  // Set to Meta as requested; the engine falls back to internal counts and says
  // so loudly if the Meta credentials are absent.
  conversionSource: "meta",
  // Below this, a difference between arms is almost certainly noise.
  minImpressionsPerArm: 300,
  significanceLevel: 0.05,
  rollbackDropPct: 40,
  lastRunAt: null,
};

/** Create tables if they don't exist. Safe to call on every request. */
export async function initSchema(): Promise<void> {
  const db = sql();

  await db`
    CREATE TABLE IF NOT EXISTS cro_experiments (
      id           SERIAL PRIMARY KEY,
      page_path    TEXT NOT NULL,
      hypothesis   TEXT NOT NULL,
      trigger      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'running',
      variant_a    JSONB NOT NULL,
      variant_b    JSONB NOT NULL,
      winner       TEXT,
      decision     TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      concluded_at TIMESTAMPTZ
    )`;

  await db`
    CREATE TABLE IF NOT EXISTS cro_events (
      id            BIGSERIAL PRIMARY KEY,
      experiment_id INTEGER NOT NULL REFERENCES cro_experiments(id) ON DELETE CASCADE,
      variant       TEXT NOT NULL,
      kind          TEXT NOT NULL,
      visitor_id    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // One impression per visitor per experiment; a reload shouldn't dilute the rate.
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS cro_events_unique_per_visitor
      ON cro_events (experiment_id, visitor_id, kind)`;

  // Views and conversions while no experiment is running. Without this the
  // system records nothing at all between tests, so real traffic arrives and
  // leaves no trace, and the first experiment starts with no idea what the
  // conversion rate it is trying to beat actually is.
  await db`
    CREATE TABLE IF NOT EXISTS cro_baseline_events (
      id         BIGSERIAL PRIMARY KEY,
      kind       TEXT NOT NULL,
      page_path  TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS cro_baseline_unique_per_visitor
      ON cro_baseline_events (page_path, visitor_id, kind)`;

  await db`
    CREATE TABLE IF NOT EXISTS cro_clarity_snapshots (
      id           SERIAL PRIMARY KEY,
      captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      page_path    TEXT NOT NULL,
      signals      JSONB NOT NULL,
      raw          JSONB
    )`;

  await db`
    CREATE TABLE IF NOT EXISTS cro_runs (
      id         SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status     TEXT NOT NULL,
      actions    JSONB NOT NULL DEFAULT '[]'::jsonb,
      error      TEXT
    )`;

  await db`
    CREATE TABLE IF NOT EXISTS cro_settings (
      key   TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )`;

  // Counts Clarity API calls so the 10-per-day quota is never blown.
  await db`
    CREATE TABLE IF NOT EXISTS cro_clarity_budget (
      day   DATE PRIMARY KEY,
      calls INTEGER NOT NULL DEFAULT 0
    )`;
}

/* ── settings ─────────────────────────────────────────────────────────────── */

export async function getSettings(): Promise<Settings> {
  const db = sql();
  const rows = (await db`
    SELECT value FROM cro_settings WHERE key = 'settings'`) as {
    value: Partial<Settings>;
  }[];
  return { ...DEFAULT_SETTINGS, ...(rows[0]?.value ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const merged = { ...(await getSettings()), ...patch };
  const db = sql();
  await db`
    INSERT INTO cro_settings (key, value)
    VALUES ('settings', ${JSON.stringify(merged)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return merged;
}

/* ── experiments ──────────────────────────────────────────────────────────── */

interface ExperimentRow {
  id: number;
  page_path: string;
  hypothesis: string;
  trigger: string;
  status: string;
  variant_a: VariantContent;
  variant_b: VariantContent;
  winner: string | null;
  decision: string | null;
  created_at: string;
  concluded_at: string | null;
}

function toExperiment(row: ExperimentRow): Experiment {
  return {
    id: row.id,
    pagePath: row.page_path,
    hypothesis: row.hypothesis,
    trigger: row.trigger,
    status: row.status as Experiment["status"],
    variantA: row.variant_a,
    variantB: row.variant_b,
    winner: (row.winner as VariantKey | null) ?? null,
    decision: row.decision,
    createdAt: new Date(row.created_at).toISOString(),
    concludedAt: row.concluded_at
      ? new Date(row.concluded_at).toISOString()
      : null,
  };
}

export async function getRunningExperiment(
  pagePath: string
): Promise<Experiment | null> {
  const db = sql();
  const rows = (await db`
    SELECT * FROM cro_experiments
    WHERE page_path = ${pagePath} AND status = 'running'
    ORDER BY id DESC LIMIT 1`) as ExperimentRow[];
  return rows[0] ? toExperiment(rows[0]) : null;
}

export async function listExperiments(limit = 50): Promise<Experiment[]> {
  const db = sql();
  const rows = (await db`
    SELECT * FROM cro_experiments
    ORDER BY id DESC LIMIT ${limit}`) as ExperimentRow[];
  return rows.map(toExperiment);
}

export async function createExperiment(input: {
  pagePath: string;
  hypothesis: string;
  trigger: string;
  variantA: VariantContent;
  variantB: VariantContent;
}): Promise<Experiment> {
  const db = sql();
  const rows = (await db`
    INSERT INTO cro_experiments (page_path, hypothesis, trigger, variant_a, variant_b)
    VALUES (
      ${input.pagePath}, ${input.hypothesis}, ${input.trigger},
      ${JSON.stringify(input.variantA)}::jsonb, ${JSON.stringify(input.variantB)}::jsonb
    )
    RETURNING *`) as ExperimentRow[];
  return toExperiment(rows[0]);
}

export async function concludeExperiment(
  id: number,
  status: Exclude<Experiment["status"], "running">,
  winner: VariantKey | null,
  decision: string
): Promise<void> {
  const db = sql();
  await db`
    UPDATE cro_experiments
    SET status = ${status}, winner = ${winner}, decision = ${decision},
        concluded_at = now()
    WHERE id = ${id}`;
}

/** The content currently considered best for a page — the last winner, or {}. */
export async function getBaselineContent(
  pagePath: string
): Promise<VariantContent> {
  const db = sql();
  const rows = (await db`
    SELECT variant_a, variant_b, winner FROM cro_experiments
    WHERE page_path = ${pagePath} AND status = 'concluded' AND winner IS NOT NULL
    ORDER BY concluded_at DESC LIMIT 1`) as ExperimentRow[];
  if (!rows[0]) return {};
  return rows[0].winner === "b" ? rows[0].variant_b : rows[0].variant_a;
}

/* ── events ───────────────────────────────────────────────────────────────── */

export async function recordEvent(
  experimentId: number,
  variant: VariantKey,
  kind: "impression" | "conversion",
  visitorId: string
): Promise<void> {
  const db = sql();
  // ON CONFLICT keeps one row per visitor per kind, so reloads don't inflate.
  await db`
    INSERT INTO cro_events (experiment_id, variant, kind, visitor_id)
    VALUES (${experimentId}, ${variant}, ${kind}, ${visitorId})
    ON CONFLICT (experiment_id, visitor_id, kind) DO NOTHING`;
}

export async function getTotals(
  experimentId: number
): Promise<ExperimentTotals> {
  const db = sql();
  const rows = (await db`
    SELECT variant, kind, COUNT(*)::int AS n
    FROM cro_events WHERE experiment_id = ${experimentId}
    GROUP BY variant, kind`) as {
    variant: string;
    kind: string;
    n: number;
  }[];

  const totals: ExperimentTotals = {
    a: { impressions: 0, conversions: 0 },
    b: { impressions: 0, conversions: 0 },
  };
  for (const row of rows) {
    const arm = row.variant === "b" ? totals.b : totals.a;
    if (row.kind === "impression") arm.impressions = row.n;
    if (row.kind === "conversion") arm.conversions = row.n;
  }
  return totals;
}

/**
 * Record a view or conversion outside any experiment.
 *
 * Deduplicated per visitor so the rate is "visitors who converted / visitors who
 * looked", matching how experiment arms are counted.
 */
export async function recordBaselineEvent(
  pagePath: string,
  kind: "impression" | "conversion",
  visitorId: string
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO cro_baseline_events (page_path, kind, visitor_id)
    VALUES (${pagePath}, ${kind}, ${visitorId})
    ON CONFLICT (page_path, visitor_id, kind) DO NOTHING`;
}

export async function getBaselineTotals(pagePath: string): Promise<ArmTotals> {
  const db = sql();
  const rows = (await db`
    SELECT kind, COUNT(*)::int AS n
    FROM cro_baseline_events WHERE page_path = ${pagePath}
    GROUP BY kind`) as { kind: string; n: number }[];

  const totals: ArmTotals = { impressions: 0, conversions: 0 };
  for (const row of rows) {
    if (row.kind === "impression") totals.impressions = row.n;
    if (row.kind === "conversion") totals.conversions = row.n;
  }
  return totals;
}

/* ── clarity ──────────────────────────────────────────────────────────────── */

export async function saveClaritySnapshot(
  signals: ClaritySignals,
  raw: unknown
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO cro_clarity_snapshots (page_path, signals, raw)
    VALUES (${signals.pagePath}, ${JSON.stringify(signals)}::jsonb,
            ${JSON.stringify(raw)}::jsonb)`;
}

export async function listClaritySnapshots(
  limit = 20
): Promise<ClaritySignals[]> {
  const db = sql();
  const rows = (await db`
    SELECT signals FROM cro_clarity_snapshots
    ORDER BY id DESC LIMIT ${limit}`) as { signals: ClaritySignals }[];
  return rows.map((r) => r.signals);
}

/** Reserve one Clarity call against today's quota. False means budget spent. */
export async function claimClarityCall(dailyLimit: number): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    INSERT INTO cro_clarity_budget (day, calls)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (day) DO UPDATE
      SET calls = cro_clarity_budget.calls + 1
      WHERE cro_clarity_budget.calls < ${dailyLimit}
    RETURNING calls`) as { calls: number }[];
  return rows.length > 0;
}

/* ── runs ─────────────────────────────────────────────────────────────────── */

export async function recordRun(
  status: RunLog["status"],
  actions: string[],
  error: string | null = null
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO cro_runs (status, actions, error)
    VALUES (${status}, ${JSON.stringify(actions)}::jsonb, ${error})`;
}

export async function listRuns(limit = 25): Promise<RunLog[]> {
  const db = sql();
  const rows = (await db`
    SELECT id, started_at, status, actions, error
    FROM cro_runs ORDER BY id DESC LIMIT ${limit}`) as {
    id: number;
    started_at: string;
    status: RunLog["status"];
    actions: string[];
    error: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    startedAt: new Date(r.started_at).toISOString(),
    status: r.status,
    actions: r.actions ?? [],
    error: r.error,
  }));
}

export type { ConversionSource };
