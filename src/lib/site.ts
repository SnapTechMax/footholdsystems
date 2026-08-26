// Shared site-wide constants.

/**
 * The one destination on the sales page.
 *
 * Every CTA points here. Kept in one place because there are a dozen of them
 * down the page and a typo in any single one produces a button that silently
 * does nothing on a page people are being paid to visit.
 */
export const SCAN_ANCHOR = "#scan";

// The dedicated event type carrying the rolling 7-day / 1–4pm Pacific window.
// This is the PRE-SALE call: twenty minutes, for someone deciding.
export const CALENDLY_URL =
  "https://calendly.com/max-snaptechrepair/20-minute-ai-strategy-call";

/**
 * The POST-SALE kickoff. Thirty minutes, and a different event type entirely.
 *
 * Separate because the copy on that page promises "not a pitch — you have
 * already bought", and sending a customer who paid sixty seconds ago to a page
 * headed "20 Minute AI Strategy Call" reads as exactly the sales call the
 * sentence just said it was not. It is also longer, because it is real work:
 * positioning, which listings we need, what the second domain is called.
 */
export const CALENDLY_KICKOFF_URL =
  "https://calendly.com/maximilian-footholdsystems/30min";

/**
 * Where lead capture sends people once delivery has happened.
 *
 * ORPHANED PENDING THE SCAN BUILD. This pointed at `/guide/thanks`, which went
 * away with the rest of the 5 Levels funnel. Nothing on the site posts to the
 * lead API right now, so nothing reaches a 404 — but the scan form is going to
 * need a thank-you page, and this constant is where it gets named. Build the
 * route before shipping the form, not after.
 */
export const THANKS_PATH = "/scan/thanks";

/**
 * Postal address, shown on the privacy policy and in the site footer.
 *
 * The same address the delivery email prints for CAN-SPAM, kept here so the two
 * cannot drift — an address that differs between the emails and the site is
 * worse than one that appears in only one of them. Meta's ad review also treats a
 * contactable business address on a lead-capture landing page as a trust signal.
 * If the business moves, this constant and `BRAND_ADDRESS` in
 * `src/app/api/lead-magnet/route.ts` move together.
 */
export const BUSINESS_ADDRESS =
  "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";

/**
 * Wording beside the marketing consent checkbox.
 *
 * Lives here rather than in lib/consent.ts because that module is server-only
 * and the form is a client component. Both import this one, so the wording shown
 * to someone and the wording stored against their consent cannot drift apart —
 * which is the only thing that makes the stored record worth anything.
 */
export const CONSENT_TEXT =
  "Yes, send me my scan results and occasional AI visibility tips. Unsubscribe any time.";

/**
 * Shown where consent has to be a free choice, so the deliverable cannot be
 * presented as conditional on it. Both wordings are stored verbatim with the
 * consent record, which is how the difference stays provable later.
 */
export const CONSENT_TEXT_OPTIONAL =
  "Also email me occasional AI visibility tips for businesses. Unsubscribe any time. Your scan is yours either way.";

/**
 * Wording beside the phone-contact checkbox.
 *
 * A separate permission from the two above, not a rewording of them. Those cover
 * marketing email under CAN-SPAM and GDPR; this covers being called or texted
 * about what they requested, which in the US is TCPA's question rather than
 * CAN-SPAM's. Two boxes because they are two agreements — someone may reasonably
 * want the scan and the emails without wanting the phone to ring.
 */
export const CONTACT_CONSENT_TEXT = "I agree to be contacted about my results.";

// Direct line. Published to people who have opted in — the delivery email and
// the report itself — but deliberately NOT on the public website, so it stays
// off the pages anonymous visitors and scrapers hit. Keep those two surfaces in
// mind before adding it anywhere new.
export const CONTACT_PHONE = "(909) 407-6602";
export const CONTACT_PHONE_TEL = "9094076602";
export const CONTACT_EMAIL = "maximilian@footholdsystems.com";

/**
 * Static deliverable in public/downloads.
 *
 * Still the 5 Levels PDF. The marketing pages around it are gone, but delivery
 * emails already sent to real people link straight to this file, so the file
 * stays until those sequences are retired. Do not delete it to tidy up.
 */
export const GUIDE_PATH =
  "/downloads/Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf";

// NOTE ON THE BOOKING WINDOW
// The "max 7 days out, 1–4pm PT" rule is enforced inside Calendly, on the event
// type's Availability settings — Calendly has no URL parameter for a maximum
// bookable date, so it cannot be done from this codebase. Calendly's rolling
// window recomputes per visitor at page load, which is what we want: someone who
// opens the link on the 1st sees the 1st–8th, on the 2nd sees the 2nd–9th.
// See BOOKING.md for the exact settings.

/**
 * Calendly link tagged with the entry point it was clicked from, so bookings can
 * be told apart in Calendly's UTM reporting.
 *
 * @param entryPoint Where the link lives, e.g. "header" or "scan-report".
 * @param medium     Channel it went out on. Defaults to the website; the
 *                   delivery email and the report pass their own.
 */
export function calendlyUrl(entryPoint: string, medium = "website"): string {
  return withCampaign(CALENDLY_URL, entryPoint, medium);
}

/**
 * Booking link for a customer who has already paid for the build.
 *
 * Same tagging, different event type — see CALENDLY_KICKOFF_URL.
 */
export function calendlyKickoffUrl(
  entryPoint = "dfy-kickoff",
  medium = "website"
): string {
  return withCampaign(CALENDLY_KICKOFF_URL, entryPoint, medium);
}

function withCampaign(base: string, entryPoint: string, medium: string): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", "footholdsystems");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", entryPoint);
  return url.toString();
}
