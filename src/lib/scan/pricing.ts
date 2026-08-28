/**
 * The two things someone can buy off the back of a scan.
 *
 * Prices live here as cents, not dollars, because that is what gets written to
 * `scan_orders.amount_cents` and what every payment provider expects. A float
 * of dollars that only ever gets multiplied by 100 is a rounding bug waiting
 * for a price ending in .99.
 */

export const SOLUTIONS_PRICE_CENTS = 4900;
export const DONE_FOR_YOU_PRICE_CENTS = 149_700;

export function formatPrice(cents: number): string {
  // No cents shown when the price is whole dollars — "$49", not "$49.00".
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export const SOLUTIONS_PRICE = formatPrice(SOLUTIONS_PRICE_CENTS);
export const DONE_FOR_YOU_PRICE = formatPrice(DONE_FOR_YOU_PRICE_CENTS);

/**
 * Tier 3, the retainer. Displayed only, never charged through here.
 *
 * It is not a checkout: the handover page books a call, because a six month
 * commitment with a guarantee attached is not something anyone should be able
 * to click into. Kept in this file anyway, in cents like the others, so a price
 * that appears on a customer-facing page has exactly one definition.
 *
 * That is not theoretical. Two prices in this codebase have already drifted in
 * a single day: the email sequence named the build at $1,500 while the site
 * charged $1,497, and a health check reported a hardcoded 1500 the moment the
 * constant moved. Both were copies of a number that should have had one home.
 */
export const RETAINER_SETUP_CENTS = 450_000;
export const RETAINER_MONTHLY_CENTS = 250_000;
export const RETAINER_SETUP_PRICE = formatPrice(RETAINER_SETUP_CENTS);
export const RETAINER_MONTHLY_PRICE = formatPrice(RETAINER_MONTHLY_CENTS);

/** What we pay out if the 180 day condition is not met. See the handover page. */
export const GUARANTEE_PAYOUT = formatPrice(1_500_000);

/**
 * Canonical origin for links in outgoing email.
 *
 * Falls back to the production host rather than to localhost: an email is the
 * one output that can outlive the process that made it, and a report link
 * pointing at localhost is worse than no link.
 */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.footholdsystems.com"
  );
}

export function reportUrl(token: string): string {
  return `${siteUrl()}/scan/${token}`;
}

/**
 * Where a cold prospect reads a scan we ran on them without being asked.
 *
 * A different path from `reportUrl` because it is a different page with a
 * different deal on it: nothing is paywalled, nothing was emailed to them by
 * the system, and the only thing for sale is the build. `/scan/<token>` is the
 * page a lead reads, and it redirects here when the token turns out to be an
 * outreach one, so a link pasted from the wrong place still lands right.
 */
export function auditUrl(token: string): string {
  return `${siteUrl()}/audit/${token}`;
}

/**
 * Where a buyer lands once the SOLUTIONS payment clears.
 *
 * A separate page rather than the report, because the moment after paying is
 * the only one where the reader is committed, the problem is fresh and the work
 * has not started yet — the single best position the DONE_FOR_YOU offer is ever
 * in. The page leads with the link to what they just bought, so this redirect
 * costs them nothing; see the page's own note.
 */
export function upsellUrl(token: string): string {
  return `${siteUrl()}/scan/${token}/next`;
}

export function unsubscribeUrl(email: string): string {
  return `${siteUrl()}/api/scan/unsubscribe?email=${encodeURIComponent(email)}`;
}

/**
 * Marks the URL a buyer is handed back on, so the page they land on can tell a
 * payment that just happened from somebody re-opening their report a week
 * later. Without it the Purchase conversion would fire on every visit to a paid
 * report, and Meta would learn a cohort converts several times over.
 *
 * A named constant because the writer here and the reader on the page fail
 * silently when they disagree, and a pixel that quietly stops recording sales
 * looks exactly like one that was never installed.
 */
export const PURCHASE_MARKER = "purchased";

/**
 * Confirmation page for a build purchase.
 *
 * Its own page rather than the report, because the report opens with a score
 * and eight findings and buries the one thing a new customer needs. See the
 * page itself for the full reasoning.
 */
export function bookedUrl(token: string): string {
  return `${siteUrl()}/scan/${token}/booked`;
}

/** Where a buyer is sent once the payment clears. */
export function checkoutReturnUrl(
  token: string,
  product: "solutions" | "done_for_you"
): string {
  // Each tier gets a page that opens with what it just bought: the $49 buyer
  // gets their fixes and then the case for the build, the build buyer gets a
  // confirmation and the one action left. Neither lands on the report, which is
  // a reference document rather than a next step.
  const base = product === "solutions" ? upsellUrl(token) : bookedUrl(token);
  return `${base}?${PURCHASE_MARKER}=1`;
}

/**
 * Where a buy button points.
 *
 * Our own route, never Whop directly. A Whop checkout has to be created
 * server-side per buyer so the scan token can be attached as metadata, and
 * metadata is the only thing tying a payment back to a report. A static link
 * cannot carry it, so there is no version of this that is a plain href to
 * whop.com.
 *
 * Always returns a URL. The route handles Whop being unreachable or
 * unconfigured, which is the right place for it: a caller cannot do anything
 * useful with a null except hide the button, and hiding the button loses the
 * sale even when the problem is momentary.
 */
export function checkoutUrl(
  token: string,
  product: "solutions" | "done_for_you" = "solutions"
): string {
  const params = new URLSearchParams({ token, product });
  return `${siteUrl()}/api/go/checkout?${params}`;
}
