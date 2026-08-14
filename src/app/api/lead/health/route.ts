import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { PUSHOVER_CONFIGURED } from "@/lib/pushover";
import { SHEETS_CONFIGURED, sheetsHealth } from "@/lib/sheets";

// Same reason as the POST route: googleapis needs Node crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is the lead pipeline actually connected?
 *
 * Exists so the Google credentials can be proved without posting a fake lead
 * into the sheet and then having to delete the row. It reads; it never writes.
 *
 * Behind the same basic auth as the admin dashboard, for two reasons: the row
 * count is business data, and an unauthenticated endpoint that makes two Google
 * API calls per request is a free way for someone else to spend our quota.
 * `isAdminAuthorised` fails shut, so with ADMIN_PASSWORD unset this returns 401
 * rather than opening up.
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  if (!SHEETS_CONFIGURED) {
    return NextResponse.json(
      {
        ok: false,
        sheets: "not configured",
        // Named individually so the answer is which one to go and set, rather
        // than "something about Google".
        missing: [
          !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          !process.env.GOOGLE_PRIVATE_KEY && "GOOGLE_PRIVATE_KEY",
          !process.env.GOOGLE_SHEET_ID && "GOOGLE_SHEET_ID",
        ].filter(Boolean),
        pushover: PUSHOVER_CONFIGURED ? "configured" : "not configured",
      },
      { status: 503 }
    );
  }

  try {
    const health = await sheetsHealth();
    return NextResponse.json({
      ok: true,
      sheets: "connected",
      ...health,
      pushover: PUSHOVER_CONFIGURED ? "configured" : "not configured",
      resend: process.env.RESEND_API_KEY ? "configured" : "not configured",
      alertEmail: process.env.ALERT_EMAIL ? "configured" : "not configured",
    });
  } catch (error) {
    // The message is the useful part and it is usually specific — a 403 names
    // the service account that was refused, a 400 names the range it could not
    // find. Passed through rather than flattened into "failed".
    const message = error instanceof Error ? error.message : String(error);
    console.error("Sheets health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        sheets: "error",
        error: message,
        hint:
          "The usual causes: the spreadsheet was never shared with the service account (share it as Editor), " +
          "the tab is not named exactly 'Lead gen master', or GOOGLE_PRIVATE_KEY lost its newlines.",
        pushover: PUSHOVER_CONFIGURED ? "configured" : "not configured",
      },
      { status: 502 }
    );
  }
}
