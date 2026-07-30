import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/cro/engine";
import { DATABASE_CONFIGURED } from "@/lib/cro/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled entry point for the optimiser, driven by the cron in vercel.json.
 *
 * Vercel signs cron invocations with CRON_SECRET when it is set; the same
 * secret authorises a manual run from the dashboard. Without it the endpoint
 * refuses to do anything, since anyone could otherwise burn the Clarity quota.
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
          : "CRON_SECRET is not set, so the optimiser cannot be triggered.",
      },
      { status: 401 }
    );
  }

  if (!DATABASE_CONFIGURED) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not set." },
      { status: 503 }
    );
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await tick({ force });
  return NextResponse.json(result, {
    status: result.status === "error" ? 500 : 200,
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
