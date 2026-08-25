import "server-only";
import type { OraCheck, OraLayer, OraScan } from "./types";

/**
 * Client for the Ora agent-readiness API (https://ora.ai/docs).
 *
 * Reads are keyless, which is why there is no credential check here and no
 * "not configured" branch — the scan works on a bare install. `ORA_API_KEY` is
 * only consulted for the write path, and is optional.
 *
 * WHAT THIS ACTUALLY MEASURES, because it is easy to oversell: Ora scores how
 * ready a site is for AI *agents* — discovery catalogs, OpenAPI specs, MCP
 * support, machine-readable payments. It is not a measure of how often ChatGPT
 * recommends a business by name. The one check that comes close
 * ("agentic-search-usecase", category share of voice) is in beta and currently
 * returns `na`. Anything the report says has to stay inside what this can
 * actually see.
 */

const BASE_URL = process.env.ORA_API_BASE_URL || "https://ora.ai";

/**
 * Ora's own rate limits: 10 req/min per IP, 30 scans per rolling 24h, and only
 * 6 of those may be `force`. On Vercel the outbound IP is shared across the
 * whole deployment, so those are effectively *our* global limits, not
 * per-customer ones. Never send `force` from the request path — it would let
 * thirty visitors exhaust a day's budget before lunch.
 */
const SCAN_TIMEOUT_MS = 60_000;

export class OraError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Seconds Ora asked us to wait, from its Retry-After header. */
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "OraError";
  }
}

/** True when retrying later is likely to work — rate limits and 5xx, not 4xx. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof OraError)) return true; // network/abort: worth a retry
  if (error.status === 429) return true;
  return error.status !== undefined && error.status >= 500;
}

/**
 * Normalises whatever someone typed into a bare hostname.
 *
 * People paste "https://www.example.com/contact?utm=x", type "example.com", or
 * type "Example.COM ". Ora keys its cache on the domain, so sending three
 * spellings of one site would be three scans against a 30/day budget.
 *
 * Returns null rather than throwing: the caller turns that into a field-level
 * validation message, and an exception here would be caught as a server error.
 */
export function normaliseDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let host: string;
  try {
    const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  // Strip a leading www. so www.x.com and x.com are one cache entry, not two.
  host = host.replace(/^www\./, "");

  // Must look like a real public hostname: at least one dot, a plausible TLD,
  // and no characters that have no business in one.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  if (!/\.[a-z]{2,}$/.test(host)) return null;

  // Nobody is buying AEO for localhost, and scanning internal hosts from our
  // server is a request-forgery shape we simply decline to have.
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return null;
  }

  return host;
}

/* ── parsing ──────────────────────────────────────────────────────────────── */

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseCheck(raw: unknown): OraCheck | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const id = asString(c.id);
  const name = asString(c.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    description: asString(c.description),
    // Anything we don't recognise becomes "error" rather than being trusted —
    // an unknown status must never be counted as a pass.
    status:
      c.status === "pass" ||
      c.status === "fail" ||
      c.status === "warning" ||
      c.status === "na" ||
      c.status === "error"
        ? c.status
        : "error",
    score: asNumber(c.score),
    maxScore: asNumber(c.maxScore),
    details: asString(c.details),
    recommendation: asString(c.recommendation),
    bonus: c.bonus === true,
    specUrl: asString(c.specUrl),
    maturity: asString(c.maturity),
    tier:
      c.tier === "required" || c.tier === "recommended" || c.tier === "emerging"
        ? c.tier
        : undefined,
    estScoreGain: typeof c.estScoreGain === "number" ? c.estScoreGain : undefined,
  };
}

function parseLayer(raw: unknown): OraLayer | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  const id = asString(l.id);
  const name = asString(l.name);
  if (!id || !name) return null;

  const checks = Array.isArray(l.checks)
    ? l.checks.map(parseCheck).filter((c): c is OraCheck => c !== null)
    : [];

  return {
    id,
    name,
    description: asString(l.description),
    checks,
    score: asNumber(l.score),
    maxScore: asNumber(l.maxScore),
  };
}

/**
 * Validates and narrows a raw Ora payload.
 *
 * Throws rather than returning a partial object: a scan with no score and no
 * layers is not a degraded report, it is nothing, and emailing someone a report
 * built from an unrecognised payload is worse than telling them it failed.
 */
export function parseOraScan(raw: unknown): OraScan {
  if (!raw || typeof raw !== "object") {
    throw new OraError("Ora returned a response that was not an object");
  }
  const r = raw as Record<string, unknown>;

  const domain = asString(r.domain);
  if (!domain) throw new OraError("Ora response had no domain");

  const layers = Array.isArray(r.layers)
    ? r.layers.map(parseLayer).filter((l): l is OraLayer => l !== null)
    : [];
  if (layers.length === 0) {
    throw new OraError("Ora response contained no layers to report on");
  }

  return {
    domain,
    url: asString(r.url) ?? `https://${domain}`,
    finalUrl: asString(r.finalUrl),
    score: asNumber(r.score),
    maxScore: asNumber(r.maxScore, 100),
    grade: asString(r.grade) ?? "F",
    ctaMessage: asString(r.ctaMessage),
    ctaTier: asString(r.ctaTier),
    layers,
    scannedAt: asString(r.scannedAt) ?? new Date().toISOString(),
    durationMs: typeof r.durationMs === "number" ? r.durationMs : undefined,
    agenticSummary: asString(r.agenticSummary),
    category: asString(r.category),
    analysisStatus: asString(r.analysisStatus),
    pendingChecks: Array.isArray(r.pendingChecks) ? r.pendingChecks : [],
  };
}

/* ── requests ─────────────────────────────────────────────────────────────── */

async function request(path: string, init: RequestInit): Promise<unknown> {
  const key = process.env.ORA_API_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...init.headers,
      },
      // These are live third-party scans; a cached response would report on a
      // site as it was, not as it is.
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new OraError(`Ora did not respond within ${SCAN_TIMEOUT_MS / 1000}s`);
    }
    throw new OraError(
      `Could not reach Ora: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  clearTimeout(timer);

  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    // Body first, status second: Ora puts the useful reason in the body and we
    // want it in the logs, but never in anything shown to a customer.
    const body = await response.text().catch(() => "");
    throw new OraError(
      `Ora responded ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
    );
  }

  return response.json();
}

/**
 * Runs a fresh scan.
 *
 * `force` is deliberately not exposed. Ora allows six cache-bypassing scans per
 * day across our whole deployment, and burning them on the public form would
 * mean the seventh visitor of the day gets an error instead of a report. A
 * cached result that is a few hours old is a perfectly good report.
 */
export async function runScan(
  domain: string,
  options: { force?: boolean } = {}
): Promise<OraScan> {
  const raw = await request("/api/scan", {
    method: "POST",
    // `force` bypasses Ora's own freshness cache and is capped at six per
    // rolling 24 hours across our whole deployment. Never set from the request
    // path; the admin refresh is the only caller allowed to ask for it, and it
    // still has to be asked for explicitly.
    body: JSON.stringify(
      options.force ? { url: domain, force: true } : { url: domain }
    ),
  });
  return parseOraScan(raw);
}

/** Reads a cached score without spending a scan. */
export async function getCachedScore(domain: string): Promise<OraScan | null> {
  try {
    const raw = await request(`/api/score/${encodeURIComponent(domain)}`, {
      method: "GET",
    });
    return parseOraScan(raw);
  } catch (error) {
    // A miss is a 404 and is not an error worth propagating — the caller just
    // runs a real scan instead.
    if (error instanceof OraError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Cache first, scan second.
 *
 * Every cache hit is a scan we did not spend against the 30/day ceiling, and
 * for a report that is emailed rather than watched live the freshness
 * difference is not something the customer can perceive.
 */
export async function scanDomain(domain: string): Promise<OraScan> {
  const cached = await getCachedScore(domain).catch(() => null);
  if (cached && cached.analysisStatus !== "stuck") return cached;
  return runScan(domain);
}
