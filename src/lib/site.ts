// Shared site-wide constants.

/**
 * The one destination on the sales page.
 *
 * Every CTA points here. Kept in one place because there are a dozen of them
 * down the page and a typo in any single one produces a button that silently
 * does nothing on a page people are being paid to visit.
 */
export const SCAN_ANCHOR = "#scan";

/*
 * The pre-sale call is gone. There is deliberately no calendar in front of a
 * purchase now: the $49 and the $1,497 are both bought directly, and the only
 * two calendars left are for people who have already paid, the kickoff and the
 * retainer conversation. Removed 2026-08-26.
 */

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
 * The retainer conversation, on the handover page. A third event again.
 *
 * Not the kickoff: that one is scheduling for work already paid for, and this
 * one is a decision about a six month commitment with a guarantee attached.
 * Sending both to the same calendar would mean a customer booking a kickoff and
 * landing in a page framed around a sale.
 */
export const CALENDLY_RETAINER_URL =
  "https://calendly.com/maximilian-footholdsystems/aeo-full-strategy-call";

/**
 * Postal address, shown on the privacy policy and in the site footer.
 *
 * The same address the delivery email prints for CAN-SPAM, kept here so the two
 * cannot drift — an address that differs between the emails and the site is
 * worse than one that appears in only one of them. Meta's ad review also treats a
 * contactable business address on a lead-capture landing page as a trust signal.
 * If the business moves, this constant and `BRAND_ADDRESS` in
 * `content/nurture-sequence.mjs` move together.
 */
export const BUSINESS_ADDRESS =
  "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";

/**
 * Wording beside the marketing consent checkbox.
 *
 * Read by the scan form, which shows it, and by /api/scan, which stores it
 * verbatim against the lead. One constant, so the wording someone agreed to and
 * the wording on record cannot drift apart — which is the only thing that makes
 * the stored record worth anything.
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

// Direct line. Published to people who have opted in — the delivery email and
// the report itself — but deliberately NOT on the public website, so it stays
// off the pages anonymous visitors and scrapers hit. Keep those two surfaces in
// mind before adding it anywhere new.
export const CONTACT_PHONE = "(909) 407-6602";
export const CONTACT_EMAIL = "maximilian@footholdsystems.com";

/*
 * THE 5 LEVELS PDF IS STILL IN public/downloads, AND STAYS THERE.
 *
 * Its `GUIDE_PATH` constant is gone with the lead route that served it, but
 * delivery emails already sent to real people link straight at the file. It
 * costs nothing to host and a 404 in somebody's inbox is not recoverable. Do
 * not delete it to tidy up.
 */

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

/** Booking link for the tier 3 retainer. See CALENDLY_RETAINER_URL. */
export function calendlyRetainerUrl(
  entryPoint = "tier3-retainer",
  medium = "website"
): string {
  return withCampaign(CALENDLY_RETAINER_URL, entryPoint, medium);
}

function withCampaign(base: string, entryPoint: string, medium: string): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", "footholdsystems");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", entryPoint);
  return url.toString();
}
