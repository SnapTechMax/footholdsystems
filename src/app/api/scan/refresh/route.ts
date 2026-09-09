import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { getScanByToken, initScanSchema } from "@/lib/scan/db";
import { refreshScanJob } from "@/lib/scan/run";

/**
 * Re-runs a completed scan in place, keeping its token and its URL.
 *
 * For when the data behind a report someone already has is stale, or when a
 * fix on our side means their report should be regenerated. The alternative is
 * putting their email back through the capture form, which mints a new token,
 * gives them a second URL, and drops a duplicate report in their inbox.
 *
 * Behind the admin password, for two reasons: every request is a full crawl
 * of somebody's website, and an unauthenticated endpoint that regenerates
 * arbitrary customers' reports is not something to leave open.
 * `isAdminAuthorised` fails shut.
 *
 *   curl -u :$ADMIN_PASSWORD -X POST \
 *     "https://www.footholdsystems.com/api/scan/refresh?token=TOKEN"
 *
 * Query parameters:
 *   token  required. The scan to refresh, from its report URL.
 *   email  re-sends the report. Off unless asked: a refresh is usually us
 *          correcting our own copy, and a second identical email is worse for
 *          the recipient than a quietly updated page.
 *
 * Every refresh is a fresh crawl; there is no cache to bypass.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The scanner's own deadline is 75s; this has to outlast it.
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  const params = request.nextUrl.searchParams;
  const token = params.get("token")?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Pass ?token= from the report URL." },
      { status: 400 }
    );
  }

  try {
    await initScanSchema();
    const scan = await getScanByToken(token);
    if (!scan) {
      return NextResponse.json({ error: "No scan with that token." }, { status: 404 });
    }

    const result = await refreshScanJob(scan.id, {
      sendEmail: params.get("email") === "1",
    });

    if (result.status === "failed") {
      // 502, not 500: the failure is at the site being scanned, and the stored
      // report is untouched and still being served.
      return NextResponse.json(
        { error: result.reason, note: "The existing report is unchanged." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      domain: scan.domain,
      category: scan.category,
      scoreBefore: result.before,
      scoreAfter: result.after,
      emailed: result.emailed,
      // Unchanged by design. Stated in the response so it is obvious the link
      // the customer holds is still the right one.
      url: `/scan/${scan.token}`,
    });
  } catch (error) {
    console.error("[scan] refresh failed:", error);
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}
