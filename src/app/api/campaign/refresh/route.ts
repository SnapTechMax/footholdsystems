import { NextRequest, NextResponse } from "next/server";
import { refreshCampaignSnapshot } from "@/lib/campaign";

export const dynamic = "force-dynamic";
// The fan-out is roughly 53 Resend requests, four at a time, and can be slowed
// further by the retry ladder when it meets the 10/second team limit. The
// default 10s would kill it partway through and store nothing.
export const maxDuration = 60;

/**
 * Recomputes the stored campaign snapshot, on a schedule.
 *
 * The admin pages read a snapshot rather than rebuilding sequence progress on
 * every load — see lib/campaign.ts for why that cost seconds a time. Something
 * has to fill it, and this is the thing.
 *
 * Authorised with CRON_SECRET, the same way /api/cro/tick is. Not because the
 * figures are sensitive, but because this burns Resend rate limit and anyone
 * could otherwise hold the dashboard's own refresh hostage by hammering it.
 */
function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

async function run(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: process.env.CRON_SECRET
          ? "Unauthorised."
          : "CRON_SECRET is not set, so the snapshot cannot be refreshed.",
      },
      { status: 401 }
    );
  }

  try {
    const stats = await refreshCampaignSnapshot();
    return NextResponse.json({
      ok: true,
      fetchedAt: stats.fetchedAt,
      runs: stats.runs.total,
      unreadableRuns: stats.unreadableRuns,
      // Surfaced rather than swallowed. These are the misconfigurations the
      // dashboard shows in its "needs attention" box, and a scheduled run is
      // the first place they would appear.
      errors: stats.errors,
    });
  } catch (error) {
    console.error("Campaign snapshot refresh failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
