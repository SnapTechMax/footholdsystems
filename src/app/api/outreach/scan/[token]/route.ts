import { NextRequest, NextResponse } from "next/server";
import { getScanByToken } from "@/lib/scan/db";
import { auditUrl } from "@/lib/scan/pricing";
import { runScanJob } from "@/lib/scan/run";
import { outreachAuthorised, unauthorised } from "../auth";

/**
 * Reads an outreach scan back.
 *
 * The caller polls this until `status` is "complete" and then has the two
 * things a cold email needs: the score, and the link to the report.
 *
 * Only outreach rows are readable here. A visitor's own scan of the same domain
 * is their private result — its token is their credential and it carries their
 * email address — so this refuses to serve one even to an authorised caller.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  if (!outreachAuthorised(request)) return unauthorised();

  const { token } = await context.params;
  const scan = await getScanByToken(token);
  if (!scan) {
    return NextResponse.json({ error: "No such scan." }, { status: 404 });
  }
  if (!scan.outreach) {
    return NextResponse.json(
      { error: "That token belongs to a visitor's own scan." },
      { status: 403 }
    );
  }

  // A queued row the sweeper has not reached yet can be run on demand, but only
  // when asked for: `run=1` is how a caller with its own pacing says it would
  // rather spend the wait than the ten minutes. Never automatic — that would
  // turn every poll into a live crawl against a burst limit shared with the
  // public form.
  const wanted = request.nextUrl.searchParams.get("run") === "1";
  let row = scan;
  if (wanted && (row.status === "queued" || row.status === "failed")) {
    await runScanJob(row.id).catch(() => null);
    row = (await getScanByToken(token)) ?? row;
  }

  return NextResponse.json(
    {
      token: row.token,
      domain: row.domain,
      status: row.status,
      // Null until the scan completes; the caller must not quote a blank.
      score: row.score,
      grade: row.grade,
      maxScore: row.report?.maxScore ?? null,
      error: row.error,
      attempts: row.attempts,
      auditUrl: auditUrl(row.token),
      completedAt: row.completedAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
