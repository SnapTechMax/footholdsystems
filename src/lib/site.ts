// Shared site-wide constants.
// The dedicated event type carrying the rolling 7-day / 1–4pm Pacific window.
export const CALENDLY_URL =
  "https://calendly.com/max-snaptechrepair/20-minute-ai-strategy-call";

// Where the lead-magnet form sends people once the guide is actually delivered.
export const THANKS_PATH = "/guide/thanks";

/**
 * Wording beside the marketing consent checkbox.
 *
 * Lives here rather than in lib/consent.ts because that module is server-only
 * and the form is a client component. Both import this one, so the wording shown
 * to someone and the wording stored against their consent cannot drift apart —
 * which is the only thing that makes the stored record worth anything.
 *
 * Required, not optional: the guide is only sent to people who agree to the
 * emails. Worded so the exchange is stated plainly rather than dressed up as a
 * choice that isn't one.
 */
export const CONSENT_TEXT =
  "Yes, send me the guide and occasional AI tips for businesses. Unsubscribe any time.";

/**
 * Shown where consent has to be a free choice, so the guide cannot be presented
 * as conditional on it. Both wordings are stored verbatim with the consent
 * record, which is how the difference stays provable later.
 */
export const CONSENT_TEXT_OPTIONAL =
  "Also email me occasional AI tips for businesses. Unsubscribe any time. The guide is yours either way.";

// Direct line. Published to people who have opted in — the delivery email and the
// guide PDF — but deliberately NOT on the public website, so it stays off the
// pages anonymous visitors and scrapers hit. Keep those two surfaces in mind
// before adding it anywhere new.
export const CONTACT_PHONE = "(909) 407-6602";
export const CONTACT_PHONE_TEL = "9094076602";
export const CONTACT_EMAIL = "max@footholdsystems.com";

// The lead magnet in public/downloads. Kept here because both the thank-you page
// and the delivery email link to it, and a mismatch silently breaks the download.
// Hyphenated rather than spaced so the URL needs no percent-encoding — the plain
// text version of the delivery email prints this link raw.
export const GUIDE_PATH =
  "/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf";

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
 * @param entryPoint Where the link lives, e.g. "header" or "guide-email".
 * @param medium     Channel it went out on. Defaults to the website; the
 *                   delivery email and the PDF pass their own.
 */
export function calendlyUrl(entryPoint: string, medium = "website"): string {
  const url = new URL(CALENDLY_URL);
  url.searchParams.set("utm_source", "footholdsystems");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", entryPoint);
  return url.toString();
}
