import { NextRequest, NextResponse, after } from "next/server";
import { getScanByToken } from "@/lib/scan/db";
import { sendInitiateCheckout } from "@/lib/meta-capi";
import {
  DONE_FOR_YOU_PRICE_CENTS,
  SOLUTIONS_PRICE_CENTS,
  checkoutReturnUrl,
  reportUrl,
  siteUrl,
} from "@/lib/scan/pricing";
import { createCheckout } from "@/lib/scan/whop";
import { cleanRecipient, knownKey, recordClick } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Creating a checkout is a round trip to Whop, on the buyer's click.
export const maxDuration = 30;

/**
 * Sends a buyer to a Whop checkout created for them specifically.
 *
 * The indirection is not optional. Whop only accepts metadata on a checkout
 * created through the API, and the scan token carried in that metadata is the
 * only thing that tells the webhook which report to unlock. A direct link to
 * whop.com would take the money and leave the buyer locked out.
 *
 * The token in the URL is the scan's own public token, which is already the
 * credential for reading the report, so this exposes nothing new. A token that
 * does not resolve is sent to the homepage rather than told it was wrong.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = params.get("token")?.trim();
  const product =
    params.get("product") === "done_for_you" ? "done_for_you" : "solutions";

  if (!token) return NextResponse.redirect(siteUrl(), 302);

  const scan = await getScanByToken(token).catch(() => null);
  // Same treatment as an unknown report: no confirmation that a token is or is
  // not real, so this cannot be used to probe for valid ones.
  if (!scan) return NextResponse.redirect(siteUrl(), 302);

  // Present when the click came from an email rather than the report page.
  const campaign = (params.get("e") ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const emailKey = knownKey(campaign);
  if (emailKey) {
    try {
      await recordClick({
        emailKey,
        link: (params.get("c") || "checkout").slice(0, 60),
        recipient: cleanRecipient(params.get("r")) ?? scan.email,
      });
    } catch (error) {
      // Never worth losing a sale over. Logged and stepped past.
      console.error("[checkout] click not recorded:", error);
    }
  }

  /**
   * The server half of InitiateCheckout, and the reliable one.
   *
   * Fires here rather than only on the button because this route runs on the
   * click that actually reached us — no blocker in between, and no race with
   * the navigation that carries the buyer away from the page. BuyButton sends
   * the same event with the same derived id and Meta collapses the two.
   *
   * Placed before the Whop round trip, in `after()`, so it neither delays the
   * redirect nor depends on Whop cooperating. A checkout Whop refuses to create
   * is still a person who tried to buy, and for the $1,497 tier that is a
   * signal worth having either way — arguably more than the ones that succeed,
   * since it is also how a broken checkout becomes visible in the funnel rather
   * than as silence.
   */
  after(async () => {
    try {
      await sendInitiateCheckout({
        token: scan.token,
        product,
        valueCents:
          product === "done_for_you"
            ? DONE_FOR_YOU_PRICE_CENTS
            : SOLUTIONS_PRICE_CENTS,
        // An outreach scan's address is the internal row every one of them
        // hangs off, not a buyer's. Sending it would hash the same value onto
        // every cold-audit checkout and tell Meta they are one person.
        email: scan.outreach ? null : scan.email,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent"),
        // This click does come from a browser, so prefer its live cookies and
        // fall back to what was stored against the lead at scan time.
        fbp: request.cookies.get("_fbp")?.value ?? scan.fbp,
        fbc: request.cookies.get("_fbc")?.value ?? scan.fbc,
        sourceUrl: reportUrl(scan.token),
      });
    } catch (error) {
      console.error("[checkout] InitiateCheckout not sent:", error);
    }
  });

  const checkout = await createCheckout({
    product,
    // Read straight back by the webhook. scan_token is what unlocks the report;
    // the rest is for reconciliation when something looks wrong later.
    metadata: {
      scan_token: scan.token,
      product,
      // Same reason as above, and one more: the webhook falls back to this
      // address when a payment arrives with no token, and resolving it would
      // find whichever outreach scan ran last rather than this buyer's.
      ...(scan.outreach ? {} : { email: scan.email }),
      domain: scan.domain,
      ...(campaign ? { email_key: campaign } : {}),
    },
    // Carries the marker that lets the landing page fire the Purchase
    // conversion exactly once. See checkoutReturnUrl.
    redirectUrl: checkoutReturnUrl(scan.token, product),
  });

  if (!checkout.ok) {
    console.error(`[checkout] could not create for ${scan.domain}: ${checkout.reason}`);
    // Back to the report with a flag rather than to an error page. They came to
    // buy; the page they land on should be the one with the button on it.
    return NextResponse.redirect(`${reportUrl(scan.token)}?checkout=failed`, 302);
  }

  // 302, so a browser never caches a one-time checkout URL and sends the next
  // buyer to a configuration created for somebody else.
  return NextResponse.redirect(checkout.url, 302);
}
