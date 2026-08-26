import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
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
 * webhook signature. Those are covered — /api/whop/health proves checkout
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

  const params = request.nextUrl.searchParams;
  const token = params.get("token")?.trim();
  const domainParam = params.get("domain")?.trim();
  const product: OrderProduct =
    params.get("product") === "solutions" ? "solutions" : "done_for_you";
  const withCapi = params.get("capi") === "1";
  const withSequence = params.get("sequence") === "1";
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
  });

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
