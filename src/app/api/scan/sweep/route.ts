import { NextRequest, NextResponse } from "next/server";
import {
  findStuckScans,
  findUnemailedScans,
  initScanSchema,
} from "@/lib/scan/db";
import { runScanJob, sendReportEmail } from "@/lib/scan/run";

/**
 * Recovery sweep for scans that `after()` never finished.
 *
 * Two failure shapes, both of which look identical to a waiting customer:
 * a scan that was queued and never picked up (the invocation died first), and
 * a scan that completed and stored but whose email never sent (Resend was
 * down). The first costs an Ora call to redo, the second does not — so they
 * are handled separately rather than by re-running everything.
 *
 * Driven from .github/workflows/scan-sweep.yml every 10 minutes, not from
 * vercel.json: the Hobby plan allows one cron run a day and fails the whole
 * deployment on anything finer, and that daily allowance is already spent on
 * /api/cro/tick. Authorises the same way either would, so it can be moved back
 * without touching this file.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * How many scans one sweep will run.
 *
 * Was 3, sized so a sweep could not exhaust Ora's 30-a-day on retries. Scans no
 * longer come off that budget, and 3 every ten minutes is too slow to be a
 * safety net: it recovers eighteen scans an hour, which a single advertising
 * spike can outrun. The number is now set by the two things that actually bind.
 *
 * Wall clock: maxDuration is 300s, a cold scan measured 13-25s, and the email
 * pass ahead of this one takes a few seconds. Eight sequential scans is roughly
 * 200s at the slow end, leaving real headroom.
 *
 * Provider burst: 10 a minute for the whole deployment. Run sequentially, eight
 * scans take about two minutes, so a sweep on its own sits at roughly four a
 * minute and leaves room for the request path to keep scanning alongside it.
 */
const MAX_RESCANS_PER_SWEEP = 8;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fails shut. An unauthenticated endpoint that spends money on a third-party
  // API is not something to leave open because a variable is missing.
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  // Vercel Cron sends the same header; the query form is for manual runs.
  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: "Not authorised." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  await initScanSchema();

  const results = { rescanned: 0, reEmailed: 0, failures: [] as string[] };

  // Emails first: cheapest to retry and the most likely thing to be stuck.
  for (const scan of await findUnemailedScans(10)) {
    if (!scan.report) continue;
    const sent = await sendReportEmail({ ...scan, report: scan.report });
    if (sent.ok) results.reEmailed += 1;
    else results.failures.push(`email ${scan.id}: ${sent.reason}`);
  }

  for (const scan of await findStuckScans(MAX_RESCANS_PER_SWEEP)) {
    const outcome = await runScanJob(scan.id);
    if (outcome.status === "done") results.rescanned += 1;
    else if (outcome.status === "failed") {
      results.failures.push(`scan ${scan.id}: ${outcome.reason}`);
    }
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
