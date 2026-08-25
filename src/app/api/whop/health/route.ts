import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { WHOP_CONFIGURED, createCheckout } from "@/lib/scan/whop";

/**
 * Proves the Whop credentials and permissions actually work.
 *
 * Exists because the failure it catches is invisible in production: a checkout
 * that cannot be created shows a visitor a generic error, and the reason, which
 * is almost always a missing permission, only appears in a function log nobody
 * is watching. This surfaces it on demand.
 *
 * It creates a real checkout configuration at the real price and throws the URL
 * away. That is the only way to prove the permission set, since a read-only
 * call would exercise different scopes from the one that matters. Nothing is
 * charged: a configuration nobody visits is inert, and it is marked in its own
 * metadata as a health check so it is obvious in the dashboard.
 *
 *   curl -u :$ADMIN_PASSWORD https://www.footholdsystems.com/api/whop/health
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  const env = {
    WHOP_API_KEY: Boolean(process.env.WHOP_API_KEY),
    WHOP_ACCOUNT_ID: Boolean(process.env.WHOP_ACCOUNT_ID),
    // Not used by this check, but the thing most likely to be forgotten, and a
    // health endpoint that stays silent about it is doing half a job.
    WHOP_WEBHOOK_SECRET: Boolean(process.env.WHOP_WEBHOOK_SECRET),
  };

  if (!WHOP_CONFIGURED) {
    return NextResponse.json(
      { ok: false, env, error: "Set WHOP_API_KEY and WHOP_ACCOUNT_ID, then redeploy." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = await createCheckout({
    product: "solutions",
    metadata: { source: "health-check", note: "not a real purchase" },
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        env,
        error: result.reason,
        // The permission set is the usual cause and the list is not guessable,
        // so it is repeated here rather than left in a commit message.
        requiredPermissions: [
          "checkout_configuration:create",
          "plan:create",
          "access_pass:create",
          "access_pass:update",
          "checkout_configuration:basic:read",
        ],
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      env,
      created: { configId: result.configId, planId: result.planId },
      checkoutUrl: result.url,
      note: "A real checkout configuration was created and left unpaid. Nothing was charged.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
