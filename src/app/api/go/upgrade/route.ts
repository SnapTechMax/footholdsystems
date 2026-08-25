import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/scan/pricing";
import { createCheckout } from "@/lib/scan/whop";
import { CALENDLY_URL } from "@/lib/site";
import { cleanRecipient, knownKey, recordClick } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The upgrade link carried by all 22 nurture emails.
 *
 * Sibling of /api/go/checkout, and separate from it on purpose: those emails
 * are pushed to Resend as fixed templates, so this URL has to keep working
 * unchanged long after the code behind it moves. It also has no scan token to
 * work with, only who the email went to, which is why the metadata differs.
 *
 * Three rules, in order of importance:
 *
 *  1. **It always goes somewhere useful.** A checkout that cannot be created
 *     falls through to the booking page rather than an error, because a reader
 *     who clicked "start the full fix" should never land on a dead end.
 *  2. **The destination is never taken from the query string**, so no
 *     combination of parameters turns this into an open redirect.
 *  3. **Unknown campaign keys are dropped, not stored**, so a crawler cannot
 *     invent emails in the dashboard.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const campaign = (params.get("e") ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const emailKey = knownKey(campaign);
  const link = (params.get("c") || "cta-button").slice(0, 60);
  const recipient = cleanRecipient(params.get("r"));

  if (emailKey) {
    try {
      await recordClick({ emailKey, link, recipient });
    } catch (error) {
      console.error("Upgrade click not recorded:", error);
    }
  }

  const checkout = await createCheckout({
    product: "done_for_you",
    // No scan token exists in this flow, so the buyer's address is the join
    // key. The webhook falls back to matching on it, resolving to that
    // person's most recent scan.
    metadata: {
      product: "done_for_you",
      source: "sequence",
      ...(recipient ? { email: recipient } : {}),
      ...(campaign ? { email_key: campaign } : {}),
    },
    redirectUrl: siteUrl(),
  });

  if (!checkout.ok) {
    console.error(`[upgrade] could not create checkout: ${checkout.reason}`);
    // See rule 1. A booked call is a real conversion path and a far better
    // outcome than an error page for someone who just decided to buy.
    const fallback = new URL(CALENDLY_URL);
    fallback.searchParams.set("utm_source", "footholdsystems");
    fallback.searchParams.set("utm_medium", "email");
    fallback.searchParams.set("utm_campaign", campaign || "sequence");
    fallback.searchParams.set("utm_content", link);
    return NextResponse.redirect(fallback.toString(), 302);
  }

  // 302, never 301: a cached one-time checkout URL would send the next reader
  // to a configuration created for somebody else.
  return NextResponse.redirect(checkout.url, 302);
}
