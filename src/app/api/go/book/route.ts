import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/scan/pricing";
import { cleanRecipient, knownKey, recordClick } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Booking links in the nurture sequence point here rather than at Calendly.
 *
 * Two jobs, and it is still needed for both even though Resend now reports
 * clicks of its own through /api/resend/webhook.
 *
 * It logs the click server-side, where nothing can block it and it does not
 * depend on Resend's tracking staying switched on. And — the load-bearing part
 * — it is what puts utm_campaign on the *Calendly* URL. Calendly echoes those
 * parameters back in its webhook, which is the only thing tying a booked call
 * to the email that caused it. Point these links straight at Calendly and the
 * click survives in email_events while the booking attribution does not.
 *
 * Three rules this endpoint follows, in order of importance:
 *
 *  1. **It always redirects.** A database that is down, unconfigured, or slow
 *     must not cost a booking. Recording is attempted, and any failure is
 *     swallowed after logging.
 *  2. **The destination is a constant.** Built from siteUrl(), never from the
 *     query string, so no combination of parameters turns this into an open
 *     redirect pointing somewhere else.
 *
 * This route existed to reach the pre-sale booking call, which is gone: nothing
 * is sold through a calendar before a purchase any more. It stays because links
 * to it are already sitting in inboxes, and a 404 for one of those is worse
 * than a landing page. The click is still recorded, so the dashboard keeps its
 * history rather than developing a hole.
 *  3. **Unknown keys are dropped, not stored.** `e` is checked against the
 *     sequence, so a crawler hitting this with junk cannot invent emails in the
 *     dashboard.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Narrowed before it goes anywhere near an outbound URL. It is echoed into
  // utm_campaign below, so it is capped and restricted to the characters a
  // campaign name actually uses rather than passed through as given.
  const rawCampaign = (params.get("e") ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const emailKey = knownKey(rawCampaign);
  const link = (params.get("c") || "cta-button").slice(0, 60);
  const recipient = cleanRecipient(params.get("r"));

  // Built here rather than taken from the request. See rule 2 above.
  const destination = new URL(siteUrl());
  destination.searchParams.set("utm_source", "footholdsystems");
  destination.searchParams.set("utm_medium", "email");
  // The campaign name is forwarded as sent, not as the normalised key, so GA4
  // and Calendly keep the naming they already report on. Calendly echoes it back
  // in the webhook payload and the same normalising happens there, which is the
  // other half of the attribution — without utm_campaign a booking has no email
  // to belong to.
  destination.searchParams.set("utm_campaign", rawCampaign || "sequence");
  destination.searchParams.set("utm_content", link);

  if (emailKey) {
    try {
      await recordClick({ emailKey, link, recipient });
    } catch (error) {
      console.error("Booking click not recorded:", error);
    }
  }

  // 302, not 301. A permanent redirect would be cached by the browser and every
  // later click on the same link would skip this endpoint entirely, silently
  // ending the click record for that person.
  return NextResponse.redirect(destination.toString(), 302);
}
