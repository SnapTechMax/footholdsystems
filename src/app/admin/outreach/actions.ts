"use server";

import { headers } from "next/headers";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { DEFAULT_CATEGORY, isBusinessCategory } from "@/lib/scan/categories";
import {
  createOutreachScan,
  findQueuedOutreachScans,
  initScanSchema,
  listOutreachScans,
  type OutreachScanSummary,
} from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import { auditUrl } from "@/lib/scan/pricing";
import { runScanJob } from "@/lib/scan/run";

/**
 * Queues and runs scans on prospects, for cold outbound.
 *
 * Authorised here rather than by the proxy, for the reason spelled out in
 * lib/admin-auth.ts: a Server Action is dispatched by an id in the
 * `Next-Action` header and does not have to arrive as a request to the route it
 * belongs to, so a matcher on `/admin` is not the boundary it looks like. This
 * one spends money at a third-party scanner on any domain it is handed, which
 * is exactly the kind of thing that must not be callable by a stranger.
 */

/** How many domains one submission may carry. */
const MAX_PER_SUBMIT = 15;

/**
 * How long to keep starting scans before handing the rest to the sweeper.
 *
 * The page declares maxDuration = 300, and a cold scan measured 13 to 25
 * seconds in the sweeper's own notes. Stopping at 200s leaves room for the
 * scan in flight to finish inside the budget rather than being killed halfway,
 * which would leave a `running` row for the sweeper to clean up ten minutes
 * later. Anything not started by then is still queued, still listed, and
 * running "Run the queued ones" again picks it straight back up.
 */
const RUN_BUDGET_MS = 200_000;

export interface QueuedScan {
  domain: string;
  token: string;
  url: string;
  reused: boolean;
}

export type QueueResult =
  | {
      ok: true;
      queued: QueuedScan[];
      /** Lines to show, one per input we could not use. */
      rejected: string[];
      /** How many finished during this request. The rest are still running. */
      ran: number;
      scans: OutreachScanSummary[];
    }
  | { ok: false; error: string };

/** Splits the textarea into candidate domains, deduped, in the order typed. */
function parseDomains(input: string): { domains: string[]; rejected: string[] } {
  const domains: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  // Split on anything a pasted list plausibly uses as a separator. A column
  // copied out of a spreadsheet arrives newline-separated; one pasted out of an
  // email arrives with commas and spaces in it.
  for (const raw of input.split(/[\s,;]+/)) {
    const candidate = raw.trim();
    if (!candidate) continue;

    const domain = normaliseDomain(candidate);
    if (!domain) {
      rejected.push(`${candidate} — not a website address we can read.`);
      continue;
    }
    // Two spellings of the same host is the most likely duplicate in a pasted
    // list, and normaliseDomain has already collapsed them.
    if (seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }

  return { domains, rejected };
}

/**
 * Queues a batch, then runs as many as fit in the budget.
 *
 * Every row is written before any scan runs. A submission that times out
 * halfway through still leaves the whole batch recorded, which is what makes
 * "Run the queued ones" a complete recovery rather than a partial one.
 */
export async function queueOutreachScans(input: {
  urls: string;
  category: string;
}): Promise<QueueResult> {
  if (!isAdminAuthorised((await headers()).get("authorization"))) {
    return { ok: false, error: "Not authorised." };
  }

  const { domains, rejected } = parseDomains(input.urls);
  if (domains.length === 0) {
    return {
      ok: false,
      error:
        rejected.length > 0
          ? `Nothing usable in that. ${rejected[0]}`
          : "Enter at least one website address.",
    };
  }

  if (domains.length > MAX_PER_SUBMIT) {
    return {
      ok: false,
      error: `That is ${domains.length} domains. Do ${MAX_PER_SUBMIT} at a time — the scanner is rate limited per minute for the whole site, and a bigger batch just queues behind itself.`,
    };
  }

  const category = isBusinessCategory(input.category)
    ? input.category
    : DEFAULT_CATEGORY;

  await initScanSchema();

  const queued: QueuedScan[] = [];
  const toRun: number[] = [];

  for (const domain of domains) {
    const scan = await createOutreachScan({
      domain,
      url: `https://${domain}`,
      category,
    });
    queued.push({
      domain,
      token: scan.token,
      url: auditUrl(scan.token),
      reused: scan.reused,
    });
    if (!scan.reused) toRun.push(scan.id);
  }

  const started = Date.now();
  let ran = 0;
  for (const id of toRun) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    try {
      const outcome = await runScanJob(id);
      if (outcome.status === "done") ran += 1;
    } catch (error) {
      // runScanJob records its own failures on the row, so this only catches
      // something it could not. Never rethrown: one bad domain in a batch of
      // ten must not lose the other nine.
      console.error(`[outreach] scan ${id} threw:`, error);
    }
  }

  return { ok: true, queued, rejected, ran, scans: await listOutreachScans() };
}

/**
 * Re-reads the list, and runs anything still waiting.
 *
 * Two jobs in one button on purpose. The only reason to refresh this page is to
 * find out whether the scans finished, and the only useful answer to "no" is to
 * carry on running them.
 */
export async function refreshOutreachScans(): Promise<
  | { ok: true; ran: number; scans: OutreachScanSummary[] }
  | { ok: false; error: string }
> {
  if (!isAdminAuthorised((await headers()).get("authorization"))) {
    return { ok: false, error: "Not authorised." };
  }

  await initScanSchema();

  const started = Date.now();
  let ran = 0;
  for (const scan of await findQueuedOutreachScans()) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    try {
      const outcome = await runScanJob(scan.id);
      if (outcome.status === "done") ran += 1;
    } catch (error) {
      console.error(`[outreach] scan ${scan.id} threw:`, error);
    }
  }

  return { ok: true, ran, scans: await listOutreachScans() };
}
