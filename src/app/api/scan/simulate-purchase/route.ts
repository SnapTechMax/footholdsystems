import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { notifySale } from "@/lib/scan/alert";
import { sendPurchase } from "@/lib/meta-capi";
import { markConverted } from "@/lib/scan/converted";
import {
  findLatestScanForDomain,
  getScanByToken,
  initScanSchema,
  isPaid,
  recordPayment,
  removeSimulatedPayment,
  type OrderProduct,
} from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import {
  DONE_FOR_YOU_PRICE_CENTS,
  SOLUTIONS_PRICE_CENTS,
} from "@/lib/scan/pricing";

/**
 * Marks a purchase as paid without one, so the post-payment flow can be tested.
 *
 * WHY THIS EXISTS: the $1,497 path was silently broken for its entire life —
 * a plan title four characters too long meant no build could ever be bought —
 * and the only way to find out was to buy one. Everything downstream of the
 * webhook is still unproven for that tier: the /booked page in its paid state,
 * the kickoff block, the Purchase conversion at 1497, and `markConverted`,
 * which ends the nurture sequence and runs for `done_for_you` only. Verifying
 * those should not cost $1,497, and it should not cost $1,497 again the next
 * time that flow changes.
 *
 * WHAT IT DOES NOT TEST: Whop. Not the checkout, not the payment, not the
 * webhook signature. Everything after the webhook is fair game, including the
 * sales listing and the push, both of which take the same arguments here that
 * the webhook hands them in production. Those are covered — /api/whop/health proves checkout
 * creation, and a real $49 purchase proved delivery and verification end to
 * end. What was never exercised is the `done_for_you` branch after that point,
 * which is exactly what this covers.
 *
 * SAFETY. Admin-authenticated, since it grants paid access for free. Every row
 * it writes carries `provider: "simulated"`, so a test can never be mistaken
 * for revenue in the orders table, and `?undo=1` deletes only rows with that
 * provider — a real Whop order cannot be removed through here.
 *
 * The two side effects that reach outside this system are opt-in and off by
 * default, because both are expensive to get wrong: a fake conversion teaches
 * ad delivery a lie about what converts, and ending a sequence writes to a
 * real contact.
 *
 *   curl -u admin -X POST ".../api/scan/simulate-purchase?domain=example.com&product=done_for_you"
 *   curl -u admin -X POST "...&undo=1"
 *
 * Query parameters:
 *   token / domain  which scan. One is required.
 *   product         solutions | done_for_you. Defaults to done_for_you, the
 *                   one that needs testing.
 *   capi            1 to also send the server-side Purchase conversion. OFF by
 *                   default — see above.
 *   sequence        1 to also mark the contact converted in Resend, ending
 *                   their nurture run. OFF by default.
 *   push            1 to also send the Pushover notification, so the phone
 *                   alert can be proved without spending $1,497. The message
 *                   says SIMULATED. OFF by default.
 *   e               a batch tag, stored on the order exactly as a cold-email
 *                   sale would store it, so /admin/sales can be checked.
 *   undo            1 to delete the simulated payment so the test can be re-run.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  try {
    return await handle(request);
  } catch (error) {
    // Without this an unhandled throw returns a 500 with an empty body, which
    // from a terminal is indistinguishable from the command not running at all.
    // An admin debugging their own deployment should get the reason.
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[simulate-purchase] failed:", error);
    return NextResponse.json(
      { ok: false, error: reason },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const token = params.get("token")?.trim();
  const domainParam = params.get("domain")?.trim();
  const product: OrderProduct =
    params.get("product") === "solutions" ? "solutions" : "done_for_you";
  const withCapi = params.get("capi") === "1";
  const withSequence = params.get("sequence") === "1";
  const withPush = params.get("push") === "1";
  // Lets a test prove the batch tag survives all the way to the sales page,
  // which is otherwise only exercised by a real cold-email sale.
  const emailKey = params.get("e")?.trim() || null;
  const undo = params.get("undo") === "1";

  if (!token && !domainParam) {
    return NextResponse.json(
      { error: "Pass ?token= or ?domain= to say which scan." },
      { status: 400 }
    );
  }

  await initScanSchema();

  let scan;
  if (token) {
    scan = await getScanByToken(token);
  } else {
    const domain = normaliseDomain(domainParam!);
    if (!domain) {
      return NextResponse.json(
        { error: `Could not read "${domainParam}" as a domain.` },
        { status: 400 }
      );
    }
    scan = await findLatestScanForDomain(domain);
  }

  if (!scan) {
    return NextResponse.json(
      { error: "No completed scan found for that token or domain." },
      { status: 404 }
    );
  }

  const reportUrls = {
    report: `/scan/${scan.token}`,
    upsell: `/scan/${scan.token}/next`,
    booked: `/scan/${scan.token}/booked`,
  };

  if (undo) {
    const removed = await removeSimulatedPayment(scan.id, product);
    return NextResponse.json({
      undone: removed,
      product,
      domain: scan.domain,
      token: scan.token,
      note: removed
        ? "Simulated payment deleted. The pages are back to their unpaid state."
        : "Nothing to undo — no simulated payment for that scan and product. A real Whop order is never touched by this.",
      urls: reportUrls,
    });
  }

  const alreadyPaidBefore = await isPaid(scan.id, product).catch(() => false);

  const amountCents =
    product === "done_for_you" ? DONE_FOR_YOU_PRICE_CENTS : SOLUTIONS_PRICE_CENTS;

  const { alreadyPaid } = await recordPayment({
    scanId: scan.id,
    product,
    amountCents,
    // The marker that keeps a test out of the revenue figures.
    provider: "simulated",
    providerRef: `simulated:${scan.token}:${product}`,
    emailKey,
    metadata: { source: "simulated" },
  });

  /**
   * The push, opt-in like the rest.
   *
   * Off by default on the same principle as the others, but for a milder
   * reason: a push costs nothing and misleads nobody, it just buzzes a phone
   * for a sale that did not happen. It is worth having because it is the only
   * way to prove the notification path works without spending $1,497, and the
   * message says SIMULATED in its own body so a test can never be mistaken for
   * the real thing on a lock screen.
   */
  let push: unknown = "skipped (pass push=1 to send)";
  if (withPush) {
    await notifySale({
      domain: scan.domain,
      token: scan.token,
      product,
      amountCents,
      outreach: scan.outreach,
      emailKey,
      source: "simulated",
      simulated: true,
    });
    push = "sent";
  }

  let capi: unknown = "skipped (pass capi=1 to send)";
  if (withCapi) {
    capi = await sendPurchase({
      token: scan.token,
      product,
      valueCents: amountCents,
      email: scan.email,
    });
  }

  let sequence: unknown = "skipped (pass sequence=1 to run)";
  if (withSequence) {
    sequence = (await markConverted(scan.email))
      ? "contact marked converted"
      : "failed — see logs";
  }

  return NextResponse.json({
    ok: true,
    simulated: { product, amountCents, priceUsd: amountCents / 100 },
    domain: scan.domain,
    token: scan.token,
    alreadyPaidBefore,
    wroteNewOrder: !alreadyPaid,
    emailKey,
    push,
    capi,
    sequence,
    urls: reportUrls,
    next:
      product === "done_for_you"
        ? "Open the booked url to see the confirmation page. Add ?purchased=1 only if you want the browser Purchase conversion to fire too — without it the page renders without touching your pixel data."
        : "Open the upsell url to see the unlocked state.",
    undo: "Re-run this with &undo=1 to remove the simulated payment.",
  });
}
