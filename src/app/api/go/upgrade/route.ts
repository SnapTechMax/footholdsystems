import { NextRequest, NextResponse } from "next/server";
import { DONE_FOR_YOU_PRICE_CENTS } from "@/lib/scan/pricing";
import { CALENDLY_URL } from "@/lib/site";
import { cleanRecipient, knownKey, recordClick } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Upgrade links in the nurture sequence point here rather than straight at Whop.
 *
 * Same shape and the same three rules as /api/go/book, which this is the
 * sibling of. It logs the click server-side where nothing can block it, and it
 * is what puts utm_campaign on the outbound URL so a purchase can be traced
 * back to the email that caused it.
 *
 *  1. **It always redirects.** A database that is down, unconfigured or slow
 *     must not cost a sale. Recording is attempted, and any failure is
 *     swallowed after logging.
 *  2. **The destination is a constant.** Built from environment, never from the
 *     query string, so no combination of parameters turns this into an open
 *     redirect.
 *  3. **Unknown keys are dropped, not stored.** `e` is checked against the
 *     sequence, so a crawler hitting this with junk cannot invent emails in the
 *     dashboard.
 *
 * FALLBACK: with WHOP_CHECKOUT_URL_DONE_FOR_YOU unset this sends people to the
 * booking page instead. That is deliberate. The sequence has twenty-two emails
 * pointing here and it has to work the day it is switched on, whether or not
 * Whop is connected yet, and a call is a real conversion path that already
 * exists. The alternative is twenty-two dead buttons.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const rawCampaign = (params.get("e") ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const emailKey = knownKey(rawCampaign);
  const link = (params.get("c") || "cta-button").slice(0, 60);
  const recipient = cleanRecipient(params.get("r"));

  const configured = process.env.WHOP_CHECKOUT_URL_DONE_FOR_YOU;

  let destination: URL;
  try {
    // See rule 2. Parsed rather than trusted, so a malformed variable degrades
    // to the booking page rather than throwing on a live click.
    destination = new URL(configured || CALENDLY_URL);
  } catch {
    destination = new URL(CALENDLY_URL);
  }

  destination.searchParams.set("utm_source", "footholdsystems");
  destination.searchParams.set("utm_medium", "email");
  destination.searchParams.set("utm_campaign", rawCampaign || "sequence");
  destination.searchParams.set("utm_content", link);

  if (configured) {
    // Whop passes metadata through to the webhook untouched, which is what lets
    // a completed purchase be tied back to the person and the email. There is no
    // scan token in this flow, so the email key is the identifier.
    destination.searchParams.set("metadata[product]", "done_for_you");
    destination.searchParams.set("metadata[source]", "sequence");
    if (rawCampaign) {
      destination.searchParams.set("metadata[email_key]", rawCampaign);
    }
    if (recipient) {
      destination.searchParams.set("metadata[email]", recipient);
    }
    destination.searchParams.set(
      "metadata[amount_cents]",
      String(DONE_FOR_YOU_PRICE_CENTS)
    );
  }

  if (emailKey) {
    try {
      await recordClick({ emailKey, link, recipient });
    } catch (error) {
      console.error("Upgrade click not recorded:", error);
    }
  }

  // 302, not 301. A permanent redirect would be cached by the browser and every
  // later click on the same link would skip this endpoint entirely, silently
  // ending the click record for that person.
  return NextResponse.redirect(destination.toString(), 302);
}
