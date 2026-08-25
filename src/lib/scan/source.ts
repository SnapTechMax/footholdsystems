import "server-only";
import { streamScan } from "./is-agentic";
import { getCachedScore, runScan } from "./ora";
import type { OraScan } from "./types";

/**
 * Decides where a scan actually comes from.
 *
 * Two providers run the same scanner and return the same payload, with
 * different meters on them:
 *
 *   Is Agentic  — Vercel's proxy. Burst-limited to 10/min per IP, no daily
 *                 quota, because Vercel pays Ora behind a partner key.
 *   Ora direct  — 10/min per IP *and* 30 scans per rolling 24h, shared across
 *                 our whole deployment because Vercel gives us one outbound IP.
 *
 * So Is Agentic goes first on every path that a stranger can trigger, and Ora
 * sits underneath as the thing that still works if the proxy changes shape.
 * Ora's endpoint is the documented, version-pinned one; Is Agentic's streaming
 * endpoint is not documented at all (see is-agentic.ts). Preferring the
 * undocumented one is a deliberate trade: it is the only one that can serve the
 * public form at volume, and the documented one is right there if it breaks.
 *
 * Both return `OraScan`, so nothing downstream — report building, the paywall
 * split, the email — knows or cares which one answered.
 */

/**
 * Logs why a provider was skipped.
 *
 * Worth its own function because a silent fallback is the failure mode that
 * costs the most: Is Agentic could start 404ing tomorrow and everything would
 * keep working, slower and quota-bound, until the day the quota ran out and the
 * form started failing for no visible reason. This is the line that says why.
 */
function noteFallback(provider: string, error: unknown): void {
  console.warn(
    `Scan: ${provider} failed, falling back —`,
    error instanceof Error ? error.message : String(error)
  );
}

/**
 * Gets a scan for the public form.
 *
 * Is Agentic first, because this is the path a stranger triggers and the one
 * that used to run out of quota. Its stream serves a stored result when it has
 * a recent one and runs a live crawl when it does not, so there is no separate
 * cache read to do here.
 *
 * The Ora fallback is cache-first on purpose. If we are here at all, Is Agentic
 * is already broken, and the daily ceiling is suddenly the whole budget again —
 * spending a scan on a domain Ora can answer for free would be the wrong way to
 * start a bad day.
 */
export async function scanDomain(domain: string): Promise<OraScan> {
  try {
    return await streamScan(domain);
  } catch (error) {
    noteFallback("Is Agentic", error);
  }

  const cached = await getCachedScore(domain).catch(() => null);
  if (cached && cached.analysisStatus !== "stuck") return cached;

  return runScan(domain);
}

/**
 * Re-runs a scan for a report we already hold.
 *
 * Never reads a cache on either provider: a refresh that hands back the number
 * we already have is not a refresh.
 *
 * The provider order flips on `force`. Ora documents `force=1` and enforces it
 * against a separate six-a-day budget, so when an admin has explicitly asked to
 * bypass freshness, the provider that guarantees it goes first. Is Agentic
 * accepts the parameter and may well honour it, but "may well" is not what
 * force is for. Without `force` the order is the usual one, since an unmetered
 * re-scan is worth more than a documented one.
 */
export async function rescanDomain(
  domain: string,
  options: { force?: boolean } = {}
): Promise<OraScan> {
  if (options.force) {
    try {
      return await runScan(domain, { force: true });
    } catch (error) {
      noteFallback("Ora (forced)", error);
      return streamScan(domain, { force: true });
    }
  }

  try {
    return await streamScan(domain);
  } catch (error) {
    noteFallback("Is Agentic", error);
    return runScan(domain);
  }
}
