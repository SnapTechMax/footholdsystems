// Shared site-wide constants.
export const CALENDLY_URL = "https://calendly.com/max-snaptechrepair/new-meeting";

// Where the lead-magnet form sends people once the guide is actually delivered.
export const THANKS_PATH = "/guide/thanks";

// NOTE ON THE BOOKING WINDOW
// The "max 7 days out, 1–4pm PT" rule is enforced inside Calendly, on the event
// type's Availability settings — Calendly has no URL parameter for a maximum
// bookable date, so it cannot be done from this codebase. Calendly's rolling
// window recomputes per visitor at page load, which is what we want: someone who
// opens the link on the 1st sees the 1st–8th, on the 2nd sees the 2nd–9th.
// See BOOKING.md for the exact settings.

/**
 * Calendly link tagged with the on-site entry point it was clicked from, so
 * bookings can be told apart in Calendly's UTM reporting.
 */
export function calendlyUrl(entryPoint: string): string {
  const url = new URL(CALENDLY_URL);
  url.searchParams.set("utm_source", "footholdsystems");
  url.searchParams.set("utm_medium", "website");
  url.searchParams.set("utm_campaign", entryPoint);
  return url.toString();
}
