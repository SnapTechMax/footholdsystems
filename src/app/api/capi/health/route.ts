import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { CAPI_CONFIGURED, sendCapiEvent } from "@/lib/meta-capi";

/**
 * Proves the Conversions API credentials actually work.
 *
 * Exists for the same reason /api/whop/health does: the failure it catches is
 * invisible. A wrong or expired token fails silently by design — analytics must
 * never break a request path — so the only evidence is a `[capi] ... rejected`
 * line in a function log nobody is watching, and a working setup and a broken
 * one look identical from outside. That ambiguity cost real time to sit in
 * during setup, which is what this removes.
 *
 * It sends a REAL event, because a request that does not leave the server
 * proves nothing about the credentials. But it sends a custom `HealthCheck`
 * event rather than Lead or Purchase, so running it can never add a conversion
 * to the numbers ad delivery optimises against. Pass ?test_event_code= from
 * Events Manager's Test Events tab to keep it out of the dataset entirely.
 *
 *   curl -u admin "https://www.footholdsystems.com/api/capi/health"
 *
 * Query parameters:
 *   test_event_code  optional. Routes the event to Test Events instead of the
 *                    live dataset.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One round trip to Meta, on an admin's click.
export const maxDuration = 30;

/**
 * Reads Meta's error code and says what it actually means.
 *
 * The first version asserted "code 190 is a bad token" on every failure,
 * including a 100 that had nothing to do with the credentials. A diagnostic
 * that guesses confidently is worse than one that says it does not know.
 */
function hintFor(error: string | undefined): string {
  if (!error) return "No detail returned. Check the function logs.";
  if (error.includes('"code":190')) {
    return "Code 190 is a bad or expired token. Regenerate it against this pixel: tokens are pixel-specific.";
  }
  if (error.includes("2804050")) {
    return "Meta needs customer information parameters to match an event. Real Lead and Purchase events send a hashed email and Meta's cookies, so this affects the health check only.";
  }
  if (error.includes('"code":100')) {
    return "Code 100 is a malformed parameter rather than a credentials problem. The message above names the field.";
  }
  return "See the error above. It is Meta's verbatim response.";
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  const env = {
    // Presence only. The token is a credential and does not belong in a
    // response body, even an authenticated one.
    META_CAPI_ACCESS_TOKEN: Boolean(process.env.META_CAPI_ACCESS_TOKEN),
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? null,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || "v25.0 (default)",
  };

  if (!CAPI_CONFIGURED) {
    return NextResponse.json(
      {
        ok: false,
        env,
        error:
          "Set META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_META_PIXEL_ID, then redeploy — Vercel snapshots environment variables when a build starts.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const testEventCode = request.nextUrl.searchParams.get("test_event_code")?.trim();

  // Meta rejects an event it cannot match to anybody: code 100, subcode
  // 2804050, "no customer information parameters". This check used to send an
  // empty user object and so always failed, which made a working token look
  // broken — the opposite of what a health check is for.
  //
  // The admin's own IP and user agent are real parameters and are what the
  // request already carries. No email is sent: hashing a made-up address to
  // satisfy a validator would put a fictional person into the match pool.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() || null : null;

  const result = await sendCapiEvent({
    eventName: "HealthCheck",
    // Timestamped so repeated checks are distinct events rather than Meta
    // deduplicating them against each other and reporting a false success.
    eventId: `healthcheck:${Date.now()}`,
    userData: { ip, userAgent: request.headers.get("user-agent") },
    ...(testEventCode ? { testEventCode } : {}),
  });

  return NextResponse.json(
    {
      ok: result.ok,
      env,
      sentTo: testEventCode ? "Test Events" : "live dataset (as a custom event)",
      meta: {
        status: result.status ?? null,
        eventsReceived: result.eventsReceived ?? null,
        fbtraceId: result.fbtraceId ?? null,
      },
      ...(result.error ? { error: result.error } : {}),
      hint: result.ok
        ? "eventsReceived 1 means Meta accepted it. Lead and Purchase use the same credentials and transport."
        : hintFor(result.error),
    },
    { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } }
  );
}
