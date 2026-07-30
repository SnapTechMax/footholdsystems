import type { ClaritySignals } from "./types";

/**
 * Microsoft Clarity Data Export API client.
 *
 * Hard limits worth remembering (they shape the whole engine):
 *   - 10 requests per project per day
 *   - only the last 1-3 days can be read
 *   - max 3 dimensions, 1000 rows, no pagination
 *   - no heatmap coordinates and no session recordings
 *
 * So this yields page-level aggregates, which is enough to form a hypothesis
 * ("nobody scrolls to the form") but never enough to judge one.
 * https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 */

const ENDPOINT =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

export const CLARITY_DAILY_LIMIT = 10;

export const CLARITY_CONFIGURED = () => Boolean(process.env.CLARITY_API_TOKEN);

interface ClarityMetricRow {
  metricName: string;
  information: Record<string, string | number>[];
}

export class ClarityError extends Error {}

/** Fetch the last `numOfDays` of insights, broken down by URL. */
export async function fetchClarity(numOfDays: 1 | 2 | 3 = 3): Promise<ClarityMetricRow[]> {
  const token = process.env.CLARITY_API_TOKEN;
  if (!token) {
    throw new ClarityError(
      "CLARITY_API_TOKEN is not set — generate one in Clarity under Settings → Data Export"
    );
  }

  const url = `${ENDPOINT}?numOfDays=${numOfDays}&dimension1=URL`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    throw new ClarityError(
      "Clarity daily request limit reached (10/project/day). Try again tomorrow."
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new ClarityError(
      `Clarity rejected the token (${response.status}). It may be expired or from another project.`
    );
  }
  if (!response.ok) {
    throw new ClarityError(
      `Clarity returned ${response.status}: ${(await response.text()).slice(0, 200)}`
    );
  }

  const body = await response.json();
  if (!Array.isArray(body)) {
    throw new ClarityError("Clarity returned an unexpected payload shape");
  }
  return body as ClarityMetricRow[];
}

/** Numeric coercion — the API returns counts as strings in places. */
function num(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Does this row's URL dimension refer to the page we're optimising?
 * Clarity reports the URL variously as a full URL or a bare path depending on
 * how the page was reached, so match on the path suffix.
 */
function matchesPage(rowUrl: string | number | undefined, pagePath: string): boolean {
  if (rowUrl === undefined) return false;
  const raw = String(rowUrl).trim().toLowerCase();
  if (!raw) return false;
  const withoutQuery = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  const target = pagePath.toLowerCase().replace(/\/+$/, "");
  return withoutQuery === target || withoutQuery.endsWith(target);
}

/** Collapse the multi-metric response into the handful of numbers rules use. */
export function extractSignals(
  metrics: ClarityMetricRow[],
  pagePath: string
): ClaritySignals {
  const signals: ClaritySignals = {
    capturedAt: new Date().toISOString(),
    pagePath,
    sessions: 0,
    scrollDepth: null,
    engagementTime: null,
    deadClicks: 0,
    rageClicks: 0,
    quickbacks: 0,
    errorClicks: 0,
    scriptErrors: 0,
    excessiveScroll: 0,
  };

  for (const metric of metrics) {
    const rows = (metric.information ?? []).filter((row) =>
      matchesPage(row.URL ?? row.Url ?? row.url, pagePath)
    );
    if (rows.length === 0) continue;

    const sum = (key: string) => rows.reduce((acc, r) => acc + num(r[key]), 0);
    // Session-weighted mean, so a low-traffic browser can't skew an average.
    const weightedMean = (key: string) => {
      let weight = 0;
      let total = 0;
      for (const row of rows) {
        const sessions = num(row.sessionsCount ?? row.totalSessionCount) || 1;
        const value = num(row[key]);
        if (value > 0) {
          total += value * sessions;
          weight += sessions;
        }
      }
      return weight > 0 ? total / weight : null;
    };

    switch (metric.metricName) {
      case "Traffic":
      case "PopularPages":
        signals.sessions = Math.max(
          signals.sessions,
          sum("totalSessionCount") || sum("sessionsCount") || sum("visitsCount")
        );
        break;
      case "ScrollDepth":
        signals.scrollDepth = weightedMean("averageScrollDepth");
        break;
      case "EngagementTime":
        signals.engagementTime = weightedMean("activeTime") ?? weightedMean("totalTime");
        break;
      case "DeadClickCount":
        signals.deadClicks = sum("subTotal") || sum("deadClickCount");
        break;
      case "RageClickCount":
        signals.rageClicks = sum("subTotal") || sum("rageClickCount");
        break;
      case "QuickbackClick":
        signals.quickbacks = sum("subTotal") || sum("quickbackClick");
        break;
      case "ErrorClickCount":
        signals.errorClicks = sum("subTotal") || sum("errorClickCount");
        break;
      case "ScriptErrorCount":
        signals.scriptErrors = sum("subTotal") || sum("scriptErrorCount");
        break;
      case "ExcessiveScroll":
        signals.excessiveScroll = sum("subTotal") || sum("excessiveScroll");
        break;
    }
  }

  return signals;
}
