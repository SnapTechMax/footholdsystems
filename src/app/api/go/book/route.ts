import { NextRequest, NextResponse } from "next/server";
import { CALENDLY_URL } from "@/lib/site";
import { cleanRecipient, knownKey, recordClick } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Booking links in the nurture sequence point here rather than at Calendly.
 *
 * The redirect exists to log the click server-side. Resend reports no click
 * data for automations and the UTM parameters alone only reach GA4, which
 * cannot be joined to a booking. One row written here, plus the matching
 * Calendly webhook, is what makes "which email produced this call" answerable.
 *
 * Three rules this endpoint follows, in order of importance:
 *
 *  1. **It always redirects.** A database that is down, unconfigured, or slow
 *     must not cost a booking. Recording is attempted, and any failure is
 *     swallowed after logging.
 *  2. **The destination is a constant.** It is built from CALENDLY_URL, never
 *     from the query string, so no combination of parameters turns this into an
 *     open redirect pointing somewhere else.
 *  3. **Unknown keys are dropped, not stored.** `e` is checked against the
 *     sequence, so a crawler hitting this with junk cannot invent emails in the
 *     dashboard.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const emailKey = knownKey(params.get("e"));
  const link = (params.get("c") || "cta-button").slice(0, 60);
  const recipient = cleanRecipient(params.get("r"));

  // Built here rather than taken from the request. See rule 2 above.
  const destination = new URL(CALENDLY_URL);
  destination.searchParams.set("utm_source", "footholdsystems");
  destination.searchParams.set("utm_medium", "email");
  // Calendly echoes these back in the webhook payload, which is the other half
  // of the attribution — without utm_campaign the booking has no email to
  // belong to.
  destination.searchParams.set("utm_campaign", emailKey ?? "sequence");
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
